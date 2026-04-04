import { Router } from 'express'
import { authenticate } from '../middleware.js'
import { Seat } from '../models/seat.js'
import { User } from '../models/user.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { Alert } from '../models/alert.js'
import { Schedule } from '../models/schedule.js'

const router = Router()

router.use(authenticate)

// GET /api/dashboard/summary — basic stats
router.get('/summary', async (_req, res) => {
  try {
    // Latest snapshot per seat (no time window — TTL index handles cleanup)
    const latestSnapshots = await UsageSnapshot.aggregate([
      { $sort: { fetched_at: -1 } },
      { $group: { _id: '$seat_id', seven_day_pct: { $first: '$seven_day_pct' } } },
    ])
    const valid = latestSnapshots.filter(r => r.seven_day_pct != null)
    const avgAll = valid.length > 0
      ? Math.round(valid.reduce((s, r) => s + r.seven_day_pct, 0) / valid.length)
      : 0

    const activeAlerts = await Alert.countDocuments({ resolved: false })
    const totalSnapshots = await UsageSnapshot.countDocuments()

    res.json({ avgAllPct: avgAll, activeAlerts, totalSnapshots })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/dashboard/enhanced — full dashboard data
router.get('/enhanced', async (_req, res) => {
  try {
    const dayOfWeek = new Date().getDay()

    // User/seat counts
    const [totalUsers, activeUsers, totalSeats] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ active: true }),
      Seat.countDocuments(),
    ])

    // Today's schedules
    const schedules = await Schedule.find({ day_of_week: dayOfWeek })
      .populate('user_id', 'name')
      .populate('seat_id', 'label')
      .sort({ seat_id: 1, slot: 1 })
      .lean()

    const todaySchedules = schedules.map((sc) => ({
      slot: sc.slot,
      name: (sc.user_id as { name?: string } | null)?.name,
      seat_label: (sc.seat_id as { label?: string } | null)?.label,
    }))

    // Unresolved alerts count
    const unresolvedAlerts = await Alert.countDocuments({ resolved: false })

    // Latest snapshot per seat (no time window — TTL index handles cleanup)
    const latestSnapshots = await UsageSnapshot.aggregate([
      { $sort: { fetched_at: -1 } },
      { $group: {
        _id: '$seat_id',
        five_hour_pct: { $first: '$five_hour_pct' },
        seven_day_pct: { $first: '$seven_day_pct' },
      }},
    ])
    const snapshotMap = new Map(latestSnapshots.map(s => [String(s._id), s]))

    const seats = await Seat.find().sort({ _id: 1 }).lean()

    const usagePerSeat = seats.map((s) => ({
      label: s.label,
      team: s.team,
      five_hour_pct: snapshotMap.get(String(s._id))?.five_hour_pct ?? null,
      seven_day_pct: snapshotMap.get(String(s._id))?.seven_day_pct ?? null,
    }))

    // 30-day usage trend (daily avg of seven_day_pct)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const usageTrend = await UsageSnapshot.aggregate([
      { $match: { fetched_at: { $gte: thirtyDaysAgo }, seven_day_pct: { $ne: null } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$fetched_at', timezone: 'Asia/Ho_Chi_Minh' } },
        avg_pct: { $avg: '$seven_day_pct' },
      }},
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', avg_pct: { $round: ['$avg_pct', 0] }, _id: 0 } },
    ])

    // Team usage breakdown — only count seats with actual snapshot data
    const teamUsageCalc: Record<string, { total: number; count: number }> = {}
    for (const s of seats) {
      const team = s.team
      const pct = snapshotMap.get(String(s._id))?.seven_day_pct
      if (!teamUsageCalc[team]) teamUsageCalc[team] = { total: 0, count: 0 }
      if (pct != null) {
        teamUsageCalc[team].total += pct
        teamUsageCalc[team].count++
      }
    }
    const teamUsage = Object.entries(teamUsageCalc).map(([team, data]) => ({
      team,
      avg_pct: Math.round(data.total / data.count) || 0,
    }))

    res.json({
      totalUsers,
      activeUsers,
      totalSeats,
      unresolvedAlerts,
      todaySchedules,
      usagePerSeat,
      usageTrend,
      teamUsage,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/dashboard/usage/by-seat — per-seat usage with user names
router.get('/usage/by-seat', async (_req, res) => {
  try {
    // Latest snapshot per seat (no time window — TTL index handles cleanup)
    const latestSnapshots = await UsageSnapshot.aggregate([
      { $sort: { fetched_at: -1 } },
      { $group: {
        _id: '$seat_id',
        five_hour_pct: { $first: '$five_hour_pct' },
        seven_day_pct: { $first: '$seven_day_pct' },
        last_fetched_at: { $first: '$fetched_at' },
      }},
    ])
    const snapshotMap = new Map(latestSnapshots.map(s => [String(s._id), s]))

    const seats = await Seat.find().lean()
    const users = await User.find({ active: true, seat_ids: { $exists: true, $ne: [] } }, 'name seat_ids').lean()

    // Map seat _id → user names
    const usersBySeatId: Record<string, string[]> = {}
    for (const u of users) {
      for (const seatId of u.seat_ids ?? []) {
        const key = String(seatId)
        if (!usersBySeatId[key]) usersBySeatId[key] = []
        usersBySeatId[key].push(u.name)
      }
    }

    const enriched = seats
      .map((s) => {
        const key = String(s._id)
        const snap = snapshotMap.get(key)
        return {
          seat_id: s._id,
          seat_email: s.email,
          label: s.label,
          team: s.team,
          five_hour_pct: snap?.five_hour_pct ?? null,
          seven_day_pct: snap?.seven_day_pct ?? null,
          last_fetched_at: snap?.last_fetched_at ?? null,
          users: usersBySeatId[key] || [],
        }
      })
      .sort((a, b) => (b.seven_day_pct ?? 0) - (a.seven_day_pct ?? 0))

    res.json({ seats: enriched })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
