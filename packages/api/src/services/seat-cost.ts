/**
 * Seat cost configuration.
 *
 * Kept in its own module so every consumer reads the same value. Previously the
 * env override lived in bld-metrics-service while quota-efficiency-service
 * hardcoded 125 — setting the env var made the two disagree silently.
 */

const DEFAULT_MONTHLY_COST_USD = 125

/** Days per month used to convert between monthly and 7-day-cycle cost. */
const DAYS_PER_MONTH = 30
const DAYS_PER_CYCLE = 7

/** Flat cost per seat per month (USD). Override with SEAT_MONTHLY_COST_USD. */
export function getMonthlyCostUsd(): number {
  const raw = process.env.SEAT_MONTHLY_COST_USD
  if (!raw) return DEFAULT_MONTHLY_COST_USD
  const val = Number(raw)
  if (!isFinite(val) || val <= 0) return DEFAULT_MONTHLY_COST_USD
  return val
}

/** Cost per seat for one 7-day quota cycle. */
export function getCycleCostUsd(): number {
  return getMonthlyCostUsd() * (DAYS_PER_CYCLE / DAYS_PER_MONTH)
}

/** Convert a per-cycle amount to its monthly equivalent. */
export function cycleUsdToMonthly(cycleUsd: number): number {
  return cycleUsd * (DAYS_PER_MONTH / DAYS_PER_CYCLE)
}
