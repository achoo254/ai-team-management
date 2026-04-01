import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware.js'
import { UsageLog } from '../models/usage-log.js'
import { Seat } from '../models/seat.js'
import { getCurrentWeekStart } from '../services/usage-sync-service.js'

const router = Router()

/** Validate that a date string is a Monday */
function isMonday(dateStr: string): boolean {
  const date = new Date(dateStr)
  return !isNaN(date.getTime()) && date.getUTCDay() === 1
}

function clamp(val: number): number {
  return Math.max(0, Math.min(100, val))
}

// POST /api/usage-log/bulk — bulk log usage entries (admin)
router.post('/bulk', authenticate, requireAdmin, async (req, res) => {
  try {
    const { weekStart, entries } = req.body

    if (!weekStart || !isMonday(weekStart)) {
      res.status(400).json({ error: 'weekStart must be a Monday (YYYY-MM-DD)' })
      return
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'entries must be a non-empty array' })
      return
    }

    const results: unknown[] = []
    const errors: { seatId: string; error: string }[] = []

    for (const entry of entries) {
      const { seatId, weeklyAllPct } = entry
      try {
        const doc = await UsageLog.findOneAndUpdate(
          { seat_id: seatId, week_start: weekStart, user_id: req.user!._id },
          {
            weekly_all_pct: clamp(Number(weeklyAllPct ?? 0)),
            logged_at: new Date(),
          },
          { upsert: true, new: true },
        ).lean()
        results.push(doc)
      } catch (err) {
        errors.push({
          seatId,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    res.status(201).json({ results, errors })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/usage-log/week — get week data, optional ?weekStart= (auth)
router.get('/week', authenticate, async (req, res) => {
  try {
    const weekStart = (req.query.weekStart as string | undefined) ?? getCurrentWeekStart()

    const [seats, logs] = await Promise.all([
      Seat.find().lean(),
      UsageLog.find({ week_start: weekStart }).lean(),
    ])

    // Group logs by seat_id — keep entry with latest logged_at
    const logBySeat: Record<string, (typeof logs)[number]> = {}
    for (const log of logs) {
      const key = String(log.seat_id)
      const existing = logBySeat[key]
      if (!existing || log.logged_at > existing.logged_at) {
        logBySeat[key] = log
      }
    }

    const data = seats.map((seat) => {
      const log = logBySeat[String(seat._id)]
      return {
        seatId: seat._id,
        seatEmail: seat.email,
        seatLabel: seat.label,
        team: seat.team,
        weeklyAllPct: log?.weekly_all_pct ?? null,
        loggedAt: log?.logged_at ?? null,
      }
    })

    res.json({ weekStart, seats: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
