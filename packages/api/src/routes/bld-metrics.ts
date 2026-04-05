/**
 * BLD Metrics Routes
 * Open to all authenticated users; data is scoped by role:
 * - admin  → seats with include_in_overview=true
 * - user   → user's own seat_ids from DB
 *
 * Cache: simple in-memory Map with 5-min TTL per scope key.
 * Cache key encodes scope to prevent cross-scope leakage.
 */

import { Router } from 'express'
import { authenticate } from '../middleware.js'
import { User } from '../models/user.js'
import {
  computeFleetKpis,
  computeWwHistory,
  computeRebalanceSuggestions,
  type MetricsScope,
} from '../services/bld-metrics-service.js'
import { computeSeatStats } from '../services/bld-seat-stats-service.js'

const router = Router()

// ── Simple in-memory cache (5-min TTL) ───────────────────────────────────────

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const TTL_MS = 5 * 60 * 1000

function getCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS })
}

// ── Scope resolution ──────────────────────────────────────────────────────────

/** Derive MetricsScope from the authenticated request user. */
async function resolveScope(userId: string, role: string): Promise<MetricsScope> {
  if (role === 'admin') return { type: 'admin' }
  // Fetch seat_ids from DB — they are not included in JWT payload
  const user = await User.findById(userId).select('seat_ids').lean()
  const seatIds = (user?.seat_ids ?? []).map(String)
  return { type: 'user', seatIds }
}

/** Stable cache key that encodes the scope without leaking cross-user data. */
function scopeCacheKey(prefix: string, scope: MetricsScope): string {
  if (scope.type === 'admin') return `${prefix}:admin`
  const sorted = [...scope.seatIds].sort().join(',')
  return `${prefix}:user:${sorted}`
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/bld/fleet-kpis — fleet utilization, waste, W/W delta, worst forecast */
router.get('/fleet-kpis', authenticate, async (req, res, next) => {
  try {
    const scope = await resolveScope(req.user!._id, req.user!.role)
    const cacheKey = scopeCacheKey('fleet-kpis', scope)
    const cached = getCache<unknown>(cacheKey)
    if (cached) {
      res.json(cached)
      return
    }

    const [kpis, wwHistory] = await Promise.all([
      computeFleetKpis(scope),
      computeWwHistory(scope, 8),
    ])

    const payload = { kpis, wwHistory }
    setCache(cacheKey, payload)
    res.json(payload)
  } catch (err) {
    next(err)
  }
})

/** GET /api/bld/seat-stats — seat-level utilization, waste, burndown, degradation */
router.get('/seat-stats', authenticate, async (req, res, next) => {
  try {
    const scope = await resolveScope(req.user!._id, req.user!.role)
    const cacheKey = scopeCacheKey('seat-stats', scope)
    const cached = getCache<unknown>(cacheKey)
    if (cached) {
      res.json(cached)
      return
    }

    const data = await computeSeatStats(scope)
    setCache(cacheKey, data)
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/** GET /api/bld/rebalance-suggestions — rule-based rebalance suggestions */
router.get('/rebalance-suggestions', authenticate, async (req, res, next) => {
  try {
    const scope = await resolveScope(req.user!._id, req.user!.role)
    const cacheKey = scopeCacheKey('rebalance-suggestions', scope)
    const cached = getCache<unknown>(cacheKey)
    if (cached) {
      res.json(cached)
      return
    }

    const suggestions = await computeRebalanceSuggestions(scope)
    setCache(cacheKey, suggestions)
    res.json(suggestions)
  } catch (err) {
    next(err)
  }
})

export default router
