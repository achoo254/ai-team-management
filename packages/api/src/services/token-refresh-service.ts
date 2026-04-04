import { Seat } from '../models/seat.js'
import { decrypt, encrypt } from './crypto-service.js'
import { sendTokenRefreshAlert } from './telegram-service.js'
import { parallelLimit } from '../utils/parallel-limit.js'

const REFRESH_URL = 'https://api.anthropic.com/v1/oauth/token'
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
const EXPIRY_BUFFER_MS = 5 * 60 * 1000 // 5 minutes before expiry
const FETCH_TIMEOUT_MS = 15_000
const CONCURRENCY = 3
const MAX_ERROR_LENGTH = 200

/** Refresh OAuth token for a single seat */
async function refreshTokenForSeat(seat: {
  _id: unknown
  label: string
  oauth_credential: { refresh_token: string }
}) {
  const refreshToken = decrypt(seat.oauth_credential.refresh_token)

  const res = await fetch(REFRESH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body.slice(0, MAX_ERROR_LENGTH)}`)
  }

  const data = await res.json()
  const expiresAt = new Date(Date.now() + data.expires_in * 1000)

  await Seat.findByIdAndUpdate(seat._id, {
    'oauth_credential.access_token': encrypt(data.access_token),
    'oauth_credential.refresh_token': encrypt(data.refresh_token),
    'oauth_credential.expires_at': expiresAt,
    'oauth_credential.scopes': (data.scope || '').split(' ').filter(Boolean),
    last_refreshed_at: new Date(),
    last_fetch_error: null,
  })

  console.log(`[TokenRefresh] ✓ ${seat.label} — expires ${expiresAt.toISOString()}`)
}

// Mutex guard: prevent overlapping cron runs
let isRefreshing = false

/** Check all active seats and refresh tokens expiring within buffer window */
export async function checkAndRefreshExpiring(): Promise<{
  refreshed: number
  errors: number
}> {
  if (isRefreshing) {
    console.log('[TokenRefresh] Already running, skipping')
    return { refreshed: 0, errors: 0 }
  }

  isRefreshing = true
  try {
    const threshold = new Date(Date.now() + EXPIRY_BUFFER_MS)

    const seats = await Seat.find({
      token_active: true,
      'oauth_credential.refresh_token': { $ne: null },
      'oauth_credential.expires_at': { $lt: threshold },
    }).select('+oauth_credential').lean()

    if (seats.length === 0) return { refreshed: 0, errors: 0 }

    console.log(`[TokenRefresh] Refreshing ${seats.length} expiring tokens...`)
    let refreshed = 0
    let errors = 0

    await parallelLimit(seats, CONCURRENCY, async (seat) => {
      try {
        await refreshTokenForSeat(seat as any)
        refreshed++
      } catch (err) {
        errors++
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[TokenRefresh] ✗ ${seat.label}: ${message}`)
        const truncated = message.slice(0, MAX_ERROR_LENGTH)
        await Seat.findByIdAndUpdate(seat._id, {
          token_active: false,
          last_fetch_error: truncated,
        })
        await sendTokenRefreshAlert(seat.label, truncated)
      }
    })

    console.log(`[TokenRefresh] Done: ${refreshed} refreshed, ${errors} errors`)
    return { refreshed, errors }
  } finally {
    isRefreshing = false
  }
}
