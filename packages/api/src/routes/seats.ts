import { Router } from 'express'
import mongoose from 'mongoose'
import { authenticate, requireAdmin, requireSeatOwner, requireSeatOwnerOrAdmin, validateObjectId, getAllowedSeatIds } from '../middleware.js'
import { Seat } from '../models/seat.js'
import { encrypt, decrypt } from '../lib/encryption.js'
import { User } from '../models/user.js'
import { Schedule } from '../models/schedule.js'
import { parseCredentialJson, type ParsedCredential } from '@repo/shared/credential-parser'
import { fetchOAuthProfile, OAuthProfileError, type OAuthProfile } from '../services/anthropic-service.js'

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
    console.log(`[AUDIT] Single credential export seat=${req.params.id} by user=${req.user!.email} ip=${req.ip} at ${new Date().toISOString()}`)

    const seat = await Seat.findById(req.params.id).select('+oauth_credential').lean()
    if (!seat?.oauth_credential?.access_token) {
      res.status(404).json({ error: 'No credential found' })
      return
    }

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
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/seats — create seat token-first (any authenticated user becomes owner).
// Required: credential_json + max_users. Auto-fetches profile to fill email + default label.
// manual_mode=true skips profile API and requires email+label in body.
router.post('/', authenticate, async (req, res) => {
  try {
    const { credential_json, max_users, label, manual_mode, email: bodyEmail } = req.body as {
      credential_json?: string
      max_users?: number
      label?: string
      manual_mode?: boolean
      email?: string
    }

    if (!credential_json || typeof credential_json !== 'string') {
      res.status(400).json({ error: 'credential_json is required' })
      return
    }
    if (typeof max_users !== 'number' || max_users < 1) {
      res.status(400).json({ error: 'max_users is required' })
      return
    }

    const parsed = parseCredentialJson(credential_json)
    if (!parsed) {
      res.status(400).json({ error: 'Invalid credential JSON' })
      return
    }

    let email: string
    let defaultLabel: string

    if (manual_mode === true) {
      if (!bodyEmail || !label) {
        res.status(400).json({ error: 'email and label required in manual mode' })
        return
      }
      email = bodyEmail
      defaultLabel = label
    } else {
      try {
        const profile = await fetchOAuthProfile(parsed.accessToken)
        email = profile.account.email
        defaultLabel = profile.account.full_name
      } catch (e) {
        if (e instanceof OAuthProfileError && e.status === 401) {
          res.status(422).json({ error: 'Token invalid or expired' })
          return
        }
        res.status(502).json({ error: 'Profile API unreachable' })
        return
      }
    }

    const existing = await Seat.findOne({ email }).select('_id').lean()
    if (existing) {
      res.status(409).json({
        error: 'Seat with this email already exists. Use Update Token to refresh credentials.',
        duplicate_seat_id: String(existing._id),
      })
      return
    }

    const seat = await Seat.create({
      email,
      label: label || defaultLabel,
      max_users,
      owner_id: req.user!._id,
      oauth_credential: toCredentialDoc(parsed),
      token_active: true,
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
    const allowed = ['email', 'label', 'max_users', 'include_in_overview']
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

    // Remove this seat from all users' seat_ids AND watched_seats
    await User.updateMany(
      { $or: [{ seat_ids: id }, { 'watched_seats.seat_id': id }] },
      { $pull: { seat_ids: id, watched_seats: { seat_id: id } } },
    )
    // Clear schedules + active_sessions (runtime state — must stop firing for deleted seat)
    const { ActiveSession } = await import('../models/active-session.js')
    await Schedule.deleteMany({ seat_id: id })
    await ActiveSession.deleteMany({ seat_id: id })
    // Soft delete the seat — cleanup cron will cascade-delete usage/alerts after 30 days
    seat.deleted_at = new Date()
    seat.token_active = false
    await seat.save()

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

    // Check seat capacity
    const currentCount = await User.countDocuments({ seat_ids: id, active: true })
    if (currentCount >= seat.max_users) {
      res.status(400).json({ error: 'Seat is at maximum capacity' })
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

    // Clear user's schedules for this seat
    await Schedule.deleteMany({ seat_id: id, user_id: userId })
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
      { new: true },
    )
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

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
      { new: true },
    )
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

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

    const newOwner = await User.findById(new_owner_id)
    if (!newOwner) {
      res.status(404).json({ error: 'New owner not found' })
      return
    }

    const seat = await Seat.findByIdAndUpdate(
      req.params.id,
      { owner_id: new_owner_id },
      { new: true },
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

    res.json({ message: 'Ownership transferred', seat })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
