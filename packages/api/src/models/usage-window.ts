import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface IUsageWindow extends Document {
  seat_id: Types.ObjectId
  owner_id: Types.ObjectId
  window_start: Date
  window_end: Date // expected close (= five_hour_resets_at while open)
  is_closed: boolean
  is_partial: boolean // true if no snapshot_start available at creation
  duration_hours: number
  utilization_pct: number // peak five_hour_pct observed
  delta_7d_pct: number
  delta_7d_sonnet_pct: number
  delta_7d_opus_pct: number
  impact_ratio: number | null // delta_7d_pct / utilization_pct (null if util < 1)
  is_waste: boolean
  peak_hour_of_day: number | null // 0-23 Asia/Ho_Chi_Minh
  snapshot_start_id: Types.ObjectId | null
  snapshot_end_id: Types.ObjectId | null
  created_at: Date
  updated_at: Date
}

const usageWindowSchema = new Schema<IUsageWindow>(
  {
    seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
    owner_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    window_start: { type: Date, required: true },
    window_end: { type: Date, required: true },
    is_closed: { type: Boolean, default: false },
    is_partial: { type: Boolean, default: false },
    duration_hours: { type: Number, default: 0 },
    utilization_pct: { type: Number, default: 0 },
    delta_7d_pct: { type: Number, default: 0 },
    delta_7d_sonnet_pct: { type: Number, default: 0 },
    delta_7d_opus_pct: { type: Number, default: 0 },
    impact_ratio: { type: Number, default: null },
    is_waste: { type: Boolean, default: false },
    peak_hour_of_day: { type: Number, default: null },
    snapshot_start_id: { type: Schema.Types.ObjectId, ref: 'UsageSnapshot', default: null },
    snapshot_end_id: { type: Schema.Types.ObjectId, ref: 'UsageSnapshot', default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

usageWindowSchema.index({ seat_id: 1, window_start: -1 })
usageWindowSchema.index({ owner_id: 1, window_start: -1 })
usageWindowSchema.index({ window_start: -1 })
usageWindowSchema.index({ is_closed: 1, seat_id: 1 })
usageWindowSchema.index({ seat_id: 1, window_start: 1 }, { unique: true })
// DB-level guarantee: at most one open window per seat.
// Partial index applies only to is_closed:false docs.
usageWindowSchema.index(
  { seat_id: 1 },
  { unique: true, partialFilterExpression: { is_closed: false }, name: 'seat_unique_open' },
)

export const UsageWindow = mongoose.model<IUsageWindow>('UsageWindow', usageWindowSchema)
