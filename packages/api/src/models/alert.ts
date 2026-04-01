import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface IAlert extends Document {
  seat_id: Types.ObjectId
  type: 'high_usage' | 'no_activity'
  message: string
  resolved: boolean
  resolved_by: string | null
  resolved_at: Date | null
  created_at: Date
}

const alertSchema = new Schema<IAlert>(
  {
    seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
    type: { type: String, required: true, enum: ['high_usage', 'no_activity'] },
    message: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    resolved_by: { type: String, default: null },
    resolved_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

alertSchema.index({ resolved: 1 })

export const Alert = mongoose.model<IAlert>('Alert', alertSchema)
