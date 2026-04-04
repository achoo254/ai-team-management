import { Router } from 'express'
import { authenticate } from '../middleware.js'
import { Seat } from '../models/seat.js'
import { User } from '../models/user.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { Alert } from '../models/alert.js'
import { Schedule } from '../models/schedule.js'
import { SessionMetric } from '../models/session-metric.js'
import { ActiveSession } from '../models/active-session.js'

const router = Router()

router.use(authenticate)

// GET /api/dashboard/summary — basic stats
router.get('/summary', async (_req, res) => {
  try {
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

// Range → milliseconds lookup for trend chart date filter
const RANGE_MS: Record<string, number> = {
  day: 1 * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  '3month': 90 * 24 * 60 * 60 * 1000,
  '6month': 180 * 24 * 60 * 60 * 1000,
}

// GET /api/dashboard/enhanced — full dashboard data
// ?range=day|week|month|3month|6month (default: month)
router.get('/enhanced', async (req, res) => {
  try {
    const range = typeof req.query.range === 'string' && RANGE_MS[req.query.range]
      ? req.query.range
      : 'month'
    const dayOfWeek = new Date().getDay()

    // User/seat counts
    const [totalUsers, activeUsers, totalSeats, unresolvedAlerts] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ active: true }),
      Seat.countDocuments(),
      Alert.countDocuments({ resolved: false }),
    ])

    // Today's schedules
    const schedules = await Schedule.find({ day_of_week: dayOfWeek })
      .populate('user_id', 'name')
      .populate('seat_id', 'label')
      .sort({ seat_id: 1, start_hour: 1 })
      .lean()

    const todaySchedules = schedules.map((sc) => ({
      start_hour: sc.start_hour,
      end_hour: sc.end_hour,
      usage_budget_pct: sc.usage_budget_pct,
      name: (sc.user_id as { name?: string } | null)?.name,
      seat_label: (sc.seat_id as { label?: string } | null)?.label,
    }))

    // Seats with unresolved usage_exceeded alerts (for OVER BUDGET badge)
    const budgetAlerts = await Alert.find(
      { type: 'usage_exceeded', resolved: false },
      'seat_id metadata',
    ).lean()
    const overBudgetSeats = budgetAlerts.map((a) => ({
      seat_id: String(a.seat_id),
      user_name: (a.metadata as Record<string, unknown>)?.user_name ?? '',
      delta: (a.metadata as Record<string, unknown>)?.delta ?? 0,
    }))

    // Latest snapshot per seat with model-specific data, reset times, extra_usage
    const latestSnapshots = await UsageSnapshot.aggregate([
      { $sort: { fetched_at: -1 } },
      { $group: {
        _id: '$seat_id',
        five_hour_pct: { $first: '$five_hour_pct' },
        five_hour_resets_at: { $first: '$five_hour_resets_at' },
        seven_day_pct: { $first: '$seven_day_pct' },
        seven_day_resets_at: { $first: '$seven_day_resets_at' },
        seven_day_sonnet_pct: { $first: '$seven_day_sonnet_pct' },
        seven_day_opus_pct: { $first: '$seven_day_opus_pct' },
        extra_usage: { $first: '$extra_usage' },
        last_fetched_at: { $first: '$fetched_at' },
      }},
    ])
    const snapshotMap = new Map(latestSnapshots.map(s => [String(s._id), s]))

    const seats = await Seat.find().sort({ _id: 1 }).lean()

    // Map seat _id → active user names
    const activeUsers_ = await User.find(
      { active: true, seat_ids: { $exists: true, $ne: [] } },
      'name seat_ids',
    ).lean()
    const usersBySeatId: Record<string, string[]> = {}
    for (const u of activeUsers_) {
      for (const seatId of u.seat_ids ?? []) {
        const key = String(seatId)
        if (!usersBySeatId[key]) usersBySeatId[key] = []
        usersBySeatId[key].push(u.name)
      }
    }

    const usagePerSeat = seats.map((s) => {
      const key = String(s._id)
      const snap = snapshotMap.get(key)
      const users = usersBySeatId[key] || []
      return {
        seat_id: key,
        label: s.label,
        team: s.team,
        five_hour_pct: snap?.five_hour_pct ?? null,
        five_hour_resets_at: snap?.five_hour_resets_at ?? null,
        seven_day_pct: snap?.seven_day_pct ?? null,
        seven_day_resets_at: snap?.seven_day_resets_at ?? null,
        seven_day_sonnet_pct: snap?.seven_day_sonnet_pct ?? null,
        seven_day_opus_pct: snap?.seven_day_opus_pct ?? null,
        extra_usage: snap?.extra_usage ?? null,
        last_fetched_at: snap?.last_fetched_at ?? null,
        user_count: users.length,
        max_users: s.max_users,
        users,
      }
    })

    // Usage trend filtered by selected range
    const rangeStart = new Date(Date.now() - RANGE_MS[range])
    // For "day" range, group by hour instead of day for more granular view
    const dateGroupFormat = range === 'day' ? '%Y-%m-%d %H:00' : '%Y-%m-%d'
    const usageTrend = await UsageSnapshot.aggregate([
      { $match: { fetched_at: { $gte: rangeStart } } },
      { $group: {
        _id: { $dateToString: { format: dateGroupFormat, date: '$fetched_at', timezone: 'Asia/Ho_Chi_Minh' } },
        avg_7d_pct: { $avg: { $ifNull: ['$seven_day_pct', null] } },
        avg_5h_pct: { $avg: { $ifNull: ['$five_hour_pct', null] } },
      }},
      { $sort: { _id: 1 } },
      { $project: {
        date: '$_id', _id: 0,
        avg_7d_pct: { $round: [{ $ifNull: ['$avg_7d_pct', 0] }, 1] },
        avg_5h_pct: { $round: [{ $ifNull: ['$avg_5h_pct', 0] }, 1] },
      }},
    ])

    // Team usage breakdown with richer stats
    const teamCalc: Record<string, {
      total_5h: number; count_5h: number
      total_7d: number; count_7d: number
      seat_count: number; user_count: number
    }> = {}
    for (const s of seats) {
      const team = s.team
      const key = String(s._id)
      const snap = snapshotMap.get(key)
      if (!teamCalc[team]) teamCalc[team] = { total_5h: 0, count_5h: 0, total_7d: 0, count_7d: 0, seat_count: 0, user_count: 0 }
      teamCalc[team].seat_count++
      teamCalc[team].user_count += (usersBySeatId[key] || []).length
      if (snap?.five_hour_pct != null) { teamCalc[team].total_5h += snap.five_hour_pct; teamCalc[team].count_5h++ }
      if (snap?.seven_day_pct != null) { teamCalc[team].total_7d += snap.seven_day_pct; teamCalc[team].count_7d++ }
    }
    const teamUsage = Object.entries(teamCalc).map(([team, d]) => ({
      team,
      avg_5h_pct: d.count_5h > 0 ? Math.round(d.total_5h / d.count_5h) : 0,
      avg_7d_pct: d.count_7d > 0 ? Math.round(d.total_7d / d.count_7d) : 0,
      seat_count: d.seat_count,
      user_count: d.user_count,
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
      overBudgetSeats,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/dashboard/usage/by-seat — per-seat usage with user names
router.get('/usage/by-seat', async (_req, res) => {
  try {
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

// GET /api/dashboard/efficiency — usage efficiency metrics
// ?range=week|month|3month (default: month) &seatId= (optional)
router.get('/efficiency', async (req, res) => {
  try {
    const rangeMs = RANGE_MS[typeof req.query.range === 'string' ? req.query.range : 'month'] ?? RANGE_MS.month
    const rangeStart = new Date(Date.now() - rangeMs)
    const seatFilter = req.query.seatId ? { seat_id: req.query.seatId } : {}

    // 1. Aggregated metrics from SessionMetric
    const metrics = await SessionMetric.aggregate([
      { $match: { date: { $gte: rangeStart }, ...seatFilter } },
      { $group: {
        _id: null,
        avg_utilization: { $avg: '$utilization_pct' },
        avg_impact_ratio: { $avg: '$impact_ratio' },
        avg_delta_5h: { $avg: '$delta_5h_pct' },
        avg_delta_7d: { $avg: '$delta_7d_pct' },
        total_sessions: { $sum: 1 },
        waste_sessions: { $sum: { $cond: [{ $and: [{ $gte: ['$duration_hours', 2] }, { $lt: ['$delta_5h_pct', 5] }] }, 1, 0] } },
        total_resets: { $sum: '$reset_count_5h' },
        total_hours: { $sum: '$duration_hours' },
      }},
    ])

    // 2. Per-seat breakdown
    const perSeat = await SessionMetric.aggregate([
      { $match: { date: { $gte: rangeStart }, ...seatFilter } },
      { $group: {
        _id: '$seat_id',
        avg_utilization: { $avg: '$utilization_pct' },
        avg_delta_5h: { $avg: '$delta_5h_pct' },
        avg_delta_7d: { $avg: '$delta_7d_pct' },
        avg_impact_ratio: { $avg: '$impact_ratio' },
        session_count: { $sum: 1 },
        waste_count: { $sum: { $cond: [{ $and: [{ $gte: ['$duration_hours', 2] }, { $lt: ['$delta_5h_pct', 5] }] }, 1, 0] } },
      }},
    ])
    const seatIds = perSeat.map(s => s._id)
    const seatLabels = await Seat.find({ _id: { $in: seatIds } }, 'label').lean()
    const labelMap = new Map(seatLabels.map(s => [String(s._id), s.label]))
    const perSeatWithLabels = perSeat.map(s => ({
      ...s, seat_id: String(s._id), label: labelMap.get(String(s._id)) ?? '', _id: undefined,
    }))

    // 3. Per-user breakdown
    const perUser = await SessionMetric.aggregate([
      { $match: { date: { $gte: rangeStart }, ...seatFilter } },
      { $group: {
        _id: '$user_id',
        avg_utilization: { $avg: '$utilization_pct' },
        avg_delta_5h: { $avg: '$delta_5h_pct' },
        session_count: { $sum: 1 },
        total_hours: { $sum: '$duration_hours' },
      }},
    ])
    const userIds = perUser.map(u => u._id)
    const userNames = await User.find({ _id: { $in: userIds } }, 'name').lean()
    const nameMap = new Map(userNames.map(u => [String(u._id), u.name]))
    const perUserWithNames = perUser.map(u => ({
      ...u, user_id: String(u._id), name: nameMap.get(String(u._id)) ?? '', _id: undefined,
    }))

    // 4. Daily trend
    const dailyTrend = await SessionMetric.aggregate([
      { $match: { date: { $gte: rangeStart }, ...seatFilter } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Ho_Chi_Minh' } },
        avg_utilization: { $avg: '$utilization_pct' },
        avg_delta_5h: { $avg: '$delta_5h_pct' },
        sessions: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', _id: 0, avg_utilization: { $round: ['$avg_utilization', 1] }, avg_delta_5h: { $round: ['$avg_delta_5h', 1] }, sessions: 1 } },
    ])

    // 5. Active sessions (real-time)
    const activeSessions = await ActiveSession.find({}).populate('schedule_id').populate('user_id', 'name').lean()
    const liveMetrics = []
    for (const s of activeSessions) {
      const snap = await UsageSnapshot.findOne({ seat_id: s.seat_id }).sort({ fetched_at: -1 }).lean()
      if (!snap) continue
      const delta5h = Math.max(0, (snap.five_hour_pct ?? 0) - (s.snapshot_at_start.five_hour_pct ?? 0))
      const delta7d = Math.max(0, (snap.seven_day_pct ?? 0) - (s.snapshot_at_start.seven_day_pct ?? 0))
      liveMetrics.push({
        seat_id: String(s.seat_id),
        user_name: (s.user_id as any)?.name ?? '',
        delta_5h: Math.round(delta5h * 10) / 10,
        delta_7d: Math.round(delta7d * 10) / 10,
        reset_count: s.reset_count_5h ?? 0,
        started_at: s.started_at,
      })
    }

    res.json({
      summary: metrics[0] ?? { avg_utilization: 0, avg_impact_ratio: null, total_sessions: 0, waste_sessions: 0, total_resets: 0, total_hours: 0 },
      perSeat: perSeatWithLabels,
      perUser: perUserWithNames,
      dailyTrend,
      activeSessions: liveMetrics,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
