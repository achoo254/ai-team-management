const { getDb } = require('../db/database');

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
 * @param {{ seatEmail: string, userId: number, weekStart: string, weeklyAllPct: number, weeklySonnetPct: number }} data
 */
function logUsage({ seatEmail, userId, weekStart, weeklyAllPct, weeklySonnetPct }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO usage_logs (seat_email, week_start, weekly_all_pct, weekly_sonnet_pct, user_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(seatEmail, weekStart, weeklyAllPct, weeklySonnetPct, userId);
  return { success: true, weekStart, seatEmail };
}

module.exports = { logUsage, getCurrentWeekStart };
