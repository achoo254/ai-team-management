import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface ISessionMetric extends Document {
  seat_id: Types.ObjectId
  user_id: Types.ObjectId
  schedule_id: Types.ObjectId
  date: Date // session date (start of day)
  start_hour: number
  end_hour: number
  duration_hours: number
  // Usage deltas during session
  delta_5h_pct: number
  delta_7d_pct: number
  delta_7d_sonnet_pct: number
  delta_7d_opus_pct: number
  // Computed efficiency metrics
  impact_ratio: number | null   // Δ7d / Δ5h — cost per 1% of 5h
  utilization_pct: number       // how well the session time was used
  reset_count_5h: number        // number of 5h resets detected during session
  // Raw snapshots for reference
  snapshot_start: {
    five_hour_pct: number | null
    seven_day_pct: number | null
    seven_day_sonnet_pct: number | null
    seven_day_opus_pct: number | null
  }
  snapshot_end: {
    five_hour_pct: number | null
    seven_day_pct: number | null
    seven_day_sonnet_pct: number | null
    seven_day_opus_pct: number | null
  }
  created_at: Date
}

const snapshotFields = {
  five_hour_pct: { type: Number, default: null },
  seven_day_pct: { type: Number, default: null },
  seven_day_sonnet_pct: { type: Number, default: null },
  seven_day_opus_pct: { type: Number, default: null },
}

const sessionMetricSchema = new Schema<ISessionMetric>(
  {
    seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    schedule_id: { type: Schema.Types.ObjectId, ref: 'Schedule', required: true },
    date: { type: Date, required: true },
    start_hour: { type: Number, required: true },
    end_hour: { type: Number, required: true },
    duration_hours: { type: Number, required: true },
    delta_5h_pct: { type: Number, default: 0 },
    delta_7d_pct: { type: Number, default: 0 },
    delta_7d_sonnet_pct: { type: Number, default: 0 },
    delta_7d_opus_pct: { type: Number, default: 0 },
    impact_ratio: { type: Number, default: null },
    utilization_pct: { type: Number, default: 0 },
    reset_count_5h: { type: Number, default: 0 },
    snapshot_start: snapshotFields,
    snapshot_end: snapshotFields,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Query indexes
sessionMetricSchema.index({ seat_id: 1, date: -1 })
sessionMetricSchema.index({ user_id: 1, date: -1 })
sessionMetricSchema.index({ date: -1 })

export const SessionMetric = mongoose.model<ISessionMetric>(
  'SessionMetric', sessionMetricSchema,
)
