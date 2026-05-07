import { Router } from 'express'
import mongoose from 'mongoose'
import { authenticate, requireAdmin, requireSeatOwner, requireSeatOwnerOrAdmin, validateObjectId, getAllowedSeatIds } from '../middleware.js'
import { Seat } from '../models/seat.js'
import { encrypt, decrypt } from '../lib/encryption.js'
import { User } from '../models/user.js'
import { parseCredentialJson, type ParsedCredential } from '@repo/shared/credential-parser'
import { fetchOAuthProfile, OAuthProfileError, toProfileCache, type OAuthProfile } from '../services/anthropic-service.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { cascadeHardDelete } from '../services/seat-cascade-delete.js'
import { sendToUser } from '../services/telegram-service.js'
import { logAudit } from '../models/audit-log.js'

const router = Router()

/** Build structured credential object for DB insert from ParsedCredential. */
function toCredentialDoc(parsed: ParsedCredential) {
  return {
    access_token: encrypt(parsed.accessToken),
    refresh_token: parsed.refreshToken ? encrypt(parsed.refreshToken) : null,
    expires_at: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
    scopes: parsed.scopes,
    subscription_type: parsed.subscriptionType,
    rate_limit_tier: parsed.rateLimitTier,
  }
}

/** Legacy parser — used by PUT /:id/token (structured fields OR raw JSON). Kept for backward compat. */
function parseCredential(body: Record<string, unknown>) {
  if (body.credential_json && typeof body.credential_json === 'string') {
    const p = parseCredentialJson(body.credential_json)
    if (!p) throw new SyntaxError('Invalid credential JSON')
    return {
      access_token: p.accessToken,
      refresh_token: p.refreshToken,
      expires_at: p.expiresAt,
      scopes: p.scopes,
      subscription_type: p.subscriptionType,
      rate_limit_tier: p.rateLimitTier,
    }
  }
  return {
    access_token: body.access_token as string,
    refresh_token: (body.refresh_token as string) || null,
    expires_at: (body.expires_at as number) || null,
    scopes: (body.scopes as string[]) || [],
    subscription_type: (body.subscription_type as string) || null,
    rate_limit_tier: (body.rate_limit_tier as string) || null,
  }
}

