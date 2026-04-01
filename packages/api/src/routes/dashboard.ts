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

    let avgAll = 0, avgSonnet = 0
    if (latestWeek) {
      const result = await UsageLog.aggregate([
        { $match: { week_start: latestWeek } },
        {
          $group: {
            _id: null,
            avgAll: { $avg: '$weekly_all_pct' },
            avgSonnet: { $avg: '$weekly_sonnet_pct' },
          },
        },
      ])
      if (result.length > 0) {
        avgAll = Math.round(result[0].avgAll) || 0
        avgSonnet = Math.round(result[0].avgSonnet) || 0
      }
    }

    const activeAlerts = await Alert.countDocuments({ resolved: false })
    const totalLogs = await UsageLog.countDocuments()

    res.json({ avgAllPct: avgAll, avgSonnetPct: avgSonnet, activeAlerts, totalLogs })
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
          _id: '$seat_email',
          weekly_all_pct: { $first: '$weekly_all_pct' },
          weekly_sonnet_pct: { $first: '$weekly_sonnet_pct' },
        },
      },
    ])

    const usageMap: Record<string, { weekly_all_pct: number; weekly_sonnet_pct: number }> = {}
    for (const u of latestUsage) usageMap[u._id] = u

    const seats = await Seat.find().sort({ _id: 1 }).lean()

    const usagePerSeat = seats.map((s) => ({
      label: s.label,
      team: s.team,
      all_pct: usageMap[s.email]?.weekly_all_pct || 0,
      sonnet_pct: usageMap[s.email]?.weekly_sonnet_pct || 0,
    }))

    // 8-week usage trend
    const usageTrend = await UsageLog.aggregate([
      {
        $group: {
          _id: '$week_start',
          avg_all: { $avg: '$weekly_all_pct' },
          avg_sonnet: { $avg: '$weekly_sonnet_pct' },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 8 },
      {
        $project: {
          week_start: '$_id',
          avg_all: { $round: ['$avg_all', 0] },
          avg_sonnet: { $round: ['$avg_sonnet', 0] },
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
      teamUsageCalc[team].total += usageMap[s.email]?.weekly_all_pct || 0
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
    // Latest week per seat_email
    const latestUsage = await UsageLog.aggregate([
      { $sort: { week_start: -1 } },
      {
        $group: {
          _id: '$seat_email',
          weekly_all_pct: { $first: '$weekly_all_pct' },
          weekly_sonnet_pct: { $first: '$weekly_sonnet_pct' },
          last_logged: { $first: '$week_start' },
        },
      },
    ])

    const usageMap: Record<string, { weekly_all_pct: number; weekly_sonnet_pct: number; last_logged: string }> = {}
    for (const u of latestUsage) usageMap[u._id] = u

    const seats = await Seat.find().lean()
    const users = await User.find({ active: true, seat_id: { $ne: null } }, 'name seat_id').lean()

    // Map seat _id → email
    const seatIdToEmail: Record<string, string> = {}
    for (const s of seats) seatIdToEmail[String(s._id)] = s.email

    // Map seat email → user names
    const usersBySeatEmail: Record<string, string[]> = {}
    for (const u of users) {
      const seatEmail = seatIdToEmail[String(u.seat_id)]
      if (seatEmail) {
        if (!usersBySeatEmail[seatEmail]) usersBySeatEmail[seatEmail] = []
        usersBySeatEmail[seatEmail].push(u.name)
      }
    }

    const enriched = seats
      .map((s) => ({
        seat_id: s._id,
        seat_email: s.email,
        label: s.label,
        team: s.team,
        weekly_all_pct: usageMap[s.email]?.weekly_all_pct || 0,
        weekly_sonnet_pct: usageMap[s.email]?.weekly_sonnet_pct || 0,
        last_logged: usageMap[s.email]?.last_logged || null,
        users: usersBySeatEmail[s.email] || [],
      }))
      .sort((a, b) => b.weekly_all_pct - a.weekly_all_pct)

    res.json({ seats: enriched })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
