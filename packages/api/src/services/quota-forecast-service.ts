import { UsageSnapshot } from '../models/usage-snapshot.js'
import { Seat } from '../models/seat.js'

export type QuotaForecastStatus =
  | 'safe' | 'watch' | 'warning' | 'critical' | 'imminent'
  | 'safe_decreasing' | 'collecting' | 'reset_first'

export interface SeatForecast {
  seat_id: string
  seat_label: string
  current_pct: number
  slope_per_hour: number
  hours_to_full: number | null
  forecast_at: string | null
  status: QuotaForecastStatus
  resets_at: string | null
}

export type QuotaForecastResult = SeatForecast

interface Point { x: number; y: number }

/**
 * Simple OLS linear regression.
 * @returns slope and intercept; slope=0 if insufficient variance.
 */
export function linearRegression(points: Point[]): { slope: number; intercept: number } {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 }
  const xBar = points.reduce((s, p) => s + p.x, 0) / n
  const yBar = points.reduce((s, p) => s + p.y, 0) / n
  let num = 0, den = 0
  for (const p of points) {
    num += (p.x - xBar) * (p.y - yBar)
    den += (p.x - xBar) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = yBar - slope * xBar
  return { slope, intercept }
}

/**
 * Classify urgency band by hours-to-full.
 * >168h=safe, 48-168=watch, 24-48=warning, 6-24=critical, <6=imminent.
 */
export function classifyStatus(hoursToFull: number): QuotaForecastStatus {
  if (hoursToFull > 168) return 'safe'
  if (hoursToFull >= 48) return 'watch'
  if (hoursToFull >= 24) return 'warning'
  if (hoursToFull >= 6) return 'critical'
  return 'imminent'
}

/**
 * Forecast when a single seat will hit 100% of seven-day quota.
 *
 * Strategy: cycle-to-date average rate.
 * Cycle spans [resets_at - 7d, resets_at]. Rate = current_pct / hours_since_reset.
 * Physically meaningful ("pace trung bình chu kỳ"), naturally stable (many
 * snapshots, outliers diluted), and day-to-day swing stays well under 1 day.
 */
