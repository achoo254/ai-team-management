import { Router } from 'express'
import { authenticate } from '../middleware.js'
import { Alert } from '../models/alert.js'
import { User } from '../models/user.js'

const router = Router()

/** Resolve current user's watched seat IDs. */
async function getWatchedSeatIds(userId: string): Promise<string[]> {
  const user = await User.findById(userId, 'watched_seats').lean()
  return (user?.watched_seats ?? []).map((w) => String(w.seat_id))
}

/** Build scope filter: personal alerts + seat-wide alerts for watched seats. */
function buildScopeFilter(userId: string, watchedIds: string[]): Record<string, unknown> {
  return {
    $or: [
      { user_id: userId },
      { user_id: null, seat_id: { $in: watchedIds } },
    ],
  }
}

// GET /api/alerts — feed-style with scope filtering
router.get('/', authenticate, async (req, res) => {
  try {
    const { type, seat, before, limit: limitStr } = req.query as Record<string, string | undefined>
    const limit = Math.min(Math.max(parseInt(limitStr ?? '50', 10) || 50, 1), 100)

    const filter: Record<string, unknown> = {}
    if (type) filter.type = type
    if (before) filter.created_at = { $lt: new Date(before) }

    const userId = String(req.user!._id)
    const watchedIds = await getWatchedSeatIds(userId)
    const scope = buildScopeFilter(userId, watchedIds)
    Object.assign(filter, scope)

    // Narrow by seat if requested
    if (seat) {
      // Keep the OR scope but require seat match
      filter.$and = [
        { seat_id: seat },
      ]
    }

    const alerts = await Alert.find(filter)
      .populate('seat_id', 'email label')
      .sort({ created_at: -1 })
      .limit(limit + 1)
      .lean()

    const has_more = alerts.length > limit
    res.json({ alerts: alerts.slice(0, limit), has_more })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/alerts/mark-read — mark alerts as read for current user
router.post('/mark-read', authenticate, async (req, res) => {
  try {
    const { alert_ids } = req.body
    if (!Array.isArray(alert_ids) || alert_ids.length === 0) {
      res.status(400).json({ error: 'alert_ids required' })
      return
    }

    const userId = String(req.user!._id)
    const watchedIds = await getWatchedSeatIds(userId)
    const scope = buildScopeFilter(userId, watchedIds)

    const result = await Alert.updateMany(
      { _id: { $in: alert_ids }, ...scope },
      { $addToSet: { read_by: req.user!._id } },
    )
    res.json({ updated: result.modifiedCount })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/alerts/unread-count — unread count for bell badge
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const userId = String(req.user!._id)
    const watchedIds = await getWatchedSeatIds(userId)
    const scope = buildScopeFilter(userId, watchedIds)

    const count = await Alert.countDocuments({
      read_by: { $ne: req.user!._id },
      ...scope,
    })
    res.json({ count })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
