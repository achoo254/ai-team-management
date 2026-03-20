const { getDb } = require('../db/database');
const config = require('../config');

const { highDailyCostCents, weeklyPaceCostCents, sessionSpikeCount, inactivityDays } = config.alerts;

/** Insert alert if not already exists for same seat+type+date */
function insertAlert(db, seatEmail, type, message) {
  const today = new Date().toISOString().split('T')[0];
  const existing = db.prepare(
    'SELECT id FROM alerts WHERE seat_email = ? AND type = ? AND date(created_at) = ?'
  ).get(seatEmail, type, today);

  if (existing) return false;

  db.prepare(
    'INSERT INTO alerts (seat_email, type, message) VALUES (?, ?, ?)'
  ).run(seatEmail, type, message);

  return true;
}

/**
 * Check all alert rules and insert new alerts as needed
 * @returns {Promise<{ created: number }>}
 */
async function checkAlerts() {
  const db = getDb();
  let created = 0;
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const inactivityCutoff = new Date(Date.now() - inactivityDays * 86400000).toISOString().split('T')[0];

  // high_usage: today's cost > threshold per seat
  const dailyUsage = db.prepare(`
    SELECT seat_email, estimated_cost_cents
    FROM usage_logs
    WHERE date = ?
  `).all(today);

  for (const row of dailyUsage) {
    if (row.estimated_cost_cents > highDailyCostCents) {
      const msg = `High daily cost: $${(row.estimated_cost_cents / 100).toFixed(2)} (threshold: $${(highDailyCostCents / 100).toFixed(2)})`;
      if (insertAlert(db, row.seat_email, 'high_usage', msg)) created++;
    }
  }

  // limit_warning: weekly pace per seat
  const weeklyUsage = db.prepare(`
    SELECT seat_email, SUM(estimated_cost_cents) as weekly_cost
    FROM usage_logs
    WHERE date >= ?
    GROUP BY seat_email
  `).all(sevenDaysAgo);

  for (const row of weeklyUsage) {
    if (row.weekly_cost > weeklyPaceCostCents) {
      const msg = `Weekly pace exceeded: $${(row.weekly_cost / 100).toFixed(2)} (threshold: $${(weeklyPaceCostCents / 100).toFixed(2)})`;
      if (insertAlert(db, row.seat_email, 'limit_warning', msg)) created++;
    }
  }

  // session_spike: today sessions > threshold
  for (const row of dailyUsage) {
    const sessions = db.prepare(
      'SELECT sessions FROM usage_logs WHERE seat_email = ? AND date = ?'
    ).get(row.seat_email, today);

    if (sessions && sessions.sessions > sessionSpikeCount) {
      const msg = `Session spike: ${sessions.sessions} sessions today (threshold: ${sessionSpikeCount})`;
      if (insertAlert(db, row.seat_email, 'session_spike', msg)) created++;
    }
  }

  // no_activity: seats with no usage in last N days
  const allSeats = db.prepare('SELECT email FROM seats').all();
  for (const seat of allSeats) {
    const recent = db.prepare(
      'SELECT id FROM usage_logs WHERE seat_email = ? AND date >= ? LIMIT 1'
    ).get(seat.email, inactivityCutoff);

    if (!recent) {
      const msg = `No activity for ${inactivityDays}+ days`;
      if (insertAlert(db, seat.email, 'no_activity', msg)) created++;
    }
  }

  return { created };
}

module.exports = { checkAlerts };