export async function forecastSeatQuota(
  seatId: string,
  seatLabel: string,
  now: Date = new Date(),
): Promise<SeatForecast> {
  // Latest snapshot gives current_pct + resets_at that anchor the current cycle.
  const latest = await UsageSnapshot.findOne(
    { seat_id: seatId, seven_day_pct: { $ne: null } },
    'seven_day_pct seven_day_resets_at fetched_at',
  ).sort({ fetched_at: -1 }).lean()

  if (!latest) {
    return {
      seat_id: seatId, seat_label: seatLabel,
      current_pct: 0, slope_per_hour: 0, hours_to_full: null, forecast_at: null,
      status: 'collecting', resets_at: null,
    }
  }

  const currentPct = latest.seven_day_pct ?? 0
  const latestResetsAt = latest.seven_day_resets_at ?? null
  const resetsAtIso = latestResetsAt ? new Date(latestResetsAt).toISOString() : null

  if (!latestResetsAt) {
    return {
      seat_id: seatId, seat_label: seatLabel,
      current_pct: currentPct, slope_per_hour: 0, hours_to_full: null, forecast_at: null,
      status: 'collecting', resets_at: null,
    }
  }

  const cycleStart = new Date(new Date(latestResetsAt).getTime() - 7 * 24 * 3600_000)
  const hoursSinceReset = (now.getTime() - cycleStart.getTime()) / 3600_000

  // Too early in cycle: rate estimate from <3h data is noisy.
  if (hoursSinceReset < 3) {
    return {
      seat_id: seatId, seat_label: seatLabel,
      current_pct: currentPct, slope_per_hour: 0, hours_to_full: null, forecast_at: null,
      status: 'collecting', resets_at: resetsAtIso,
    }
  }

  if (currentPct >= 100) {
    return {
      seat_id: seatId, seat_label: seatLabel,
      current_pct: currentPct, slope_per_hour: 0,
      hours_to_full: 0, forecast_at: now.toISOString(), status: 'imminent',
      resets_at: resetsAtIso,
    }
  }

  // Decrease detection: compare earliest in-cycle snap with latest.
  // Guards against API data corrections / anomalies that briefly drop pct.
  const earliest = await UsageSnapshot.findOne(
    { seat_id: seatId, seven_day_pct: { $ne: null }, fetched_at: { $gte: cycleStart } },
    'seven_day_pct',
  ).sort({ fetched_at: 1 }).lean()
  if (earliest && currentPct < (earliest.seven_day_pct ?? 0) - 1) {
    return {
      seat_id: seatId, seat_label: seatLabel,
      current_pct: currentPct, slope_per_hour: 0, hours_to_full: null, forecast_at: null,
      status: 'safe_decreasing', resets_at: resetsAtIso,
    }
  }

  if (currentPct <= 0) {
    return {
      seat_id: seatId, seat_label: seatLabel,
      current_pct: currentPct, slope_per_hour: 0, hours_to_full: null, forecast_at: null,
      status: 'safe_decreasing', resets_at: resetsAtIso,
    }
  }

  const rate = currentPct / hoursSinceReset
  const hoursToFull = (100 - currentPct) / rate
  const forecastAt = new Date(now.getTime() + hoursToFull * 3600_000).toISOString()

  // Cap by reset: if seat resets before exhausting, quota restarts → reset_first.
  const hoursToReset = (new Date(latestResetsAt).getTime() - now.getTime()) / 3600_000
  if (hoursToReset > 0 && hoursToFull > hoursToReset) {
    return {
      seat_id: seatId, seat_label: seatLabel,
      current_pct: currentPct, slope_per_hour: rate,
      hours_to_full: hoursToFull, forecast_at: forecastAt,
      status: 'reset_first', resets_at: resetsAtIso,
    }
  }

  return {
    seat_id: seatId, seat_label: seatLabel,
    current_pct: currentPct, slope_per_hour: rate,
    hours_to_full: hoursToFull, forecast_at: forecastAt,
    status: classifyStatus(hoursToFull),
    resets_at: resetsAtIso,
  }
}

/**
 * Run forecast across seats, return the worst (smallest hours_to_full).
 * Falls back to safest if no seat is trending up.
 */
export async function computeQuotaForecast(
  seatIds: string[],
  now: Date = new Date(),
): Promise<QuotaForecastResult | null> {
  const all = await computeAllSeatForecasts(seatIds, now)
  return all[0] ?? null
}

/**
 * Run forecast across seats, return ALL sorted by urgency:
 * trending-up seats first (smallest hours_to_full first),
 * then safe_decreasing/collecting sorted by highest current_pct.
 */
export async function computeAllSeatForecasts(
  seatIds: string[],
  now: Date = new Date(),
): Promise<SeatForecast[]> {
  if (seatIds.length === 0) return []
  const seats = await Seat.find({ _id: { $in: seatIds } }, 'label').lean()
  const labelMap = new Map(seats.map(s => [String(s._id), s.label]))
  const forecasts = await Promise.all(
    seatIds.map(id => forecastSeatQuota(id, labelMap.get(String(id)) ?? '', now)),
  )
  const trending = forecasts.filter(f => f.hours_to_full != null && f.status !== 'reset_first')
    .sort((a, b) => a.hours_to_full! - b.hours_to_full!)
  const resetFirst = forecasts.filter(f => f.status === 'reset_first')
    .sort((a, b) => {
      const ra = a.resets_at ? new Date(a.resets_at).getTime() : Infinity
      const rb = b.resets_at ? new Date(b.resets_at).getTime() : Infinity
      return ra - rb
    })
  const others = forecasts.filter(f => f.hours_to_full == null)
    .sort((a, b) => b.current_pct - a.current_pct)
  return [...trending, ...resetFirst, ...others]
}
