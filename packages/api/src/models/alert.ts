import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface IAlert extends Document {
  seat_id: Types.ObjectId
  type: 'rate_limit' | 'extra_credit' | 'token_failure'
  message: string
  metadata: Record<string, unknown>
  resolved: boolean
  resolved_by: string | null
  resolved_at: Date | null
  created_at: Date
}

const alertSchema = new Schema<IAlert>(
  {
    seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
    type: { type: String, required: true, enum: ['rate_limit', 'extra_credit', 'token_failure'] },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    resolved: { type: Boolean, default: false },
    resolved_by: { type: String, default: null },
    resolved_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Compound index for dedup queries: 1 unresolved alert per seat+type
alertSchema.index({ seat_id: 1, type: 1, resolved: 1 })

export const Alert = mongoose.model<IAlert>('Alert', alertSchema)
