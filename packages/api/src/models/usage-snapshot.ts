import mongoose, { Schema, type Document } from 'mongoose'

export interface IUsageSnapshot extends Document {
  seat_id: mongoose.Types.ObjectId
  raw_response: Record<string, unknown>
  five_hour_pct: number | null
  five_hour_resets_at: Date | null
  seven_day_pct: number | null
  seven_day_resets_at: Date | null
  seven_day_sonnet_pct: number | null
  seven_day_sonnet_resets_at: Date | null
  seven_day_opus_pct: number | null
  seven_day_opus_resets_at: Date | null
  extra_usage: {
    is_enabled: boolean
    monthly_limit: number | null
    used_credits: number | null
    utilization: number | null
  }
  fetched_at: Date
}

const usageSnapshotSchema = new Schema<IUsageSnapshot>({
  seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
  raw_response: { type: Schema.Types.Mixed, required: true },
  five_hour_pct: { type: Number, default: null },
  five_hour_resets_at: { type: Date, default: null },
  seven_day_pct: { type: Number, default: null },
  seven_day_resets_at: { type: Date, default: null },
  seven_day_sonnet_pct: { type: Number, default: null },
  seven_day_sonnet_resets_at: { type: Date, default: null },
  seven_day_opus_pct: { type: Number, default: null },
  seven_day_opus_resets_at: { type: Date, default: null },
  extra_usage: {
    is_enabled: { type: Boolean, default: false },
    monthly_limit: { type: Number, default: null },
    used_credits: { type: Number, default: null },
    utilization: { type: Number, default: null },
  },
  fetched_at: { type: Date, default: Date.now, required: true },
})

// Compound index for querying snapshots by seat + time
usageSnapshotSchema.index({ seat_id: 1, fetched_at: -1 })

// Standalone index for dashboard aggregations that sort by fetched_at only
usageSnapshotSchema.index({ fetched_at: -1 })

// No TTL — usage data is stored long-term for historical analysis

export const UsageSnapshot = mongoose.model<IUsageSnapshot>(
  'UsageSnapshot', usageSnapshotSchema,
)

// Drop stale TTL index from previous schema (Mongoose doesn't auto-drop existing indexes)
UsageSnapshot.collection.dropIndex('fetched_at_1').catch(() => {
  // Index may not exist — safe to ignore
})
