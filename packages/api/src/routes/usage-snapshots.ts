import { Router } from 'express'
import mongoose from 'mongoose'
import { authenticate, requireAdmin, requireSeatOwnerOrAdmin, validateObjectId } from '../middleware.js'
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
      res.json({ message: 'Skipped: no active token' })
      return
    }
    res.json({ message: 'Usage collected' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/usage-snapshots — query snapshots (auth)
// Query: ?seatId=&from=ISO&to=ISO&limit=50&offset=0&includeRaw=true
router.get('/', authenticate, async (req, res) => {
  try {
    const { seatId, from, to, limit = '50', offset = '0', includeRaw } = req.query
    const filter: Record<string, unknown> = {}

    if (seatId && mongoose.Types.ObjectId.isValid(seatId as string)) {
      filter.seat_id = seatId
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

// GET /api/usage-snapshots/latest — latest per active seat (auth)
router.get('/latest', authenticate, async (_req, res) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const latest = await UsageSnapshot.aggregate([
      { $match: { fetched_at: { $gte: oneDayAgo } } },
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

export default router
