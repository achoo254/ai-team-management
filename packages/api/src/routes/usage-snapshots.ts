import { Router } from 'express'
import mongoose from 'mongoose'
import { authenticate, requireAdmin, requireSeatOwnerOrAdmin, validateObjectId, getAllowedSeatIds } from '../middleware.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { collectAllUsage, collectSeatUsage } from '../services/usage-collector-service.js'

const router = Router()

// POST /api/usage-snapshots/collect — trigger collect all (admin)
router.post('/collect', authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await collectAllUsage()
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/usage-snapshots/collect/:seatId — trigger single seat (owner or admin)
router.post('/collect/:seatId', authenticate, validateObjectId('seatId'), requireSeatOwnerOrAdmin('seatId'), async (req, res) => {
  try {
    const seatId = req.params.seatId as string
    const result = await collectSeatUsage(seatId)
    if (result.skipped) {
      if (result.reason?.startsWith('rate_limited')) {
        const waitSec = result.reason.split(':')[1] ?? '60'
        res.status(429).json({ error: `Vừa cập nhật rồi. Vui lòng chờ ${waitSec}s.` })
        return
      }
      res.json({ message: 'Skipped: no active token' })
      return
    }
    res.json({ message: 'Usage collected' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/usage-snapshots — query snapshots (scoped to user's seats)
// Query: ?seatId=&from=ISO&to=ISO&limit=50&offset=0&includeRaw=true
router.get('/', authenticate, async (req, res) => {
  try {
    const allowed = await getAllowedSeatIds(req.user!)
    const { seatId, from, to, limit = '50', offset = '0', includeRaw } = req.query
    const filter: Record<string, unknown> = {}

    if (seatId && mongoose.Types.ObjectId.isValid(seatId as string)) {
      // Validate access to requested seat
      if (allowed && !allowed.some((id) => String(id) === seatId)) {
        res.status(403).json({ error: 'Access denied to this seat' })
        return
      }
      filter.seat_id = seatId
    } else if (allowed) {
      // No specific seat requested: scope to allowed seats
      filter.seat_id = { $in: allowed }
    }
    if (from || to) {
      const dateFilter: Record<string, Date> = {}
      if (from) dateFilter.$gte = new Date(from as string)
      if (to) dateFilter.$lte = new Date(to as string)
      filter.fetched_at = dateFilter
    }

    // Exclude raw_response by default to reduce payload size
    const projection = includeRaw === 'true' ? {} : { raw_response: 0 }

    const [snapshots, total] = await Promise.all([
      UsageSnapshot.find(filter, projection)
        .sort({ fetched_at: -1 })
        .limit(Math.min(Number(limit), 200))
        .skip(Number(offset))
        .lean(),
      UsageSnapshot.countDocuments(filter),
    ])

    res.json({ snapshots, total })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/usage-snapshots/latest — latest per active seat (scoped)
router.get('/latest', authenticate, async (req, res) => {
  try {
    const allowed = await getAllowedSeatIds(req.user!)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const matchFilter = allowed
      ? { fetched_at: { $gte: oneDayAgo }, seat_id: { $in: allowed } }
      : { fetched_at: { $gte: oneDayAgo } }
    const latest = await UsageSnapshot.aggregate([
      { $match: matchFilter },
      { $sort: { fetched_at: -1 } },
      { $group: {
        _id: '$seat_id',
        snapshot: { $first: '$$ROOT' },
      }},
      { $replaceRoot: { newRoot: '$snapshot' } },
      { $project: { raw_response: 0 } },
      { $sort: { seat_id: 1 } },
    ])

    res.json({ snapshots: latest })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/usage-snapshots/pre-reset-history — peak 7d usage per reset cycle
// Detects usage "cycles" (continuous >0% periods between resets to 0%).
// Returns the MAX seven_day_pct per cycle per seat — the true peak before reset.
// Query: ?weeks=8 (default 8 weeks of history)
router.get('/pre-reset-history', authenticate, async (req, res) => {
  try {
    const allowed = await getAllowedSeatIds(req.user!, true)
    const weeks = Math.min(Number(req.query.weeks) || 8, 26)
    const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000)

    const matchFilter: Record<string, unknown> = { fetched_at: { $gte: since } }
    if (allowed) matchFilter.seat_id = { $in: allowed }

    const results = await UsageSnapshot.aggregate([
      { $match: matchFilter },
      { $sort: { seat_id: 1, fetched_at: 1 } },
      // Normalize null → 0 for cycle detection
      { $addFields: { pct: { $ifNull: ['$seven_day_pct', 0] } } },
      // Peek at prev/next pct per seat
      {
        $setWindowFields: {
          partitionBy: '$seat_id',
          sortBy: { fetched_at: 1 },
          output: {
            prev_pct: { $shift: { output: '$pct', by: -1, default: 0 } },
            next_pct: { $shift: { output: '$pct', by: 1, default: -1 } },
          },
        },
      },
      // Mark cycle start: pct goes from 0 → >0
      {
        $addFields: {
          is_cycle_start: {
            $cond: [{ $and: [{ $gt: ['$pct', 0] }, { $lte: ['$prev_pct', 0] }] }, 1, 0],
          },
        },
      },
      // Assign cycle_id via running sum of cycle starts
      {
        $setWindowFields: {
          partitionBy: '$seat_id',
          sortBy: { fetched_at: 1 },
          output: {
            cycle_id: { $sum: '$is_cycle_start', window: { documents: ['unbounded', 'current'] } },
          },
        },
      },
      // Only non-zero snapshots
      { $match: { pct: { $gt: 0 } } },
      // Group by (seat, cycle): peak usage + check if cycle completed (next was 0)
      {
        $group: {
          _id: { seat_id: '$seat_id', cycle_id: '$cycle_id' },
          seven_day_pct: { $max: '$seven_day_pct' },
          seven_day_sonnet_pct: { $max: '$seven_day_sonnet_pct' },
          seven_day_opus_pct: { $max: '$seven_day_opus_pct' },
          fetched_at: { $last: '$fetched_at' },
          // A cycle is completed if any snapshot in it has next_pct = 0
          is_completed: { $max: { $cond: [{ $eq: ['$next_pct', 0] }, 1, 0] } },
        },
      },
      // Only completed cycles with meaningful usage — exclude noise blips (≤5%) and ongoing cycle
      { $match: { is_completed: 1, seven_day_pct: { $gt: 5 } } },
      {
        $project: {
          _id: 0,
          seat_id: '$_id.seat_id',
          seven_day_pct: 1,
          seven_day_sonnet_pct: 1,
          seven_day_opus_pct: 1,
          fetched_at: 1,
        },
      },
      { $sort: { fetched_at: -1 } },
    ])

    res.json({ history: results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
