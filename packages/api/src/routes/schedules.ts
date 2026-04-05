import { Router } from 'express'
import mongoose from 'mongoose'
import { authenticate, requireAdmin } from '../middleware.js'
import { Schedule } from '../models/schedule.js'
import { SeatActivityLog } from '../models/seat-activity-log.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { Seat } from '../models/seat.js'
import { User } from '../models/user.js'
import { generateAllPatterns } from '../services/activity-pattern-service.js'

const router = Router()

/** Get seat IDs the user is allowed to view */
async function getAllowedSeatIds(userId: string, role: string): Promise<string[] | null> {
  if (role === 'admin') return null // null = all seats
  const currentUser = await User.findById(userId).select('seat_ids').lean()
  const memberSeatIds = (currentUser?.seat_ids ?? []).map(String)
  const ownedSeats = await Seat.find({ owner_id: userId }).select('_id').lean()
  const ownedSeatIds = ownedSeats.map(s => String(s._id))
  return [...new Set([...memberSeatIds, ...ownedSeatIds])]
}

// GET /api/schedules — read auto-generated recurring patterns (read-only)
router.get('/', authenticate, async (req, res) => {
  try {
    const seatId = req.query.seatId as string | undefined
    const filter: Record<string, unknown> = {}

    const allowed = await getAllowedSeatIds(String(req.user!._id), req.user!.role)
    if (allowed !== null) {
      if (seatId) {
        if (!allowed.includes(seatId)) { res.json({ schedules: [] }); return }
        filter.seat_id = seatId
      } else {
        filter.seat_id = { $in: allowed }
      }
    } else if (seatId) {
      filter.seat_id = seatId
    }

    const raw = await Schedule.find(filter)
      .populate('seat_id', 'label')
      .lean()

    const schedules = raw.map((s) => {
      const seat = s.seat_id as unknown as { _id: string; label: string } | null
      return {
        _id: s._id,
        seat_id: seat?._id ?? s.seat_id,
        seat_label: seat?.label ?? '',
        day_of_week: s.day_of_week,
        start_hour: s.start_hour,
        end_hour: s.end_hour,
        source: s.source,
      }
    })

    res.json({ schedules })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/schedules/today — today's predicted patterns
router.get('/today', authenticate, async (req, res) => {
  try {
    const day_of_week = new Date().getDay()
    const filter: Record<string, unknown> = { day_of_week }

    const allowed = await getAllowedSeatIds(String(req.user!._id), req.user!.role)
    if (allowed !== null) {
      filter.seat_id = { $in: allowed }
    }

    const schedules = await Schedule.find(filter)
      .populate('seat_id', 'label email')
      .lean()

    res.json({ schedules })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/schedules/heatmap/:seatId — aggregated activity data for heatmap
router.get('/heatmap/:seatId', authenticate, async (req, res) => {
  try {
    const seatId = req.params.seatId as string
    if (!mongoose.Types.ObjectId.isValid(seatId)) {
      res.status(400).json({ error: 'Invalid seat ID' }); return
    }

    // Permission check
    const allowed = await getAllowedSeatIds(String(req.user!._id), req.user!.role)
    if (allowed !== null && !allowed.includes(seatId)) {
      res.status(403).json({ error: 'No permission' }); return
    }

    const weeks = Math.min(Math.max(parseInt(req.query.weeks as string) || 4, 1), 52)
    const nWeeksAgo = new Date()
    nWeeksAgo.setDate(nWeeksAgo.getDate() - weeks * 7)

    const data = await SeatActivityLog.aggregate([
      { $match: { seat_id: new mongoose.Types.ObjectId(seatId), date: { $gte: nWeeksAgo } } },
      {
        $group: {
          _id: { day: { $dayOfWeek: '$date' }, hour: '$hour' },
          total_active: { $sum: { $cond: ['$is_active', 1, 0] } },
          total_records: { $sum: 1 },
          avg_delta: { $avg: '$delta_5h_pct' },
          max_delta: { $max: '$delta_5h_pct' },
        },
      },
      {
        $project: {
          _id: 0,
          // Convert MongoDB dayOfWeek (1=Sun..7=Sat) → JS (0=Sun..6=Sat)
          day_of_week: { $cond: [{ $eq: ['$_id.day', 1] }, 0, { $subtract: ['$_id.day', 1] }] },
          hour: '$_id.hour',
          activity_rate: { $divide: ['$total_active', { $max: [weeks, '$total_records'] }] },
          avg_delta: 1,
          max_delta: 1,
        },
      },
      { $sort: { day_of_week: 1, hour: 1 } },
    ])

    res.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/schedules/activity-logs — raw activity logs with date range filter
router.get('/activity-logs', authenticate, async (req, res) => {
  try {
    const seatId = req.query.seatId as string | undefined
    const from = req.query.from ? new Date(req.query.from as string) : undefined
    const to = req.query.to ? new Date(req.query.to as string) : undefined
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500)
    const offset = parseInt(req.query.offset as string) || 0

    const filter: Record<string, unknown> = {}

    // Scope to allowed seats
    const allowed = await getAllowedSeatIds(String(req.user!._id), req.user!.role)
    if (seatId) {
      if (allowed !== null && !allowed.includes(seatId)) {
        res.json({ logs: [], total: 0 }); return
      }
      filter.seat_id = new mongoose.Types.ObjectId(seatId)
    } else if (allowed !== null) {
      filter.seat_id = { $in: allowed.map(id => new mongoose.Types.ObjectId(id)) }
    }

    if (from || to) {
      filter.date = {}
      if (from) (filter.date as Record<string, Date>).$gte = from
      if (to) (filter.date as Record<string, Date>).$lte = to
    }

    const [logs, total] = await Promise.all([
      SeatActivityLog.find(filter).sort({ date: -1, hour: -1 }).skip(offset).limit(limit).lean(),
      SeatActivityLog.countDocuments(filter),
    ])

    res.json({ logs, total })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/schedules/realtime — current hour activity status per seat
router.get('/realtime', authenticate, async (req, res) => {
  try {
    const allowed = await getAllowedSeatIds(String(req.user!._id), req.user!.role)
    const seatFilter: Record<string, unknown> = { token_active: true }
    if (allowed !== null) {
      seatFilter._id = { $in: allowed.map(id => new mongoose.Types.ObjectId(id)) }
    }

    const seats = await Seat.find(seatFilter).select('_id label last_fetched_at').lean()
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)

    const results = await Promise.all(seats.map(async (seat) => {
      // Get two most recent snapshots to detect current activity
      const [latest, previous] = await UsageSnapshot.find({ seat_id: seat._id })
        .sort({ fetched_at: -1 }).limit(2).lean()

      let isActive = false
      let currentDelta = 0
      if (latest && previous) {
        const currPct = latest.five_hour_pct ?? 0
        const prevPct = previous.five_hour_pct ?? 0
        const delta = currPct - prevPct
        if (delta > 0) { isActive = true; currentDelta = delta }
        else if (delta < 0 && currPct > 0) { isActive = true; currentDelta = currPct }
      }

      return {
        seat_id: String(seat._id),
        seat_label: seat.label,
        is_active: isActive && latest && new Date(latest.fetched_at) >= fiveMinAgo,
        current_delta: currentDelta,
        last_snapshot_at: latest?.fetched_at?.toISOString() ?? null,
      }
    }))

    res.json({ seats: results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/schedules/regenerate — admin: force regenerate all patterns
router.post('/regenerate', authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await generateAllPatterns()
    res.json({ message: 'Patterns regenerated', ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
