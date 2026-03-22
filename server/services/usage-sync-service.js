const UsageLog = require('../models/usage-log-model');

/** Get Monday of current week as YYYY-MM-DD */
function getCurrentWeekStart() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  return monday.toISOString().split('T')[0];
}

/**
 * Log weekly usage percentages for a seat
 * @param {{ seatEmail: string, userId: string, weekStart: string, weeklyAllPct: number, weeklySonnetPct: number }} data
 */
async function logUsage({ seatEmail, userId, weekStart, weeklyAllPct, weeklySonnetPct }) {
  await UsageLog.create({
    seat_email: seatEmail,
    week_start: weekStart,
    weekly_all_pct: weeklyAllPct,
    weekly_sonnet_pct: weeklySonnetPct,
    user_id: userId,
  });
  return { success: true, weekStart, seatEmail };
}

module.exports = { logUsage, getCurrentWeekStart };
