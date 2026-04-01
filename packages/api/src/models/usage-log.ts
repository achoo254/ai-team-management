import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface IUsageLog extends Document {
  seat_id: Types.ObjectId
  week_start: string
  weekly_all_pct: number
  user_id: Types.ObjectId
  logged_at: Date
}

const usageLogSchema = new Schema<IUsageLog>({
  seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
  week_start: { type: String, required: true },
  weekly_all_pct: { type: Number, default: 0 },
  user_id: { type: Schema.Types.ObjectId, ref: 'User' },
  logged_at: { type: Date, default: Date.now },
})

// Compound unique: one log per seat/week/user
usageLogSchema.index({ seat_id: 1, week_start: 1, user_id: 1 }, { unique: true })
usageLogSchema.index({ seat_id: 1, week_start: 1 })

export const UsageLog = mongoose.model<IUsageLog>('UsageLog', usageLogSchema)
