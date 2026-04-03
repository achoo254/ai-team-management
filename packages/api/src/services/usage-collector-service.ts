import { Seat } from '../models/seat.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { decrypt } from './crypto-service.js'

const API_URL = 'https://api.anthropic.com/api/oauth/usage'
const CONCURRENCY = 3
const FETCH_TIMEOUT_MS = 15_000
const MAX_ERROR_LENGTH = 200

/** Parse a usage bucket { utilization, resets_at } or null */
function parseBucket(bucket: unknown): { pct: number | null; resetsAt: Date | null } {
  if (!bucket || typeof bucket !== 'object') return { pct: null, resetsAt: null }
  const b = bucket as { utilization?: number; resets_at?: string }
  return {
    pct: b.utilization ?? null,
    resetsAt: b.resets_at ? new Date(b.resets_at) : null,
  }
}

/** Fetch usage for a single seat */
async function fetchSeatUsage(seat: { _id: unknown; access_token: string; label: string }) {
  const token = decrypt(seat.access_token)

  const res = await fetch(API_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'anthropic-beta': 'oauth-2025-04-20',
      'content-type': 'application/json',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body.slice(0, MAX_ERROR_LENGTH)}`)
  }

  const raw = await res.json()
  const fiveHour = parseBucket(raw.five_hour)
  const sevenDay = parseBucket(raw.seven_day)
  const sevenDaySonnet = parseBucket(raw.seven_day_sonnet)
  const sevenDayOpus = parseBucket(raw.seven_day_opus)

  await UsageSnapshot.create({
    seat_id: seat._id,
    raw_response: raw,
    five_hour_pct: fiveHour.pct,
    five_hour_resets_at: fiveHour.resetsAt,
    seven_day_pct: sevenDay.pct,
    seven_day_resets_at: sevenDay.resetsAt,
    seven_day_sonnet_pct: sevenDaySonnet.pct,
    seven_day_sonnet_resets_at: sevenDaySonnet.resetsAt,
    seven_day_opus_pct: sevenDayOpus.pct,
    seven_day_opus_resets_at: sevenDayOpus.resetsAt,
    extra_usage: {
      is_enabled: raw.extra_usage?.is_enabled ?? false,
      monthly_limit: raw.extra_usage?.monthly_limit ?? null,
      used_credits: raw.extra_usage?.used_credits ?? null,
      utilization: raw.extra_usage?.utilization ?? null,
    },
  })

  await Seat.findByIdAndUpdate(seat._id, {
    last_fetched_at: new Date(),
    last_fetch_error: null,
  })

  console.log(`[Collector] ✓ ${seat.label}`)
}

/** Run tasks with concurrency limit */
async function parallelLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const executing: Promise<void>[] = []
  for (const item of items) {
    const p = fn(item).then(() => { executing.splice(executing.indexOf(p), 1) })
    executing.push(p)
    if (executing.length >= limit) await Promise.race(executing)
  }
  await Promise.all(executing)
}

// Mutex guard: prevent overlapping cron runs
let isCollecting = false

/** Collect usage for all active seats */
export async function collectAllUsage(): Promise<{
  success: number
  errors: number
  failedSeats: Array<{ id: string; label: string; error: string }>
}> {
  if (isCollecting) {
    console.log('[Collector] Already running, skipping')
    return { success: 0, errors: 0, failedSeats: [] }
  }

  isCollecting = true
  try {
    const seats = await Seat.find({
      token_active: true,
      access_token: { $ne: null },
    }).select('+access_token').lean()

    if (seats.length === 0) {
      console.log('[Collector] No active seats with tokens')
      return { success: 0, errors: 0, failedSeats: [] }
    }

    console.log(`[Collector] Fetching usage for ${seats.length} seats...`)
    let success = 0
    let errors = 0
    const failedSeats: Array<{ id: string; label: string; error: string }> = []

    await parallelLimit(seats, CONCURRENCY, async (seat) => {
      try {
        await fetchSeatUsage(seat as any)
        success++
      } catch (err) {
        errors++
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[Collector] ✗ ${seat.label}: ${message}`)
        const truncated = message.slice(0, MAX_ERROR_LENGTH)
        failedSeats.push({ id: String(seat._id), label: seat.label, error: truncated })
        await Seat.findByIdAndUpdate(seat._id, { last_fetch_error: truncated })
      }
    })

    console.log(`[Collector] Done: ${success} success, ${errors} errors`)
    return { success, errors, failedSeats }
  } finally {
    isCollecting = false
  }
}

/** Collect usage for a single seat by ID */
export async function collectSeatUsage(seatId: string): Promise<void> {
  const seat = await Seat.findById(seatId).select('+access_token').lean()
  if (!seat) throw new Error('Seat not found')
  if (!seat.token_active || !seat.access_token) throw new Error('Seat has no active token')
  await fetchSeatUsage(seat as any)
}
