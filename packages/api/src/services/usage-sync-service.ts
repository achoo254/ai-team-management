import { UsageLog } from '../models/usage-log.js'

/** Get Monday of current week as YYYY-MM-DD (local timezone, no UTC shift) */
export function getCurrentWeekStart(): string {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.getFullYear(), now.getMonth(), diff)
  const y = monday.getFullYear()
  const m = String(monday.getMonth() + 1).padStart(2, '0')
  const d = String(monday.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface LogUsageParams {
  seatId: string
  userId: string
  weekStart: string
  weeklyAllPct: number
}

/** Log weekly usage percentages for a seat */
export async function logUsage({ seatId, userId, weekStart, weeklyAllPct }: LogUsageParams) {
  await UsageLog.create({
    seat_id: seatId,
    week_start: weekStart,
    weekly_all_pct: weeklyAllPct,
    user_id: userId,
  })
  return { success: true, weekStart, seatId }
}
