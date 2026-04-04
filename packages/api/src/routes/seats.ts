import { Router } from 'express'
import mongoose from 'mongoose'
import { authenticate, requireAdmin } from '../middleware.js'
import { Seat } from '../models/seat.js'
import { encrypt, decrypt } from '../services/crypto-service.js'
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

// GET /api/seats — list seats with assigned users (auth)
router.get('/', authenticate, async (_req, res) => {
  try {
    // Use select('+oauth_credential') so toJSON strips tokens but keeps metadata
    const seats = await Seat.find().select('+oauth_credential').sort({ _id: 1 }).lean()
    const users = await User.find(
      { active: true, seat_ids: { $exists: true, $ne: [] } },
      'name email seat_ids team',
    ).lean()

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
      return {
        ...seatObj,
        has_token: !!seat.token_active,
        users: (usersBySeat[String(seat._id)] || []).map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          team: u.team ?? seat.team,
        })),
      }
    })

    res.json({ seats: enriched })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/seats/credentials/export — export all seats' decrypted credentials (admin)
// Must be before /:id routes to avoid param matching
router.get('/credentials/export', authenticate, requireAdmin, async (req, res) => {
  try {
    console.log(`[AUDIT] Credential export by user=${req.user!.email} ip=${req.ip} at ${new Date().toISOString()}`)

    const seats = await Seat.find({ token_active: true }).select('+oauth_credential').lean()
    const credentials = seats
      .filter((s) => s.oauth_credential?.access_token)
      .map((s) => {
        const cred = s.oauth_credential!
        return {
          seat_label: s.label,
          seat_email: s.email,
          claudeAiOauth: {
            accessToken: cred.access_token ? decrypt(cred.access_token) : null,
            refreshToken: cred.refresh_token ? decrypt(cred.refresh_token) : null,
            expiresAt: cred.expires_at ? new Date(cred.expires_at).getTime() : null,
            scopes: cred.scopes ?? [],
            subscriptionType: cred.subscription_type ?? null,
            rateLimitTier: cred.rate_limit_tier ?? null,
          },
        }
      })
    res.json({ credentials })
  } catch (error) {
    console.error('[Credential Export] Failed:', error)
    res.status(500).json({ error: 'Credential export failed' })
  }
})

// POST /api/seats — create seat (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { email, label, team, max_users } = req.body

    if (!email || !label || !team) {
      res.status(400).json({ error: 'email, label, team are required' })
      return
    }

    const seat = await Seat.create({ email, label, team, max_users })
    res.status(201).json(seat)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/seats/:id — update seat (admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }

    const allowed = ['email', 'label', 'team', 'max_users']
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

// DELETE /api/seats/:id — delete seat, unassign users, clear schedules (admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }

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

// POST /api/seats/:id/assign — assign user to seat (admin)
router.post('/:id/assign', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }

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

// DELETE /api/seats/:id/unassign/:userId — unassign user + clear their schedules (admin)
router.delete('/:id/unassign/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string
    const userId = req.params.userId as string

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }
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

// PUT /api/seats/:id/token — set/update OAuth credential (admin)
router.put('/:id/token', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }

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

// DELETE /api/seats/:id/token — remove credential (admin)
router.delete('/:id/token', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }

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

export default router
