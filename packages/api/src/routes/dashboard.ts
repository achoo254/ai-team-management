import { Router } from 'express'
import mongoose from 'mongoose'
import { authenticate, getAllowedSeatIds } from '../middleware.js'
import { Seat } from '../models/seat.js'
import { User } from '../models/user.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { Alert } from '../models/alert.js'
import { Schedule } from '../models/schedule.js'
import { UsageWindow } from '../models/usage-window.js'
import { computeAllSeatForecasts } from '../services/quota-forecast-service.js'

const router = Router()

/**
 * Strip sensitive data from fetch error messages before sending to client.
 * Removes: OAuth tokens, file paths, API keys (long hex/base64 sequences).
 */
function sanitizeErrorMessage(msg: string): string {
  return msg
    // Remove bearer/access tokens
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [REDACTED]')
    // Remove OAuth tokens (ya29.xxx patterns)
    .replace(/ya29\.[A-Za-z0-9._\-]+/g, '[REDACTED_TOKEN]')
    // Remove long hex strings (API keys, secrets ≥32 chars)
    .replace(/[A-Fa-f0-9]{32,}/g, '[REDACTED]')
    // Remove long base64-like strings ≥40 chars
    .replace(/[A-Za-z0-9+/]{40,}={0,2}/g, '[REDACTED]')
    // Remove absolute file paths
    .replace(/\/[^\s"']+|[A-Z]:\\[^\s"']+/g, '[PATH]')
    .trim()
    // Truncate to 200 chars to prevent huge payloads
    .slice(0, 200)
}

router.use(authenticate)

// GET /api/dashboard/summary — basic stats (scoped to user's seats)
router.get('/summary', async (req, res) => {
  try {
    const allowed = await getAllowedSeatIds(req.user!, true)
    const seatFilter = allowed ? { seat_id: { $in: allowed } } : {}

    const latestSnapshots = await UsageSnapshot.aggregate([
      ...(allowed ? [{ $match: { seat_id: { $in: allowed } } }] : []),
      { $sort: { fetched_at: -1 } },
      { $group: { _id: '$seat_id', seven_day_pct: { $first: '$seven_day_pct' } } },
    ])
    const valid = latestSnapshots.filter(r => r.seven_day_pct != null)
    const avgAll = valid.length > 0
      ? Math.round(valid.reduce((s, r) => s + r.seven_day_pct, 0) / valid.length)
      : 0

    const activeAlerts = await Alert.countDocuments({ resolved: false, ...seatFilter })
    const totalSnapshots = await UsageSnapshot.countDocuments(seatFilter)

    res.json({ avgAllPct: avgAll, activeAlerts, totalSnapshots })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

/** FE sentinel: "unselect all" → filter must return no data (distinct from empty=all). */
const SEAT_FILTER_NONE_SENTINEL = '__NONE__'

/**
 * Parse comma-separated seatIds query param into ObjectId array.
 * - Missing/empty → null (no filter, all seats)
 * - Contains __NONE__ sentinel → empty array (matches no seats)
 * - Valid ObjectIds → array of parsed ids
 * - All invalid → null (no filter)
 */
function parseSeatIds(raw: unknown): mongoose.Types.ObjectId[] | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean)
  // Sentinel → explicitly empty filter (matches nothing)
  if (ids.includes(SEAT_FILTER_NONE_SENTINEL)) return []
  const objectIds = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id))
  return objectIds.length > 0 ? objectIds : null
}

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
    const allowed = await getAllowedSeatIds(req.user!, true)
    const querySeatIds = parseSeatIds(req.query.seatIds)
    // Intersect query filter with allowed seats for non-admin
    const effectiveIds = allowed
      ? (querySeatIds ? querySeatIds.filter((id) => allowed.some((a) => String(a) === String(id))) : allowed)
      : querySeatIds
    const seatMatch = effectiveIds ? { _id: { $in: effectiveIds } } : {}
    const seatIdMatch = effectiveIds ? { seat_id: { $in: effectiveIds } } : {}
    const dayOfWeek = new Date().getDay()

    // User/seat counts (scoped for non-admin)
    const seatCountFilter = effectiveIds ? { _id: { $in: effectiveIds } } : {}
    const userCountFilter = effectiveIds ? { active: true, seat_ids: { $in: effectiveIds } } : { active: true }
    const [totalUsers, activeUsers, totalSeats, unreadAlerts] = await Promise.all([
      effectiveIds ? User.countDocuments({ seat_ids: { $in: effectiveIds } }) : User.countDocuments(),
      User.countDocuments(userCountFilter),
      Seat.countDocuments(seatCountFilter),
      Alert.countDocuments({ read_by: { $ne: req.user!._id }, ...seatIdMatch }),
    ])

    // Today's schedules (scoped)
    const scheduleFilter = effectiveIds
      ? { day_of_week: dayOfWeek, seat_id: { $in: effectiveIds } }
      : { day_of_week: dayOfWeek }
    const schedules = await Schedule.find(scheduleFilter)
      .populate('seat_id', 'label')
      .sort({ seat_id: 1, start_hour: 1 })
      .lean()

    const todaySchedules = schedules.map((sc) => ({
      start_hour: sc.start_hour,
      end_hour: sc.end_hour,
      source: sc.source,
      seat_label: (sc.seat_id as { label?: string } | null)?.label,
    }))

    // Seats with unread usage_exceeded alerts (for OVER BUDGET badge)
    const budgetAlerts = await Alert.find(
      { type: 'usage_exceeded', read_by: { $ne: req.user!._id }, ...seatIdMatch },
      'seat_id metadata',
    ).lean()
    const overBudgetSeats = budgetAlerts.map((a) => ({
      seat_id: String(a.seat_id),
      user_name: (a.metadata as Record<string, unknown>)?.user_name ?? '',
      delta: (a.metadata as Record<string, unknown>)?.delta ?? 0,
    }))

    // Latest snapshot per seat with model-specific data, reset times, extra_usage
    const latestSnapshots = await UsageSnapshot.aggregate([
      ...(effectiveIds ? [{ $match: seatIdMatch }] : []),
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

    const seats = await Seat.find(seatMatch).sort({ _id: 1 }).lean()

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

    // Compute tokenIssueCount from already-fetched seats (no extra query)
    const tokenIssueCount = seats.filter(
      (s) => s.token_active === false || !!s.last_fetch_error,
    ).length

    // Batch-query owner names (1 extra DB query)
    const ownerIds = [...new Set(
      seats.map((s) => s.owner_id).filter(Boolean).map((id) => String(id)),
    )]
    const ownerUsers = ownerIds.length > 0
      ? await User.find({ _id: { $in: ownerIds } }, 'name').lean()
      : []
    const ownerMap = new Map(ownerUsers.map((u) => [String(u._id), u.name]))

    const usagePerSeat = seats.map((s) => {
      const key = String(s._id)
      const snap = snapshotMap.get(key)
      const users = usersBySeatId[key] || []
      return {
        seat_id: key,
        label: s.label,
        owner_name: s.owner_id ? (ownerMap.get(String(s.owner_id)) ?? null) : null,
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

    // Compute fullSeatCount from usagePerSeat (no extra query)
    const fullSeatCount = usagePerSeat.filter((s) => s.user_count >= s.max_users).length

    // Usage trend filtered by selected range
    const rangeStart = new Date(Date.now() - RANGE_MS[range])
    // For "day" range, group by hour instead of day for more granular view
    const dateGroupFormat = range === 'day' ? '%Y-%m-%d %H:00' : '%Y-%m-%d'
    const usageTrend = await UsageSnapshot.aggregate([
      { $match: { fetched_at: { $gte: rangeStart }, ...seatIdMatch } },
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

    // Data quality: stale seats (last_fetched_at older than 6h)
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000
    const now = Date.now()
    const staleSeats = seats
      .filter((s) => s.last_fetched_at != null && now - new Date(s.last_fetched_at).getTime() > SIX_HOURS_MS)
      .map((s) => ({
        seat_id: String(s._id),
        label: s.label,
        hours_since_fetch: Math.floor((now - new Date(s.last_fetched_at!).getTime()) / (60 * 60 * 1000)),
      }))

    // Data quality: seats with token fetch errors (sanitize sensitive data)
    const tokenFailures = seats
      .filter((s) => !!s.last_fetch_error)
      .map((s) => ({
        seat_id: String(s._id),
        label: s.label,
        error_message: sanitizeErrorMessage(s.last_fetch_error!),
        last_fetched_at: s.last_fetched_at ? new Date(s.last_fetched_at).toISOString() : null,
      }))

    // Urgent forecasts: top 3 warning/critical/imminent seats
    const forecastSeatIdsEnhanced = effectiveIds
      ? effectiveIds.map(String)
      : seats.map((s) => String(s._id))
    const allForecasts = await computeAllSeatForecasts(forecastSeatIdsEnhanced)
    const urgentStatuses = new Set(['warning', 'critical', 'imminent'])
    const urgentForecasts = allForecasts
      .filter((f) => urgentStatuses.has(f.status))
      .slice(0, 3)
      .map((f) => ({
        seat_id: f.seat_id,
        seat_label: f.seat_label,
        current_pct: f.current_pct,
        hours_to_full: f.hours_to_full,
        forecast_at: f.forecast_at,
        status: f.status,
      }))

    res.json({
      totalUsers,
      activeUsers,
      totalSeats,
      unreadAlerts,
      tokenIssueCount,
      fullSeatCount,
      todaySchedules,
      usagePerSeat,
      usageTrend,
      overBudgetSeats,
      stale_seats: staleSeats,
      token_failures: tokenFailures,
      urgent_forecasts: urgentForecasts,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/dashboard/usage/by-seat — per-seat usage with user names (scoped)
router.get('/usage/by-seat', async (req, res) => {
  try {
    const allowed = await getAllowedSeatIds(req.user!, true)
    const latestSnapshots = await UsageSnapshot.aggregate([
      ...(allowed ? [{ $match: { seat_id: { $in: allowed } } }] : []),
      { $sort: { fetched_at: -1 } },
      { $group: {
        _id: '$seat_id',
        five_hour_pct: { $first: '$five_hour_pct' },
        seven_day_pct: { $first: '$seven_day_pct' },
        last_fetched_at: { $first: '$fetched_at' },
      }},
    ])
    const snapshotMap = new Map(latestSnapshots.map(s => [String(s._id), s]))

    const seats = await Seat.find(allowed ? { _id: { $in: allowed } } : {}).lean()
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
    const allowed = await getAllowedSeatIds(req.user!, true)
    const querySeatIds = parseSeatIds(req.query.seatIds)
    const effectiveIds = allowed
      ? (querySeatIds ? querySeatIds.filter((id) => allowed.some((a) => String(a) === String(id))) : allowed)
      : querySeatIds
    const singleSeatId = typeof req.query.seatId === 'string' && mongoose.Types.ObjectId.isValid(req.query.seatId)
      ? req.query.seatId : null
    const seatFilter: Record<string, unknown> = effectiveIds
      ? { seat_id: { $in: effectiveIds } }
      : singleSeatId
        ? { seat_id: singleSeatId }
        : {}

    // Base match: closed windows in range (for historical metrics)
    const windowMatch = { window_end: { $gte: rangeStart }, is_closed: true, ...seatFilter }

    // 1. Summary metrics from UsageWindow
    const metrics = await UsageWindow.aggregate([
      { $match: windowMatch },
      { $group: {
        _id: null,
        avg_utilization: { $avg: '$utilization_pct' },
        avg_delta_5h: { $avg: '$utilization_pct' }, // legacy alias
        avg_delta_7d: { $avg: '$delta_7d_pct' },
        avg_sonnet_7d: { $avg: '$delta_7d_sonnet_pct' },
        avg_opus_7d: { $avg: '$delta_7d_opus_pct' },
        peak_max: { $max: '$utilization_pct' },
        peak_min: { $min: '$utilization_pct' },
        stddev_util: { $stdDevPop: '$utilization_pct' },
        // Utilization tier counts (≥80% = đầy, 50-80 = khá, 10-50 = thấp, <10 = lãng phí)
        tier_full: { $sum: { $cond: [{ $gte: ['$utilization_pct', 80] }, 1, 0] } },
        tier_good: { $sum: { $cond: [{ $and: [{ $gte: ['$utilization_pct', 50] }, { $lt: ['$utilization_pct', 80] }] }, 1, 0] } },
        tier_low: { $sum: { $cond: [{ $and: [{ $gte: ['$utilization_pct', 10] }, { $lt: ['$utilization_pct', 50] }] }, 1, 0] } },
        tier_waste: { $sum: { $cond: [{ $lt: ['$utilization_pct', 10] }, 1, 0] } },
        total_sessions: { $sum: 1 },
        waste_sessions: { $sum: { $cond: ['$is_waste', 1, 0] } }, // stale window (keep for compat)
        total_resets: { $sum: 1 }, // each window = 1 cycle
        total_hours: { $sum: '$duration_hours' },
      }},
    ])

    // 1b. Sparkline: last 7 days of closed windows (time-bounded, not count-bounded)
    // Use the more restrictive of [rangeStart, now-7d] so we never exceed range context
    const sparkline7dStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const sparklineWindowStart = sparkline7dStart > rangeStart ? sparkline7dStart : rangeStart
    const sparklineMatch = { ...seatFilter, is_closed: true, window_end: { $gte: sparklineWindowStart } }
    const sparklineRaw = await UsageWindow.aggregate([
      { $match: sparklineMatch },
      { $sort: { window_end: 1 } }, // chronological for chart
      { $project: { _id: 0, seat_id: 1, window_start: 1, window_end: 1, utilization_pct: 1, delta_7d_pct: 1, duration_hours: 1, is_waste: 1 } },
    ])
    // Batch-resolve seat labels
    const sparkSeatIds = [...new Set(sparklineRaw.map((w) => String(w.seat_id)))]
    const sparkSeats = sparkSeatIds.length > 0
      ? await Seat.find({ _id: { $in: sparkSeatIds } }, 'label').lean()
      : []
    const sparkLabelMap = new Map(sparkSeats.map((s) => [String(s._id), s.label]))
    const sparkline = sparklineRaw.map((w) => ({
      seat_id: String(w.seat_id),
      seat_label: sparkLabelMap.get(String(w.seat_id)) ?? '',
      window_start: (w.window_start as Date).toISOString(),
      window_end: (w.window_end as Date).toISOString(),
      utilization_pct: Math.round(w.utilization_pct * 10) / 10,
      delta_7d_pct: Math.round(w.delta_7d_pct * 10) / 10,
      duration_hours: Math.round(w.duration_hours * 10) / 10,
      is_waste: Boolean(w.is_waste),
    }))

    // 2. Per-seat breakdown
    const perSeat = await UsageWindow.aggregate([
      { $match: windowMatch },
      { $group: {
        _id: '$seat_id',
        avg_utilization: { $avg: '$utilization_pct' },
        avg_delta_5h: { $avg: '$utilization_pct' }, // legacy alias
        avg_delta_7d: { $avg: '$delta_7d_pct' },
        session_count: { $sum: 1 },
        waste_count: { $sum: { $cond: ['$is_waste', 1, 0] } },
      }},
    ])
    const seatIds = perSeat.map(s => s._id)
    // Fetch ALL in-scope seats (not just those with windows) so leaderboard shows every seat
    const allInScopeSeats = await Seat.find(
      effectiveIds ? { _id: { $in: effectiveIds } } : {},
      '_id label',
    ).lean()
    const labelMap = new Map(allInScopeSeats.map(s => [String(s._id), s.label]))
    const perSeatMap = new Map(perSeat.map(s => [String(s._id), s]))
    // Merge: seats with window data + seats without (0% utilization)
    const perSeatWithLabels = allInScopeSeats.map(seat => {
      const key = String(seat._id)
      const existing = perSeatMap.get(key)
      if (existing) {
        return { ...existing, seat_id: key, label: labelMap.get(key) ?? '', _id: undefined }
      }
      // Seat has no closed windows → show with 0 values
      return {
        seat_id: key, label: labelMap.get(key) ?? '',
        avg_utilization: 0, avg_delta_5h: 0, avg_delta_7d: 0,
        session_count: 0, waste_count: 0, _id: undefined,
      }
    })

    // 3. Per-user (owner) breakdown
    const perUser = await UsageWindow.aggregate([
      { $match: windowMatch },
      { $group: {
        _id: '$owner_id',
        avg_utilization: { $avg: '$utilization_pct' },
        avg_delta_5h: { $avg: '$utilization_pct' },
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
    const dailyTrend = await UsageWindow.aggregate([
      { $match: windowMatch },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$window_end', timezone: 'Asia/Ho_Chi_Minh' } },
        avg_utilization: { $avg: '$utilization_pct' },
        avg_delta_5h: { $avg: '$utilization_pct' },
        sessions: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', _id: 0, avg_utilization: { $round: ['$avg_utilization', 1] }, avg_delta_5h: { $round: ['$avg_delta_5h', 1] }, sessions: 1 } },
    ])

    // 5. Active windows (open, not closed)
    const activeWindowFilter: Record<string, unknown> = { is_closed: false }
    if (effectiveIds) activeWindowFilter.seat_id = { $in: effectiveIds }
    const activeWins = await UsageWindow.find(activeWindowFilter).lean()
    const activeSeatIds = [...new Set(activeWins.map(w => String(w.seat_id)))]
    const activeSeats = activeSeatIds.length > 0
      ? await Seat.find({ _id: { $in: activeSeatIds } }, 'label').lean()
      : []
    const seatLabelMap = new Map(activeSeats.map(s => [String(s._id), s.label]))
    const liveMetrics = activeWins.map(w => ({
      seat_id: String(w.seat_id),
      user_name: seatLabelMap.get(String(w.seat_id)) ?? '',
      delta_5h: Math.round(w.utilization_pct * 10) / 10,
      delta_7d: Math.round(w.delta_7d_pct * 10) / 10,
      reset_count: 0,
      started_at: w.window_start,
      last_activity_at: w.last_activity_at ?? null,
    }))

    // 6. Coverage: data quality flag
    const seatsWithData = await UsageWindow.distinct('seat_id', windowMatch)
    const totalSeatsInScope = effectiveIds?.length
      ?? (allowed?.length ?? (await Seat.countDocuments()))
    const seatsWithDataStr = new Set(seatsWithData.map(String))
    const missingIds = effectiveIds
      ? effectiveIds.filter(id => !seatsWithDataStr.has(String(id))).map(String)
      : []
    // Resolve missing seat labels for UI display
    const missingSeats = missingIds.length > 0
      ? await Seat.find({ _id: { $in: missingIds } }, 'label').lean()
      : []
    const missingSeatLabels = missingSeats.map(s => s.label)
    const coverage = {
      has_data: seatsWithData.length > 0,
      seats_with_data: seatsWithData.length,
      seats_total: totalSeatsInScope,
      missing_seat_ids: missingIds,
      missing_seat_labels: missingSeatLabels,
    }

    // 7. Quota forecast (7d linear regression across in-scope seats)
    const forecastSeatIds = effectiveIds
      ? effectiveIds.map(String)
      : (await Seat.find({ deleted_at: null }, '_id').lean()).map(s => String(s._id))
    const sevenDayAll = await computeAllSeatForecasts(forecastSeatIds)
    const sevenDayForecast = sevenDayAll[0] ?? null

    // 5h forecast: max utilization across active (open) windows
    const maxFiveHour = activeWins.length > 0
      ? Math.max(...activeWins.map(w => w.utilization_pct))
      : null
    const fiveHourStatus = maxFiveHour == null ? null
      : maxFiveHour >= 80 ? 'critical' : maxFiveHour >= 50 ? 'warning' : 'safe'
    let fiveHourResetsAt: string | null = null
    if (maxFiveHour != null) {
      const maxWin = activeWins.find(w => w.utilization_pct === maxFiveHour)
      if (maxWin) {
        const latest = await UsageSnapshot.findOne(
          { seat_id: maxWin.seat_id },
          'five_hour_resets_at',
        ).sort({ fetched_at: -1 }).lean()
        fiveHourResetsAt = latest?.five_hour_resets_at
          ? new Date(latest.five_hour_resets_at).toISOString()
          : null
      }
    }
    const fiveHourForecast = maxFiveHour == null ? null
      : {
        current_pct: Math.round(maxFiveHour * 10) / 10,
        status: fiveHourStatus as 'safe' | 'warning' | 'critical',
        resets_at: fiveHourResetsAt,
      }

    // Top/Bottom seats from perSeat (overlap-safe split, reuses /personal logic).
    // N ≤ 3: show all in top, skip bottom. N ≥ 4: half-split (max 3 each side).
    const rankedSeats = [...perSeatWithLabels].sort((a, b) => b.avg_utilization - a.avg_utilization)
    const n = rankedSeats.length
    const k = n <= 3 ? n : Math.min(3, Math.floor(n / 2))
    const topSeats = rankedSeats.slice(0, k).map(s => ({
      seat_id: s.seat_id, label: s.label,
      avg_utilization: Math.round(s.avg_utilization * 10) / 10,
      session_count: s.session_count,
    }))
    const bottomSeats = n <= 3 ? [] : rankedSeats.slice(-k).reverse().map(s => ({
      seat_id: s.seat_id, label: s.label,
      avg_utilization: Math.round(s.avg_utilization * 10) / 10,
      session_count: s.session_count,
    }))

    res.json({
      summary: metrics[0] ?? {
        avg_utilization: 0,
        avg_delta_5h: 0, avg_delta_7d: 0,
        avg_sonnet_7d: 0, avg_opus_7d: 0,
        peak_max: 0, peak_min: 0, stddev_util: 0,
        tier_full: 0, tier_good: 0, tier_low: 0, tier_waste: 0,
        total_sessions: 0, waste_sessions: 0, total_resets: 0, total_hours: 0,
      },
      sparkline,
      perSeat: perSeatWithLabels,
      perUser: perUserWithNames,
      dailyTrend,
      activeSessions: liveMetrics,
      topSeats,
      bottomSeats,
      coverage,
      quota_forecast: { seven_day: sevenDayForecast, seven_day_seats: sevenDayAll, five_hour: fiveHourForecast },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/dashboard/peak-hours — 7x24 heatmap of usage activity
router.get('/peak-hours', async (req, res) => {
  try {
    const rangeMs = RANGE_MS[typeof req.query.range === 'string' ? req.query.range : 'month'] ?? RANGE_MS.month
    const rangeStart = new Date(Date.now() - rangeMs)
    const allowed = await getAllowedSeatIds(req.user!, true)
    const querySeatIds = parseSeatIds(req.query.seatIds)
    const effectiveIds = allowed
      ? (querySeatIds ? querySeatIds.filter((id) => allowed.some((a) => String(a) === String(id))) : allowed)
      : querySeatIds
    const seatFilter = effectiveIds ? { seat_id: { $in: effectiveIds } } : {}

    // Include both open + closed windows so today's usage shows up immediately.
    // Metric: utilization_pct (% of 5h budget used) — intuitive for non-technical users.
    const grid = await UsageWindow.aggregate([
      { $match: { window_end: { $gte: rangeStart }, peak_hour_of_day: { $ne: null }, ...seatFilter } },
      { $addFields: { dow: { $dayOfWeek: { date: '$window_end', timezone: 'Asia/Ho_Chi_Minh' } } } },
      { $group: {
        _id: { dow: '$dow', hour: '$peak_hour_of_day' },
        avg_util: { $avg: '$utilization_pct' },
        max_util: { $max: '$utilization_pct' },
        window_count: { $sum: 1 },
      }},
      { $project: {
        dow: { $subtract: ['$_id.dow', 1] }, // normalize Mongo 1-7 → JS 0-6
        hour: '$_id.hour', _id: 0,
        avg_util: { $round: ['$avg_util', 1] },
        max_util: { $round: ['$max_util', 1] },
        window_count: 1,
      }},
    ])

    res.json({ grid })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/dashboard/personal — user-scoped dashboard data
// Auth: any logged-in user (authenticate applied at router level)
router.get('/personal', async (req, res) => {
  try {
    const userId = req.user!._id
    // Aggregate $match does NOT auto-cast string → ObjectId (unlike Mongoose .find()).
    // Pre-cast once for all aggregate pipelines below.
    const userObjectId = new mongoose.Types.ObjectId(userId)
    const todayDow = new Date().getDay() // 0=Sunday … 6=Saturday

    // 1. Today's activity patterns for user's seats
    const userRecord0 = await User.findById(userId, 'seat_ids').lean()
    const userSeatIds = (userRecord0?.seat_ids ?? []).map(String)
    const ownedSeats0 = await Seat.find({ owner_id: userId }, '_id').lean()
    const allUserSeatIds = [...new Set([...userSeatIds, ...ownedSeats0.map(s => String(s._id))])]

    const rawSchedules = await Schedule.find({
      seat_id: { $in: allUserSeatIds },
      day_of_week: todayDow,
    })
      .populate<{ seat_id: { _id: unknown; label: string } }>('seat_id', 'label')
      .sort({ start_hour: 1 })
      .lean()

    const mySchedulesToday = rawSchedules.map((sc) => ({
      seat_label: (sc.seat_id as { label?: string } | null)?.label ?? '',
      start_hour: sc.start_hour,
      end_hour: sc.end_hour,
      source: sc.source,
    }))

    // 2. Seats this user owns + seats they are assigned to (role distinction)
    const [ownedSeats, userRecord] = await Promise.all([
      Seat.find({ owner_id: userId }, 'label').lean(),
      User.findById(userId, 'seat_ids').lean(),
    ])

    const ownedIds = new Set(ownedSeats.map((s) => String(s._id)))

    // Seats assigned via seat_ids that are NOT owned (role=member)
    const assignedIds = (userRecord?.seat_ids ?? []).filter((id) => !ownedIds.has(String(id)))
    const memberSeats = assignedIds.length > 0
      ? await Seat.find({ _id: { $in: assignedIds } }, 'label').lean()
      : []

    const mySeats = [
      ...ownedSeats.map((s) => ({ seat_id: String(s._id), label: s.label, role: 'owner' as const })),
      ...memberSeats.map((s) => ({ seat_id: String(s._id), label: s.label, role: 'member' as const })),
    ]

    // 3. Usage rank — avg utilization per owner over last 30 days
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const rankAgg = await UsageWindow.aggregate([
      { $match: { window_end: { $gte: since }, is_closed: true } },
      { $group: { _id: '$owner_id', avgDelta5h: { $avg: '$utilization_pct' } } },
      { $sort: { avgDelta5h: -1 } }, // higher util = more efficient
    ])

    let myUsageRank: { rank: number; total: number; avgDelta5h: number } | null = null
    if (rankAgg.length > 0) {
      const idx = rankAgg.findIndex((r) => String(r._id) === String(userId))
      if (idx !== -1) {
        myUsageRank = {
          rank: idx + 1,
          total: rankAgg.length,
          avgDelta5h: Math.round(rankAgg[idx].avgDelta5h * 10) / 10,
        }
      }
    }

    // 4. My Efficiency — per-owner aggregation across owned seats
    const myWindowMatch = { owner_id: userObjectId, window_end: { $gte: since }, is_closed: true }
    const [mySummaryAgg, mySeatsAgg] = await Promise.all([
      UsageWindow.aggregate([
        { $match: myWindowMatch },
        { $group: {
          _id: null,
          my_avg_utilization: { $avg: '$utilization_pct' },
          my_waste_count: { $sum: { $cond: ['$is_waste', 1, 0] } },
          my_sonnet_avg: { $avg: '$delta_7d_sonnet_pct' },
          my_opus_avg: { $avg: '$delta_7d_opus_pct' },
          my_window_count: { $sum: 1 },
        }},
      ]),
      UsageWindow.aggregate([
        { $match: myWindowMatch },
        { $group: {
          _id: '$seat_id',
          avg_utilization: { $avg: '$utilization_pct' },
          window_count: { $sum: 1 },
        }},
        { $sort: { avg_utilization: -1 } },
      ]),
    ])
    const mySeatIds = mySeatsAgg.map((s) => s._id)
    const mySeatLabels = await Seat.find({ _id: { $in: mySeatIds } }, 'label').lean()
    const myLabelMap = new Map(mySeatLabels.map((s) => [String(s._id), s.label]))
    const rankedSeats = mySeatsAgg.map((s) => ({
      seat_id: String(s._id),
      label: myLabelMap.get(String(s._id)) ?? '',
      avg_utilization: Math.round(s.avg_utilization * 10) / 10,
      window_count: s.window_count,
    }))
    // Split top/bottom so they never overlap.
    // N ≤ 3: show all in top, skip bottom. N ≥ 4: half-split (max 3 each side).
    const n = rankedSeats.length
    const k = n <= 3 ? n : Math.min(3, Math.floor(n / 2))
    const myTopSeats = rankedSeats.slice(0, k)
    const myBottomSeats = n <= 3 ? [] : rankedSeats.slice(-k).reverse()

    const mySummary = mySummaryAgg[0] ?? null
    const myEfficiency = mySummary
      ? {
          my_avg_utilization: Math.round(mySummary.my_avg_utilization * 10) / 10,
          my_waste_count: mySummary.my_waste_count,
          my_window_count: mySummary.my_window_count,
          my_sonnet_avg: Math.round(mySummary.my_sonnet_avg * 10) / 10,
          my_opus_avg: Math.round(mySummary.my_opus_avg * 10) / 10,
          my_top_seats: myTopSeats,
          my_bottom_seats: myBottomSeats,
        }
      : null

    res.json({ mySchedulesToday, mySeats, myUsageRank, myEfficiency })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
