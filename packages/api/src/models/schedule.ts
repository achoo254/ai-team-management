import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface ISchedule extends Document {
  seat_id: Types.ObjectId
  day_of_week: number // 0-6
  start_hour: number  // 0-23
  end_hour: number    // 0-23 (exclusive)
  source: 'auto' | 'legacy'
  created_at: Date
}

const scheduleSchema = new Schema<ISchedule>(
  {
    seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
    day_of_week: { type: Number, required: true, min: 0, max: 6 },
    start_hour: { type: Number, required: true, min: 0, max: 23 },
    end_hour: { type: Number, required: true, min: 0, max: 23 },
    source: { type: String, enum: ['auto', 'legacy'], default: 'legacy' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Validate start_hour < end_hour
scheduleSchema.pre('validate', function () {
  if (this.start_hour >= this.end_hour) {
    this.invalidate('end_hour', 'start_hour must be less than end_hour')
  }
})

// Query index for seat+day lookups
scheduleSchema.index({ seat_id: 1, day_of_week: 1 })
scheduleSchema.index({ seat_id: 1 })
// Fast lookup for auto-generated patterns (pattern generator replaces these)
scheduleSchema.index({ seat_id: 1, source: 1 })

export const Schedule = mongoose.model<ISchedule>('Schedule', scheduleSchema)

// Drop old indexes from previous schemas (safe to ignore if not present)
Schedule.collection.dropIndex('seat_id_1_day_of_week_1_slot_1').catch(() => {})

// One-time migration: mark existing entries without source as 'legacy'
async function migrateAddSource() {
  const count = await Schedule.countDocuments({ source: { $exists: false } })
  if (count === 0) return
  console.log(`[Schedule] Migrating ${count} entries → source='legacy'`)
  await Schedule.updateMany(
    { source: { $exists: false } },
    { $set: { source: 'legacy' } },
  )
  // Also remove deprecated fields from old entries
  await Schedule.updateMany(
    { user_id: { $exists: true } },
    { $unset: { user_id: '', usage_budget_pct: '', slot: '' } },
  )
  console.log('[Schedule] Migration complete')
}

migrateAddSource().catch(console.error)