// GET /api/seats — list seats with assigned users (scoped to user's seats)
router.get('/', authenticate, async (req, res) => {
  try {
    const allowed = await getAllowedSeatIds(req.user!)
    const seatFilter = allowed ? { _id: { $in: allowed } } : {}
    const seats = await Seat.find(seatFilter).select('+oauth_credential').populate('owner_id', 'name email').sort({ _id: 1 }).lean()
    const userFilter = allowed
      ? { active: true, seat_ids: { $in: allowed } }
      : { active: true, seat_ids: { $exists: true, $ne: [] } }
    const users = await User.find(userFilter, 'name email seat_ids').lean()

    // Group users by each seat_id (user can appear in multiple seats)
    const usersBySeat: Record<string, typeof users> = {}
    for (const user of users) {
      for (const seatId of user.seat_ids ?? []) {
        const key = String(seatId)
        if (!usersBySeat[key]) usersBySeat[key] = []
        usersBySeat[key].push(user)
      }
    }

    const enriched = seats.map((seat) => {
      const seatObj = { ...seat }
      // Strip tokens from oauth_credential, keep metadata
      if (seatObj.oauth_credential) {
        delete (seatObj.oauth_credential as any).access_token
        delete (seatObj.oauth_credential as any).refresh_token
      }
      // Normalize owner_id back to string after populate
      const populatedOwner = seatObj.owner_id && typeof seatObj.owner_id === 'object'
        ? seatObj.owner_id as unknown as { _id: string; name: string; email: string }
        : null

      return {
        ...seatObj,
        owner_id: populatedOwner ? String(populatedOwner._id) : null,
        owner: populatedOwner
          ? { _id: String(populatedOwner._id), name: populatedOwner.name, email: populatedOwner.email }
          : null,
        has_token: !!seat.token_active,
        users: (usersBySeat[String(seat._id)] || []).map((u) => ({
          id: String(u._id),
          name: u.name,
          email: u.email,
        })),
      }
    })

    res.json({ seats: enriched })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/seats/available-users — list active users for seat assignment (any authenticated user)
// Owners need this to add members to their seats and to pick users for schedule entries.
// Must be before /:id routes to avoid param matching
router.get('/available-users', authenticate, async (_req, res) => {
  try {
    const users = await User.find({ active: true }, 'name email seat_ids').populate('seat_ids', 'label').lean()
    const mapped = users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      active: true,
      seat_labels: ((u.seat_ids ?? []) as { label?: string }[]).map(s => s.label).filter(Boolean),
    }))
    res.json({ users: mapped })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/seats/:id/credentials/export — export single seat credential (owner only)
router.get('/:id/credentials/export', authenticate, validateObjectId('id'), requireSeatOwner(), async (req, res) => {
  try {
    const seat = await Seat.findById(req.params.id).select('+oauth_credential').lean()
    if (!seat?.oauth_credential?.access_token) {
      res.status(404).json({ error: 'No credential found' })
      return
    }

    logAudit('credential_export', req.user!, { type: 'seat', id: String(req.params.id) }, { seat_label: seat.label }, req.ip)

    const cred = seat.oauth_credential
    res.json({
      credentials: [{
        seat_label: seat.label,
        seat_email: seat.email,
        claudeAiOauth: {
          accessToken: cred.access_token ? decrypt(cred.access_token) : null,
          refreshToken: cred.refresh_token ? decrypt(cred.refresh_token) : null,
          expiresAt: cred.expires_at ? new Date(cred.expires_at).getTime() : null,
          scopes: cred.scopes ?? [],
          subscriptionType: cred.subscription_type ?? null,
          rateLimitTier: cred.rate_limit_tier ?? null,
        },
      }],
    })
  } catch (error) {
    console.error('[Single Credential Export] Failed:', error)
    res.status(500).json({ error: 'Credential export failed' })
  }
})

const PROFILE_STALE_MS = 6 * 60 * 60 * 1000 // 6 hours

// GET /api/seats/:id/profile — return cached profile, auto-refresh if stale >6h
router.get('/:id/profile', authenticate, validateObjectId('id'), requireSeatOwnerOrAdmin(), async (req, res) => {
  const seat = await Seat.findById(req.params.id).select('+oauth_credential').lean()
  if (!seat) { res.status(404).json({ error: 'Seat not found' }); return }

  const isStale = !seat.profile?.fetched_at ||
    Date.now() - new Date(seat.profile.fetched_at).getTime() > PROFILE_STALE_MS

  if (!isStale && seat.profile) {
    res.json({ profile: seat.profile })
    return
  }

  // Auto-refresh if token active
  if (!seat.token_active || !seat.oauth_credential?.access_token) {
    res.json({ profile: seat.profile ?? null, stale: true })
    return
  }

  try {
    const token = decrypt(seat.oauth_credential.access_token)
    const oauthProfile = await fetchOAuthProfile(token)
    const fresh = toProfileCache(oauthProfile)
    await Seat.findByIdAndUpdate(req.params.id, { profile: fresh })
    res.json({ profile: fresh })
  } catch {
    // Refresh failed — return cached profile as stale fallback
    res.json({ profile: seat.profile ?? null, stale: true, refresh_error: true })
  }
})

// POST /api/seats/:id/profile/refresh — force-refresh profile from Anthropic
router.post('/:id/profile/refresh', authenticate, validateObjectId('id'), requireSeatOwnerOrAdmin(), async (req, res) => {
  try {
    const seat = await Seat.findById(req.params.id).select('+oauth_credential')
    if (!seat) { res.status(404).json({ error: 'Seat not found' }); return }
    if (!seat.token_active || !seat.oauth_credential?.access_token) {
      res.status(422).json({ error: 'No active token — cannot refresh profile' })
      return
    }

    const token = decrypt(seat.oauth_credential.access_token)
    const oauthProfile = await fetchOAuthProfile(token)
    const fresh = toProfileCache(oauthProfile)
    seat.profile = fresh as any
    await seat.save()
    res.json({ profile: fresh })
  } catch (error) {
    if (error instanceof OAuthProfileError && error.status === 401) {
      res.status(422).json({ error: 'Token invalid or expired' })
      return
    }
    const message = error instanceof Error ? error.message : 'Profile refresh failed'
    res.status(502).json({ error: message })
  }
})

// POST /api/seats/preview-token — preview credential: parse + fetch profile + check duplicate.
// Does NOT persist; used by FE before showing the create button.
router.post('/preview-token', authenticate, async (req, res) => {
  try {
    const { credential_json } = req.body as { credential_json?: string }
    if (!credential_json || typeof credential_json !== 'string') {
      res.status(400).json({ error: 'credential_json is required' })
      return
    }
    const parsed = parseCredentialJson(credential_json)
    if (!parsed) {
      res.status(400).json({ error: 'Invalid credential JSON' })
      return
    }

    let profile: OAuthProfile
    try {
      profile = await fetchOAuthProfile(parsed.accessToken)
    } catch (e) {
      if (e instanceof OAuthProfileError && e.status === 401) {
        res.status(422).json({ error: 'Token invalid or expired' })
        return
      }
      res.status(502).json({ error: 'Profile API unreachable' })
      return
    }

    const duplicate = await Seat.findOne({ email: profile.account.email }).select('_id').lean()

    // Check for soft-deleted seat with matching email
    const softDeleted = await Seat.findOne(
      { email: profile.account.email, deleted_at: { $ne: null } },
      '_id label deleted_at',
    ).lean()

    let restorable_seat = null
    if (softDeleted) {
      const snapCount = await UsageSnapshot.countDocuments({ seat_id: softDeleted._id })
      restorable_seat = {
        _id: String(softDeleted._id),
        label: softDeleted.label,
        deleted_at: softDeleted.deleted_at!.toISOString(),
        has_history: snapCount > 0,
      }
    }

    res.json({
      account: {
        email: profile.account.email,
        full_name: profile.account.full_name,
        has_claude_max: profile.account.has_claude_max,
        has_claude_pro: profile.account.has_claude_pro,
      },
      organization: {
        name: profile.organization.name,
        organization_type: profile.organization.organization_type,
        rate_limit_tier: profile.organization.rate_limit_tier,
        subscription_status: profile.organization.subscription_status,
      },
      duplicate_seat_id: duplicate ? String(duplicate._id) : null,
      restorable_seat,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/seats — create seat token-first (any authenticated user becomes owner).
// Required: credential_json. Auto-fetches profile to fill email + default label.
// manual_mode=true skips profile API and requires email+label in body.
// restore_seat_id: restore a soft-deleted seat instead of creating new.
// force_new: cascade-delete soft-deleted seat with same email, then create fresh.
router.post('/', authenticate, async (req, res) => {
  try {
    const { credential_json, label, manual_mode, email: bodyEmail,
            include_in_overview, restore_seat_id, force_new } = req.body as {
      credential_json?: string; label?: string
      manual_mode?: boolean; email?: string; include_in_overview?: boolean
      restore_seat_id?: string; force_new?: boolean
    }

    if (!credential_json || typeof credential_json !== 'string') {
      res.status(400).json({ error: 'credential_json is required' })
      return
    }

    const parsed = parseCredentialJson(credential_json)
    if (!parsed) {
      res.status(400).json({ error: 'Invalid credential JSON' })
      return
    }

    // ── CASE B: Restore existing soft-deleted seat (atomic to prevent race) ──
    if (restore_seat_id) {
      if (!mongoose.Types.ObjectId.isValid(restore_seat_id)) {
        res.status(400).json({ error: 'Invalid restore_seat_id' }); return
      }

      // Best-effort profile fetch before atomic update
      let profileCache: ReturnType<typeof toProfileCache> | null = null
      try {
        const oauthProfile = await fetchOAuthProfile(parsed.accessToken)
        profileCache = toProfileCache(oauthProfile)
      } catch { /* keep existing profile if any */ }

      const updateFields: Record<string, unknown> = {
        deleted_at: null,
        oauth_credential: toCredentialDoc(parsed),
        owner_id: req.user!._id,
        token_active: true,
        last_fetch_error: null,
      }
      if (label) updateFields.label = label
      if (profileCache) updateFields.profile = profileCache

      // Read previous members before atomic update clears them
      const deletedSeat = await Seat.findOne(
        { _id: restore_seat_id, deleted_at: { $ne: null } }, 'previous_member_ids',
      ).lean()
      const previousMembers = deletedSeat?.previous_member_ids ?? []

      updateFields.previous_member_ids = [] // clear after restore

      let restored
      try {
        restored = await Seat.findOneAndUpdate(
          { _id: restore_seat_id, deleted_at: { $ne: null } },
          { $set: updateFields },
          { returnDocument: 'after' },
        )
      } catch (err: any) {
        // E11000 = active seat with same email already exists
        if (err?.code === 11000) {
          res.status(409).json({ error: 'Seat với email này đã tồn tại' }); return
        }
        throw err
      }
      if (!restored) {
        res.status(409).json({ error: 'Seat đã được khôi phục hoặc đã bị xóa vĩnh viễn' }); return
      }

      // Re-assign previous members + re-seed their watched_seats
      if (previousMembers.length > 0) {
        const seatObjId = restored._id
        await User.updateMany(
          { _id: { $in: previousMembers }, active: true },
          {
            $addToSet: {
              seat_ids: seatObjId,
              watched_seats: { seat_id: seatObjId, threshold_5h_pct: 90, threshold_7d_pct: 85 },
            },
          },
        )
      }

      // Re-seed owner's watched_seats (owner may not be in previous members)
      await User.findByIdAndUpdate(req.user!._id, {
        $addToSet: {
          watched_seats: { seat_id: restored._id, threshold_5h_pct: 90, threshold_7d_pct: 85 },
        },
      })

      const restoredMembers = previousMembers.length
      res.json({ restored: true, seat: restored, restored_members: restoredMembers })
      return
    }

    let email: string
    let defaultLabel: string
    let profileCache: ReturnType<typeof toProfileCache> | null = null

    if (manual_mode === true) {
      if (!bodyEmail || !label) {
        res.status(400).json({ error: 'email and label required in manual mode' })
        return
      }
      email = bodyEmail
      defaultLabel = label
    } else {
      try {
        const oauthProfile = await fetchOAuthProfile(parsed.accessToken)
        email = oauthProfile.account.email
        defaultLabel = oauthProfile.account.full_name
        profileCache = toProfileCache(oauthProfile)
      } catch (e) {
        if (e instanceof OAuthProfileError && e.status === 401) {
          res.status(422).json({ error: 'Token invalid or expired' })
          return
        }
        res.status(502).json({ error: 'Profile API unreachable' })
        return
      }
    }

    // Check active duplicate
    const existing = await Seat.findOne({ email }).select('_id').lean()
    if (existing) {
      res.status(409).json({
        error: 'Seat with this email already exists. Use Update Token to refresh credentials.',
        duplicate_seat_id: String(existing._id),
      })
      return
    }

    // ── CASE C: Force-new — hard-delete soft-deleted seat first (admin only) ──
    if (force_new) {
      if (req.user!.role !== 'admin') {
        res.status(403).json({ error: 'Chỉ admin mới được tạo mới (xóa vĩnh viễn seat cũ)' }); return
      }
      const softDeleted = await Seat.findOne(
        { email, deleted_at: { $ne: null } }, '_id',
      ).lean()
      if (softDeleted) {
        // Clean up user references before cascade delete
        await User.updateMany(
          { $or: [{ seat_ids: softDeleted._id }, { 'watched_seats.seat_id': softDeleted._id }] },
          { $pull: { seat_ids: softDeleted._id, watched_seats: { seat_id: softDeleted._id } } },
        )
        await cascadeHardDelete([softDeleted._id])
      }
    } else {
      // ── CASE A: Check for restorable seat ──
      const softDeleted = await Seat.findOne(
        { email, deleted_at: { $ne: null } },
        '_id label deleted_at',
      ).lean()
      if (softDeleted) {
        const snapCount = await UsageSnapshot.countDocuments({ seat_id: softDeleted._id })
        res.json({
          restorable: true,
          deleted_seat: {
            _id: String(softDeleted._id),
            label: softDeleted.label,
            deleted_at: softDeleted.deleted_at!.toISOString(),
            has_history: snapCount > 0,
          },
        })
        return
      }
    }

    // ── Normal create ──
    const seat = await Seat.create({
      email,
      label: label || defaultLabel,
      owner_id: req.user!._id,
      oauth_credential: toCredentialDoc(parsed),
      token_active: true,
      include_in_overview: include_in_overview ?? true,
      profile: profileCache,
    })
    // Auto-seed owner's watched_seats so alerts appear in their feed
    await User.findByIdAndUpdate(req.user!._id, {
      $addToSet: { watched_seats: { seat_id: seat._id, threshold_5h_pct: 90, threshold_7d_pct: 85 } },
    })
    res.status(201).json(seat)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/seats/:id — update seat (owner or admin)
router.put('/:id', authenticate, validateObjectId('id'), requireSeatOwnerOrAdmin(), async (req, res) => {
  try {
    const id = req.params.id as string
    // owner_id intentionally excluded — ownership transfer uses PUT /:id/transfer (admin only)
    const allowed = ['email', 'label', 'include_in_overview']
    const update: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key]
    }

    const seat = await Seat.findByIdAndUpdate(id, update, { new: true, runValidators: true })
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

    res.json(seat)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/seats/:id — soft delete seat, unassign users, clear schedules (owner or admin).
// Usage history (snapshots, windows, alerts, session_metrics) retained for 30 days,
// then hard-deleted by seat-cleanup-service cron.
router.delete('/:id', authenticate, validateObjectId('id'), requireSeatOwnerOrAdmin(), async (req, res) => {
  try {
    const id = req.params.id as string
    const seat = await Seat.findById(id)
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

    // Capture current members before removing — used by restore flow
    const members = await User.find({ seat_ids: id, active: true }, '_id').lean()
    seat.previous_member_ids = members.map((m) => m._id)

    // Remove this seat from all users' seat_ids AND watched_seats
    await User.updateMany(
      { $or: [{ seat_ids: id }, { 'watched_seats.seat_id': id }] },
      { $pull: { seat_ids: id, watched_seats: { seat_id: id } } },
    )
    // Clear activity logs (runtime state — must stop for deleted seat)
    const { SeatActivityLog } = await import('../models/seat-activity-log.js')
    await SeatActivityLog.deleteMany({ seat_id: id })
    // Remove seat from all teams
    const { Team } = await import('../models/team.js')
    await Team.updateMany({ seat_ids: id }, { $pull: { seat_ids: id } })
    // Soft delete the seat — cleanup cron will cascade-delete usage/alerts after 30 days
    seat.deleted_at = new Date()
    seat.token_active = false
    await seat.save()

    logAudit('seat_delete', req.user!, { type: 'seat', id }, { seat_label: seat.label, delete_type: 'soft' }, req.ip)
    res.json({ message: 'Seat deleted' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/seats/:id/assign — assign user to seat (owner or admin)
router.post('/:id/assign', authenticate, validateObjectId('id'), requireSeatOwnerOrAdmin(), async (req, res) => {
  try {
    const id = req.params.id as string
    const { userId } = req.body
    if (!userId) {
      res.status(400).json({ error: 'userId is required' })
      return
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: 'Invalid user ID' })
      return
    }

    const seat = await Seat.findById(id)
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

    const user = await User.findById(userId)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    // Add seat to user's seat_ids AND watched_seats (avoid duplicates)
    const seatObjId = new mongoose.Types.ObjectId(id)
    const targetUser = await User.findById(userId, 'watched_seats').lean()
    const alreadyWatching = (targetUser?.watched_seats ?? []).some((w: any) => String(w.seat_id) === id)
    const update: any = { $addToSet: { seat_ids: seatObjId } }
    if (!alreadyWatching) {
      update.$push = { watched_seats: { seat_id: seatObjId, threshold_5h_pct: 90, threshold_7d_pct: 85 } }
    }
    await User.findByIdAndUpdate(userId, update)

    res.json({ message: 'User assigned to seat', user })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/seats/:id/unassign/:userId — unassign user + clear their schedules (owner or admin)
router.delete('/:id/unassign/:userId', authenticate, validateObjectId('id'), requireSeatOwnerOrAdmin(), async (req, res) => {
  try {
    const id = req.params.id as string
    const userId = req.params.userId as string

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: 'Invalid user ID' })
      return
    }

    const user = await User.findById(userId)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    if (!user.seat_ids?.some((sid: mongoose.Types.ObjectId) => String(sid) === id)) {
      res.status(400).json({ error: 'User is not assigned to this seat' })
      return
    }

    // Remove seat from user's seat_ids
    await User.findByIdAndUpdate(userId, { $pull: { seat_ids: new mongoose.Types.ObjectId(id) } })

    res.json({ message: 'User unassigned from seat' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/seats/:id/token — set/update OAuth credential (owner or admin)
router.put('/:id/token', authenticate, validateObjectId('id'), requireSeatOwnerOrAdmin(), async (req, res) => {
  try {
    const id = req.params.id as string
    const cred = parseCredential(req.body)
    if (!cred.access_token || typeof cred.access_token !== 'string') {
      res.status(400).json({ error: 'access_token is required' })
      return
    }

    const oauth_credential = {
      access_token: encrypt(cred.access_token),
      refresh_token: cred.refresh_token ? encrypt(cred.refresh_token) : null,
      expires_at: cred.expires_at ? new Date(cred.expires_at) : null,
      scopes: cred.scopes,
      subscription_type: cred.subscription_type,
      rate_limit_tier: cred.rate_limit_tier,
    }

    const seat = await Seat.findByIdAndUpdate(
      id,
      { oauth_credential, token_active: true, last_fetch_error: null },
      { returnDocument: 'after' },
    )
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

    // Best-effort profile update — don't fail the token update
    try {
      const oauthProfile = await fetchOAuthProfile(cred.access_token)
      await Seat.findByIdAndUpdate(id, { profile: toProfileCache(oauthProfile) })
    } catch { /* profile will be fetched lazily */ }

    logAudit('token_update', req.user!, { type: 'seat', id }, { seat_label: seat.label, has_credential: true }, req.ip)
    res.json({ message: 'Credential updated', seat })
  } catch (error) {
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: 'Invalid JSON format' })
      return
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/seats/:id/token — remove credential (owner or admin)
router.delete('/:id/token', authenticate, validateObjectId('id'), requireSeatOwnerOrAdmin(), async (req, res) => {
  try {
    const id = req.params.id as string
    const seat = await Seat.findByIdAndUpdate(
      id,
      { oauth_credential: null, token_active: false, last_fetch_error: null, last_refreshed_at: null },
      { returnDocument: 'after' },
    )
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

    logAudit('token_delete', req.user!, { type: 'seat', id }, { seat_label: seat.label }, req.ip)
    res.json({ message: 'Token removed', seat })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/seats/:id/transfer — transfer seat ownership (admin only)
router.put('/:id/transfer', authenticate, requireAdmin, validateObjectId('id'), async (req, res) => {
  try {
    const { new_owner_id } = req.body
    if (!new_owner_id || !mongoose.Types.ObjectId.isValid(new_owner_id)) {
      res.status(400).json({ error: 'Valid new_owner_id is required' })
      return
    }

    // Block admin from transferring seat to themselves (privilege escalation: would grant credential export)
    if (new_owner_id === req.user!._id) {
      res.status(403).json({ error: 'Cannot transfer seat ownership to yourself' })
      return
    }

    const newOwner = await User.findById(new_owner_id)
    if (!newOwner) {
      res.status(404).json({ error: 'New owner not found' })
      return
    }

    // Capture old owner before transfer for notification
    const seatBefore = await Seat.findById(req.params.id, 'owner_id label').lean()
    if (!seatBefore) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }
    const oldOwnerId = seatBefore.owner_id ? String(seatBefore.owner_id) : null

    const seat = await Seat.findByIdAndUpdate(
      req.params.id,
      { owner_id: new_owner_id },
      { returnDocument: 'after' },
    ).populate('owner_id', 'name email')
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

    // Auto-seed new owner's watched_seats
    const seatObjId = new mongoose.Types.ObjectId(req.params.id as string)
    const newOwnerDoc = await User.findById(new_owner_id, 'watched_seats').lean()
    const already = (newOwnerDoc?.watched_seats ?? []).some((w: any) => String(w.seat_id) === String(seatObjId))
    if (!already) {
      await User.findByIdAndUpdate(new_owner_id, {
        $push: { watched_seats: { seat_id: seatObjId, threshold_5h_pct: 90, threshold_7d_pct: 85 } },
      })
    }

    // Notify old owner about ownership transfer
    if (oldOwnerId && oldOwnerId !== new_owner_id) {
      const label = seatBefore.label ?? req.params.id
      const msg = `🔄 <b>Ownership Transferred</b>\n`
        + `Seat: <b>${label}</b>\n`
        + `New owner: ${newOwner.name ?? newOwner.email}\n`
        + `By: ${req.user!.name ?? req.user!.email}`
      sendToUser(oldOwnerId, msg).catch((err) =>
        console.error('[Transfer] Failed to notify old owner:', err),
      )
    }

    logAudit('seat_transfer', req.user!, { type: 'seat', id: String(req.params.id) }, { seat_label: seatBefore.label, from_owner_id: oldOwnerId, to_owner_id: new_owner_id }, req.ip)
    res.json({ message: 'Ownership transferred', seat })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
