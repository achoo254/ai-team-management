import { Router } from 'express'
import mongoose from 'mongoose'
import { authenticate, requireAdmin, requireSeatOwner, requireSeatOwnerOrAdmin, validateObjectId, getAllowedSeatIds } from '../middleware.js'
import { Seat } from '../models/seat.js'
import { encrypt, decrypt } from '../lib/encryption.js'
import { User } from '../models/user.js'
import { Schedule } from '../models/schedule.js'

const router = Router()

/** Parse credential from request body — supports raw JSON and structured fields */
function parseCredential(body: Record<string, unknown>) {
  // Format A: raw JSON string (from browser cookie/file export)
  if (body.credential_json && typeof body.credential_json === 'string') {
    const parsed = JSON.parse(body.credential_json)
    const cred = parsed.claudeAiOauth || parsed
    return {
      access_token: cred.accessToken || cred.access_token,
      refresh_token: cred.refreshToken || cred.refresh_token || null,
      expires_at: cred.expiresAt || cred.expires_at || null,
      scopes: cred.scopes || [],
      subscription_type: cred.subscriptionType || cred.subscription_type || null,
      rate_limit_tier: cred.rateLimitTier || cred.rate_limit_tier || null,
    }
  }
  // Format B: structured fields
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
    const seats = await Seat.find(seatFilter).select('+oauth_credential').populate('owner_id', 'name email').populate('team_id', 'name color').sort({ _id: 1 }).lean()
    const userFilter = allowed
      ? { active: true, seat_ids: { $in: allowed } }
      : { active: true, seat_ids: { $exists: true, $ne: [] } }
    const users = await User.find(userFilter, 'name email seat_ids team_ids').lean()

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
      // Normalize team_id populated object
      const populatedTeam = seatObj.team_id && typeof seatObj.team_id === 'object'
        ? seatObj.team_id as unknown as { _id: string; name: string; color: string }
        : null

      return {
        ...seatObj,
        team_id: populatedTeam ? String(populatedTeam._id) : null,
        team: populatedTeam
          ? { _id: String(populatedTeam._id), name: populatedTeam.name, color: populatedTeam.color }
          : null,
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

// GET /api/seats/available-users — list active users for seat assignment (admin only)
// Must be before /:id routes to avoid param matching
router.get('/available-users', authenticate, requireAdmin, async (_req, res) => {
  try {
    const users = await User.find({ active: true }, 'name email team_ids seat_ids').populate('seat_ids', 'label').lean()
    const mapped = users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      team_ids: (u.team_ids ?? []).map(String),
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

// POST /api/seats — create seat (any authenticated user becomes owner)
router.post('/', authenticate, async (req, res) => {
  try {
    const { email, label, team_id, max_users } = req.body

    if (!email || !label) {
      res.status(400).json({ error: 'email and label are required' })
      return
    }

    const seat = await Seat.create({ email, label, team_id: team_id || null, max_users, owner_id: req.user!._id })
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
    const allowed = ['email', 'label', 'team_id', 'max_users']
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

// DELETE /api/seats/:id — delete seat, unassign users, clear schedules (owner or admin)
router.delete('/:id', authenticate, validateObjectId('id'), requireSeatOwnerOrAdmin(), async (req, res) => {
  try {
    const id = req.params.id as string
    const seat = await Seat.findById(id)
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

    // Remove this seat from all users' seat_ids
    await User.updateMany({ seat_ids: id }, { $pull: { seat_ids: id } })
    // Clear all schedules for this seat
    await Schedule.deleteMany({ seat_id: id })
    await seat.deleteOne()

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

    // Add seat to user's seat_ids (avoid duplicates)
    await User.findByIdAndUpdate(userId, { $addToSet: { seat_ids: new mongoose.Types.ObjectId(id) } })

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

    res.json({ message: 'Ownership transferred', seat })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
