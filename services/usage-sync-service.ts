import { UsageLog } from "@/models/usage-log";

/** Get Monday of current week as YYYY-MM-DD */
export function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  return monday.toISOString().split("T")[0];
}

interface LogUsageParams {
  seatEmail: string;
  userId: string;
  weekStart: string;
  weeklyAllPct: number;
  weeklySonnetPct: number;
}

/** Log weekly usage percentages for a seat */
export async function logUsage({ seatEmail, userId, weekStart, weeklyAllPct, weeklySonnetPct }: LogUsageParams) {
  await UsageLog.create({
    seat_email: seatEmail,
    week_start: weekStart,
    weekly_all_pct: weeklyAllPct,
    weekly_sonnet_pct: weeklySonnetPct,
    user_id: userId,
  });
  return { success: true, weekStart, seatEmail };
}
