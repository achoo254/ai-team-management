import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface IActiveSession extends Document {
  seat_id: Types.ObjectId
  user_id: Types.ObjectId
  schedule_id: Types.ObjectId
  started_at: Date
  reset_count_5h: number
  last_resets_at: Date | null // track five_hour_resets_at to detect resets
  snapshot_at_start: {
    five_hour_pct: number | null
    seven_day_pct: number | null
    seven_day_sonnet_pct: number | null
    seven_day_opus_pct: number | null
  }
}

const activeSessionSchema = new Schema<IActiveSession>({
  seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  schedule_id: { type: Schema.Types.ObjectId, ref: 'Schedule', required: true },
  started_at: { type: Date, required: true },
  reset_count_5h: { type: Number, default: 0 },
  last_resets_at: { type: Date, default: null },
  snapshot_at_start: {
    five_hour_pct: { type: Number, default: null },
    seven_day_pct: { type: Number, default: null },
    seven_day_sonnet_pct: { type: Number, default: null },
    seven_day_opus_pct: { type: Number, default: null },
  },
})

// One active session per seat at a time
activeSessionSchema.index({ seat_id: 1 })
activeSessionSchema.index({ schedule_id: 1 }, { unique: true })

export const ActiveSession = mongoose.model<IActiveSession>(
  'ActiveSession', activeSessionSchema,
)
