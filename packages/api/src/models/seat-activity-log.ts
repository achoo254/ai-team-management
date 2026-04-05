import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface ISeatActivityLog extends Document {
  seat_id: Types.ObjectId
  date: Date                 // start of day (Asia/Ho_Chi_Minh)
  hour: number               // 0-23
  is_active: boolean         // true if any delta > 0
  delta_5h_pct: number       // accumulated five_hour_pct increase this hour
  snapshot_count: number     // how many snapshots showed activity
  created_at: Date
}

const seatActivityLogSchema = new Schema<ISeatActivityLog>({
  seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
  date: { type: Date, required: true },
  hour: { type: Number, required: true, min: 0, max: 23 },
  is_active: { type: Boolean, default: false },
  delta_5h_pct: { type: Number, default: 0 },
  snapshot_count: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
})

// One record per seat/date/hour
seatActivityLogSchema.index({ seat_id: 1, date: -1, hour: 1 }, { unique: true })
// Query all hours for a seat/date
seatActivityLogSchema.index({ seat_id: 1, date: -1 })
// Cleanup/aggregation queries
seatActivityLogSchema.index({ date: -1 })

export const SeatActivityLog = mongoose.model<ISeatActivityLog>(
  'SeatActivityLog', seatActivityLogSchema,
)
