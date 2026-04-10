// Permission-aware query for Claude desktop sessions.
// Admin sees all; non-admin is scoped to seats they can access (via getAllowedSeatIds).
import mongoose from 'mongoose'
import { ClaudeSession, type IClaudeSession } from '../models/claude-session.js'
import { getAllowedSeatIds, type JwtPayload } from '../middleware.js'

export interface ListClaudeSessionsFilters {
  seat_id?: string
  profile_email?: string
  since?: Date
  until?: Date
  limit?: number
}

export interface ListClaudeSessionsResult {
  sessions: IClaudeSession[]
  total: number
}

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500
const DEFAULT_LOOKBACK_DAYS = 7

export async function listClaudeSessions(
  user: JwtPayload,
  filters: ListClaudeSessionsFilters = {},
): Promise<ListClaudeSessionsResult> {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const until = filters.until ?? new Date()
  const since =
    filters.since ?? new Date(until.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

  const query: Record<string, unknown> = {
    started_at: { $gte: since, $lte: until },
  }

  // Permission scoping: non-admin restricted to allowed seats.
  if (user.role !== 'admin') {
    const allowedSeatIds = await getAllowedSeatIds(user)
    if (allowedSeatIds.length === 0) {
      return { sessions: [], total: 0 }
    }
    query.seat_id = { $in: allowedSeatIds }
  }

  // Optional seat filter — for non-admin, must intersect with allowed seats.
  if (filters.seat_id && mongoose.isValidObjectId(filters.seat_id)) {
    const requested = new mongoose.Types.ObjectId(filters.seat_id)
    if (user.role === 'admin') {
      query.seat_id = requested
    } else {
      const allowed = query.seat_id as { $in: mongoose.Types.ObjectId[] }
      const allowedIds = allowed.$in.map(String)
      query.seat_id = allowedIds.includes(String(requested)) ? requested : { $in: [] }
    }
  }

  if (filters.profile_email) {
    query.profile_email = filters.profile_email
  }

  const [sessions, total] = await Promise.all([
    ClaudeSession.find(query).sort({ started_at: -1 }).limit(limit).lean(),
    ClaudeSession.countDocuments(query),
  ])

  return { sessions: sessions as IClaudeSession[], total }
}
