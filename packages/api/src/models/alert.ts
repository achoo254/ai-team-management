import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface IAlert extends Document {
  seat_id: Types.ObjectId
  type: 'rate_limit' | 'extra_credit' | 'token_failure' | 'usage_exceeded' | 'session_waste' | '7d_risk'
  message: string
  metadata: Record<string, unknown>
  read_by: Types.ObjectId[]
  /** Set when notification was sent — prevents re-sending for same condition */
  notified_at: Date | null
  created_at: Date
}

const alertSchema = new Schema<IAlert>(
  {
    seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
    type: { type: String, required: true, enum: ['rate_limit', 'extra_credit', 'token_failure', 'usage_exceeded', 'session_waste', '7d_risk'] },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    read_by: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    notified_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Feed queries: seat+type sorted by time, dedup cooldown
alertSchema.index({ seat_id: 1, type: 1, created_at: -1 })
// Unread queries per user
alertSchema.index({ read_by: 1 })
// Feed sorting
alertSchema.index({ created_at: -1 })

export const Alert = mongoose.model<IAlert>('Alert', alertSchema)
