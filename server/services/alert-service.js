const { getDb } = require('../db/database');
const config = require('../config');

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
 * Check alert rules based on manual usage logs (session-based, not cost-based)
 * Rules:
 * - session_spike: >10 sessions/day per seat
 * - limit_warning: >30 sessions/week per seat
 * - no_activity: no logs in >3 days for a seat
 */
function checkAlerts() {
  const db = getDb();
  let created = 0;

  // Rule 1: Session spike today (>10 sessions)
  const dailySessions = db.prepare(`
    SELECT seat_email, SUM(sessions) as total
    FROM usage_logs WHERE date = date('now')
    GROUP BY seat_email HAVING total >= ?
  `).all(config.alerts.sessionSpikeCount);

  for (const row of dailySessions) {
    const msg = `Seat ${row.seat_email}: ${row.total} sessions hôm nay (ngưỡng: ${config.alerts.sessionSpikeCount})`;
    if (insertIfNew(db, row.seat_email, 'session_spike', msg)) created++;
  }

  // Rule 2: Weekly pace (>30 sessions/week)
  const weeklySessions = db.prepare(`
    SELECT seat_email, SUM(sessions) as total
    FROM usage_logs WHERE date >= date('now', '-7 days')
    GROUP BY seat_email HAVING total >= 30
  `).all();

  for (const row of weeklySessions) {
    const msg = `Seat ${row.seat_email}: ${row.total} sessions tuần này. Nên giảm tải.`;
    if (insertIfNew(db, row.seat_email, 'limit_warning', msg)) created++;
  }

  // Rule 3: No activity >N days
  const allSeats = db.prepare('SELECT email FROM seats').all();
  const cutoff = new Date(Date.now() - config.alerts.inactivityDays * 86400000).toISOString().split('T')[0];

  for (const seat of allSeats) {
    const recent = db.prepare(
      'SELECT id FROM usage_logs WHERE seat_email = ? AND date >= ? LIMIT 1'
    ).get(seat.email, cutoff);
    if (!recent) {
      // Only alert if seat has ever been used
      const ever = db.prepare('SELECT id FROM usage_logs WHERE seat_email = ? LIMIT 1').get(seat.email);
      if (ever) {
        const msg = `Seat ${seat.email}: không có hoạt động ${config.alerts.inactivityDays}+ ngày`;
        if (insertIfNew(db, seat.email, 'no_activity', msg)) created++;
      }
    }
  }

  return { alertsCreated: created };
}

module.exports = { checkAlerts };
