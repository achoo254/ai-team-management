import { Router } from 'express'
import { authenticate } from '../middleware.js'
import { Alert } from '../models/alert.js'
import { User } from '../models/user.js'

const router = Router()

// GET /api/alerts — feed-style with scope filtering
router.get('/', authenticate, async (req, res) => {
  try {
    const { type, seat, before, limit: limitStr } = req.query as Record<string, string | undefined>
    const limit = Math.min(Math.max(parseInt(limitStr ?? '50', 10) || 50, 1), 100)

    const filter: Record<string, unknown> = {}
    if (type) filter.type = type
    if (seat) filter.seat_id = seat
    if (before) filter.created_at = { $lt: new Date(before) }

    // Member scope: only watched seats
    if (req.user!.role !== 'admin') {
      const user = await User.findById(req.user!._id, 'watched_seat_ids')
      const watchedIds = (user?.watched_seat_ids ?? []).map(String)
      if (watchedIds.length === 0) {
        res.json({ alerts: [], has_more: false })
        return
      }
      filter.seat_id = seat ? seat : { $in: watchedIds }
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

    const result = await Alert.updateMany(
      { _id: { $in: alert_ids } },
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
    const filter: Record<string, unknown> = {
      read_by: { $ne: req.user!._id },
    }

    // Member scope: only watched seats
    if (req.user!.role !== 'admin') {
      const user = await User.findById(req.user!._id, 'watched_seat_ids')
      const watchedIds = (user?.watched_seat_ids ?? []).map(String)
      if (watchedIds.length === 0) {
        res.json({ count: 0 })
        return
      }
      filter.seat_id = { $in: watchedIds }
    }

    const count = await Alert.countDocuments(filter)
    res.json({ count })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
