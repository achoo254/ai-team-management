import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface ISchedule extends Document {
  seat_id: Types.ObjectId
  user_id: Types.ObjectId
  day_of_week: number // 0-6
  start_hour: number  // 0-23
  end_hour: number    // 0-23 (exclusive)
  usage_budget_pct: number | null // 1-100, null = auto-divide
  created_at: Date
}

const scheduleSchema = new Schema<ISchedule>(
  {
    seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day_of_week: { type: Number, required: true, min: 0, max: 6 },
    start_hour: { type: Number, required: true, min: 0, max: 23 },
    end_hour: { type: Number, required: true, min: 0, max: 23 },
    usage_budget_pct: { type: Number, min: 1, max: 100, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Validate start_hour < end_hour
scheduleSchema.pre('validate', function () {
  if (this.start_hour >= this.end_hour) {
    this.invalidate('end_hour', 'start_hour must be less than end_hour')
  }
})

// Query index for seat+day lookups (no unique constraint — overlaps allowed with warning)
scheduleSchema.index({ seat_id: 1, day_of_week: 1 })
scheduleSchema.index({ seat_id: 1 })

export const Schedule = mongoose.model<ISchedule>('Schedule', scheduleSchema)

// Drop old unique index from previous schema (slot-based)
Schedule.collection.dropIndex('seat_id_1_day_of_week_1_slot_1').catch(() => {
  // Index may not exist — safe to ignore
})

// One-time migration: convert slot-based entries to hourly
async function migrateSlotToHourly() {
  const morningCount = await Schedule.countDocuments({ slot: 'morning' as any, start_hour: { $exists: false } })
  const afternoonCount = await Schedule.countDocuments({ slot: 'afternoon' as any, start_hour: { $exists: false } })
  if (morningCount === 0 && afternoonCount === 0) return

  console.log(`[Schedule] Migrating ${morningCount + afternoonCount} slot-based entries to hourly...`)
  await Schedule.updateMany(
    { slot: 'morning' as any, start_hour: { $exists: false } },
    { $set: { start_hour: 8, end_hour: 12, usage_budget_pct: 50 }, $unset: { slot: '' } },
  )
  await Schedule.updateMany(
    { slot: 'afternoon' as any, start_hour: { $exists: false } },
    { $set: { start_hour: 13, end_hour: 17, usage_budget_pct: 50 }, $unset: { slot: '' } },
  )
  console.log('[Schedule] Migration complete')
}

migrateSlotToHourly().catch(console.error)
