import type { SeatForecast } from './quota-forecast-service.js'

// ── Efficiency classification ────────────────────────────────────────────────

/** Minimum hours into cycle before classification is reliable */
const MIN_HOURS_FOR_CLASSIFICATION = 24

/** Projected pct at reset >= this = optimal */
const OPTIMAL_THRESHOLD_PCT = 85

/** Flat cost per seat per month (USD) */
export const SEAT_MONTHLY_COST_USD = 125

export type SeatEfficiencyBucket = 'optimal' | 'overload' | 'waste' | 'unknown'

export interface SeatEfficiencyResult {
  bucket: SeatEfficiencyBucket
  projected_pct: number | null
  waste_pct: number | null
  /** Only for overload: hours seat exhausts before reset */
  hours_early: number | null
}

export interface FleetEfficiency {
  optimal_count: number
  overload: Array<{ seat_id: string; seat_label: string; hours_early: number }>
  waste: {
    seats: Array<{ seat_id: string; seat_label: string; projected_pct: number; waste_pct: number; waste_usd: number }>
    total_waste_usd: number
  }
  unknown_count: number
  total_seats: number
}

/** Classify a single seat into efficiency bucket based on projected pct at reset. Pure function. */
export function classifyEfficiency(f: SeatForecast, now: Date): SeatEfficiencyResult {
  const UNKNOWN: SeatEfficiencyResult = { bucket: 'unknown', projected_pct: null, waste_pct: null, hours_early: null }

  if (f.status === 'collecting' || !f.resets_at) return UNKNOWN

  const resetsAt = new Date(f.resets_at)
  const hoursToReset = (resetsAt.getTime() - now.getTime()) / 3600_000
  if (hoursToReset <= 0) return UNKNOWN

  const cycleStart = new Date(resetsAt.getTime() - 7 * 24 * 3600_000)
  const hoursSinceReset = (now.getTime() - cycleStart.getTime()) / 3600_000
  if (hoursSinceReset < MIN_HOURS_FOR_CLASSIFICATION) return UNKNOWN

  const slope = f.slope_per_hour ?? 0
  const projected = Math.min(100, f.current_pct + slope * hoursToReset)

  // Overload: will exhaust before reset
  if (projected >= 100) {
    const hoursEarly = f.hours_to_full != null
      ? Math.max(0, hoursToReset - f.hours_to_full)
      : 0
    return { bucket: 'overload', projected_pct: 100, waste_pct: null, hours_early: hoursEarly }
  }

  // Optimal: on track to use >=85% by reset
  if (projected >= OPTIMAL_THRESHOLD_PCT) {
    return { bucket: 'optimal', projected_pct: Math.round(projected), waste_pct: null, hours_early: null }
  }

  // Waste: projected < 85%
  const wastePct = Math.round(OPTIMAL_THRESHOLD_PCT - projected)
  return { bucket: 'waste', projected_pct: Math.round(projected), waste_pct: wastePct, hours_early: null }
}

/** Aggregate efficiency from pre-computed forecasts. Pure function — no DB calls. */
export function computeFleetEfficiency(
  forecasts: SeatForecast[],
  now: Date = new Date(),
): FleetEfficiency {
  const result: FleetEfficiency = {
    optimal_count: 0,
    overload: [],
    waste: { seats: [], total_waste_usd: 0 },
    unknown_count: 0,
    total_seats: forecasts.length,
  }

  const costPerCycle = SEAT_MONTHLY_COST_USD * (7 / 30)

  for (const f of forecasts) {
    const eff = classifyEfficiency(f, now)
    switch (eff.bucket) {
      case 'optimal':
        result.optimal_count++
        break
      case 'overload':
        result.overload.push({
          seat_id: f.seat_id, seat_label: f.seat_label,
          hours_early: eff.hours_early ?? 0,
        })
        break
      case 'waste': {
        const wasteUsd = (eff.waste_pct ?? 0) / 100 * costPerCycle
        result.waste.seats.push({
          seat_id: f.seat_id, seat_label: f.seat_label,
          projected_pct: eff.projected_pct ?? 0,
          waste_pct: eff.waste_pct ?? 0,
          waste_usd: Math.round(wasteUsd * 10) / 10,
        })
        result.waste.total_waste_usd += wasteUsd
        break
      }
      case 'unknown':
        result.unknown_count++
        break
    }
  }

  result.waste.total_waste_usd = Math.round(result.waste.total_waste_usd)
  return result
}
