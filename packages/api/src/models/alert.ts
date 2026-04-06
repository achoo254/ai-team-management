import mongoose, { Schema, type Document, type Types } from 'mongoose'

export type AlertTypeDb = 'rate_limit' | 'token_failure' | 'usage_exceeded' | 'session_waste' | '7d_risk' | 'unexpected_activity' | 'unexpected_idle'
export type AlertWindowDb = '5h' | '7d' | null

export interface IAlert extends Document {
  user_id: Types.ObjectId | null
  seat_id: Types.ObjectId
  type: AlertTypeDb
  window: AlertWindowDb
  message: string
  metadata: Record<string, unknown>
  read_by: Types.ObjectId[]
  /** Set when notification was sent — prevents re-sending for same condition */
  notified_at: Date | null
  created_at: Date
}

const alertSchema = new Schema<IAlert>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
    type: { type: String, required: true, enum: ['rate_limit', 'token_failure', 'usage_exceeded', 'session_waste', '7d_risk', 'unexpected_activity', 'unexpected_idle'] },
    window: { type: String, enum: ['5h', '7d', null], default: null },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    read_by: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    notified_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Per-user dedup: (user, seat, type, window) — primary dedup key
alertSchema.index({ user_id: 1, seat_id: 1, type: 1, window: 1, created_at: -1 })
// Feed queries: seat+type sorted by time (kept for seat-wide lookups)
alertSchema.index({ seat_id: 1, type: 1, created_at: -1 })
// Unread queries per user
alertSchema.index({ read_by: 1 })
// Feed sorting
alertSchema.index({ created_at: -1 })

export const Alert = mongoose.model<IAlert>('Alert', alertSchema)
