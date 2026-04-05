import mongoose from 'mongoose'
import { SeatActivityLog } from '../models/seat-activity-log.js'
import { Schedule } from '../models/schedule.js'
import { Seat } from '../models/seat.js'

const DEFAULT_LOOKBACK_WEEKS = 4
const DEFAULT_ACTIVITY_THRESHOLD = 0.5 // active >50% of observed weeks

/** Merge sorted array of active hours into contiguous blocks */
export function mergeConsecutiveHours(hours: number[]): { start: number; end: number }[] {
  if (!hours.length) return []
  const sorted = [...hours].sort((a, b) => a - b)
  const blocks: { start: number; end: number }[] = []
  let start = sorted[0], prev = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i]
    } else {
      blocks.push({ start, end: prev + 1 })
      start = sorted[i]
      prev = sorted[i]
    }
  }
  blocks.push({ start, end: prev + 1 })
  return blocks
}

/** Analyze activity patterns for a single seat and generate Schedule entries */
export async function generateScheduleEntries(
  seatId: mongoose.Types.ObjectId,
  lookbackWeeks = DEFAULT_LOOKBACK_WEEKS,
  threshold = DEFAULT_ACTIVITY_THRESHOLD,
): Promise<number> {
  const nWeeksAgo = new Date()
  nWeeksAgo.setDate(nWeeksAgo.getDate() - lookbackWeeks * 7)

  // Aggregate activity logs by (day_of_week, hour)
  const pipeline = [
    { $match: { seat_id: seatId, date: { $gte: nWeeksAgo } } },
    {
      $group: {
        _id: {
          day: { $dayOfWeek: '$date' }, // MongoDB: 1=Sun..7=Sat
          hour: '$hour',
        },
        active_count: { $sum: { $cond: ['$is_active', 1, 0] } },
        total_count: { $sum: 1 },
      },
    },
  ]

  const results = await SeatActivityLog.aggregate(pipeline)
  if (results.length === 0) return 0

  // Calculate total weeks of data for normalization
  const totalWeeks = Math.max(1, lookbackWeeks)

  // Group active hours by day_of_week
  const activeByDay = new Map<number, number[]>()
  for (const r of results) {
    // Convert MongoDB dayOfWeek (1=Sun..7=Sat) to JS (0=Sun..6=Sat)
    const dow = r._id.day === 1 ? 0 : r._id.day - 1
    const activityRate = r.active_count / totalWeeks
    if (activityRate >= threshold) {
      const hours = activeByDay.get(dow) ?? []
      hours.push(r._id.hour)
      activeByDay.set(dow, hours)
    }
  }

  // Delete previous auto entries for this seat
  await Schedule.deleteMany({ seat_id: seatId, source: 'auto' })

  // Generate new schedule entries from merged hour blocks
  let created = 0
  for (const [dayOfWeek, hours] of activeByDay) {
    const blocks = mergeConsecutiveHours(hours)
    for (const block of blocks) {
      await Schedule.create({
        seat_id: seatId,
        day_of_week: dayOfWeek,
        start_hour: block.start,
        end_hour: block.end,
        source: 'auto',
      })
      created++
    }
  }

  return created
}

/** Generate patterns for all active seats */
export async function generateAllPatterns(): Promise<{ total: number; created: number }> {
  const seats = await Seat.find({ token_active: true }).select('_id label').lean()
  let totalCreated = 0

  for (const seat of seats) {
    try {
      const count = await generateScheduleEntries(seat._id)
      if (count > 0) {
        console.log(`[PatternGen] ${seat.label}: ${count} schedule blocks`)
      }
      totalCreated += count
    } catch (err) {
      console.error(`[PatternGen] Failed for ${seat.label}:`, err)
    }
  }

  console.log(`[PatternGen] Done: ${totalCreated} blocks for ${seats.length} seats`)
  return { total: seats.length, created: totalCreated }
}
