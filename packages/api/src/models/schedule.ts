import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface ISchedule extends Document {
  seat_id: Types.ObjectId
  user_id: Types.ObjectId
  day_of_week: number // 0-6
  slot: 'morning' | 'afternoon'
  created_at: Date
}

const scheduleSchema = new Schema<ISchedule>(
  {
    seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day_of_week: { type: Number, required: true, min: 0, max: 6 },
    slot: { type: String, required: true, enum: ['morning', 'afternoon'] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Compound unique: one user per seat per day+slot
scheduleSchema.index({ seat_id: 1, day_of_week: 1, slot: 1 }, { unique: true })
scheduleSchema.index({ seat_id: 1 })

export const Schedule = mongoose.model<ISchedule>('Schedule', scheduleSchema)
