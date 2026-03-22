const { getDb } = require('../db/database');
const config = require('../config');
const { getCurrentWeekStart } = require('./usage-sync-service');

/** Insert alert if not already exists for same seat+type today */
function insertIfNew(db, seatEmail, type, message) {
  const today = new Date().toISOString().split('T')[0];
  const existing = db.prepare(
    'SELECT id FROM alerts WHERE seat_email = ? AND type = ? AND date(created_at) = ?'
  ).get(seatEmail, type, today);
  if (existing) return false;
  db.prepare('INSERT INTO alerts (seat_email, type, message) VALUES (?, ?, ?)').run(seatEmail, type, message);
  return true;
}

/**
 * Check alert rules based on weekly percentage data
 * - high_usage: latest log for any seat has weekly_all_pct >= 80
 * - no_activity: seat has no log in last N weeks but has been used before
 */
function checkAlerts() {
  const db = getDb();
  let created = 0;

  // Rule 1: High usage — latest week log with weekly_all_pct >= threshold
  const highUsage = db.prepare(`
    SELECT l.seat_email, MAX(l.weekly_all_pct) as weekly_all_pct
    FROM usage_logs l
    INNER JOIN (
      SELECT seat_email, MAX(week_start) as max_week
      FROM usage_logs GROUP BY seat_email
    ) latest ON l.seat_email = latest.seat_email AND l.week_start = latest.max_week
    GROUP BY l.seat_email
    HAVING MAX(l.weekly_all_pct) >= ?
  `).all(config.alerts.highUsagePct);

  for (const row of highUsage) {
    const msg = `Seat ${row.seat_email}: ${row.weekly_all_pct}% usage (ngưỡng: ${config.alerts.highUsagePct}%)`;
    if (insertIfNew(db, row.seat_email, 'high_usage', msg)) created++;
  }

  // Rule 2: No activity — seat has no log in last N weeks
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - (config.alerts.inactivityWeeks * 7));
  const cutoffWeek = cutoffDate.toISOString().split('T')[0];
  const allSeats = db.prepare('SELECT email FROM seats').all();

  for (const seat of allSeats) {
    const recent = db.prepare(
      'SELECT id FROM usage_logs WHERE seat_email = ? AND week_start >= ? LIMIT 1'
    ).get(seat.email, cutoffWeek);
    if (!recent) {
      const ever = db.prepare('SELECT id FROM usage_logs WHERE seat_email = ? LIMIT 1').get(seat.email);
      if (ever) {
        const msg = `Seat ${seat.email}: không có log tuần này`;
        if (insertIfNew(db, seat.email, 'no_activity', msg)) created++;
      }
    }
  }

  return { alertsCreated: created };
}

module.exports = { checkAlerts };
