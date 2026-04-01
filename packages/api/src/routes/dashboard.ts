import { Router } from 'express'
import { authenticate } from '../middleware.js'
import { Seat } from '../models/seat.js'
import { User } from '../models/user.js'
import { UsageLog } from '../models/usage-log.js'
import { Alert } from '../models/alert.js'
import { Schedule } from '../models/schedule.js'

const router = Router()

router.use(authenticate)

// GET /api/dashboard/summary — basic stats
router.get('/summary', async (_req, res) => {
  try {
    const latestLog = await UsageLog.findOne().sort({ week_start: -1 }).lean()
    const latestWeek = latestLog?.week_start

    let avgAll = 0
    if (latestWeek) {
      const result = await UsageLog.aggregate([
        { $match: { week_start: latestWeek } },
        {
          $group: {
            _id: null,
            avgAll: { $avg: '$weekly_all_pct' },
          },
        },
      ])
      if (result.length > 0) {
        avgAll = Math.round(result[0].avgAll) || 0
      }
    }

    const activeAlerts = await Alert.countDocuments({ resolved: false })
    const totalLogs = await UsageLog.countDocuments()

    res.json({ avgAllPct: avgAll, activeAlerts, totalLogs })
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

    // Latest week usage per seat
    const latestUsage = await UsageLog.aggregate([
      { $sort: { week_start: -1 } },
      {
        $group: {
          _id: '$seat_id',
          weekly_all_pct: { $first: '$weekly_all_pct' },
        },
      },
    ])

    const usageMap: Record<string, { weekly_all_pct: number }> = {}
    for (const u of latestUsage) usageMap[String(u._id)] = u

    const seats = await Seat.find().sort({ _id: 1 }).lean()

    const usagePerSeat = seats.map((s) => ({
      label: s.label,
      team: s.team,
      all_pct: usageMap[String(s._id)]?.weekly_all_pct || 0,
    }))

    // 8-week usage trend
    const usageTrend = await UsageLog.aggregate([
      {
        $group: {
          _id: '$week_start',
          avg_all: { $avg: '$weekly_all_pct' },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 8 },
      {
        $project: {
          week_start: '$_id',
          avg_all: { $round: ['$avg_all', 0] },
          _id: 0,
        },
      },
    ])
    usageTrend.reverse()

    // Team usage breakdown
    const teamUsageCalc: Record<string, { total: number; count: number }> = {}
    for (const s of seats) {
      const team = s.team
      if (!teamUsageCalc[team]) teamUsageCalc[team] = { total: 0, count: 0 }
      teamUsageCalc[team].total += usageMap[String(s._id)]?.weekly_all_pct || 0
      teamUsageCalc[team].count++
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
    // Latest week per seat_id
    const latestUsage = await UsageLog.aggregate([
      { $sort: { week_start: -1 } },
      {
        $group: {
          _id: '$seat_id',
          weekly_all_pct: { $first: '$weekly_all_pct' },
          last_logged: { $first: '$logged_at' },
        },
      },
    ])

    const usageMap: Record<string, { weekly_all_pct: number; last_logged: string }> = {}
    for (const u of latestUsage) usageMap[String(u._id)] = u

    const seats = await Seat.find().lean()
    const users = await User.find({ active: true, seat_ids: { $exists: true, $ne: [] } }, 'name seat_ids').lean()

    // Map seat _id → user names (user can be in multiple seats)
    const usersBySeatId: Record<string, string[]> = {}
    for (const u of users) {
      for (const seatId of u.seat_ids) {
        const key = String(seatId)
        if (!usersBySeatId[key]) usersBySeatId[key] = []
        usersBySeatId[key].push(u.name)
      }
    }

    const enriched = seats
      .map((s) => {
        const key = String(s._id)
        return {
          seat_id: s._id,
          seat_email: s.email,
          label: s.label,
          team: s.team,
          weekly_all_pct: usageMap[key]?.weekly_all_pct || 0,
          last_logged: usageMap[key]?.last_logged || null,
          users: usersBySeatId[key] || [],
        }
      })
      .sort((a, b) => b.weekly_all_pct - a.weekly_all_pct)

    res.json({ seats: enriched })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
