const router = require('express').Router();
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth-middleware');

router.use(authenticate);

// GET /api/dashboard/summary
router.get('/summary', (req, res) => {
  try {
    const db = getDb();

    const sessionsToday = db.prepare(
      "SELECT COALESCE(SUM(sessions), 0) as total FROM usage_logs WHERE date = date('now')"
    ).get().total;

    const logsThisWeek = db.prepare(
      "SELECT COUNT(*) as total FROM usage_logs WHERE date >= date('now', '-7 days')"
    ).get().total;

    const logsThisMonth = db.prepare(
      "SELECT COUNT(*) as total FROM usage_logs WHERE date >= date('now', 'start of month')"
    ).get().total;

    const activeAlerts = db.prepare(
      'SELECT COUNT(*) as total FROM alerts WHERE resolved = 0'
    ).get().total;

    res.json({ sessionsToday, logsThisWeek, logsThisMonth, activeAlerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/usage?from=&to=
router.get('/usage', (req, res) => {
  try {
    const db = getDb();
    const { from, to } = req.query;
    const fromDate = from || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];

    const rows = db.prepare(
      'SELECT * FROM usage_logs WHERE date >= ? AND date <= ? ORDER BY date DESC'
    ).all(fromDate, toDate);

    res.json({ usage: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/usage/by-seat
router.get('/usage/by-seat', (req, res) => {
  try {
    const db = getDb();

    const rows = db.prepare(`
      SELECT
        s.id as seat_id, s.email as seat_email, s.label, s.team,
        COALESCE(SUM(u.sessions), 0) as total_sessions,
        COUNT(u.id) as total_logs,
        MAX(u.date) as last_active
      FROM seats s
      LEFT JOIN usage_logs u ON u.seat_email = s.email
        AND u.date >= date('now', '-7 days')
      GROUP BY s.id
      ORDER BY total_sessions DESC
    `).all();

    // Get users per seat
    const users = db.prepare(`
      SELECT u.name, u.id, s.email as seat_email
      FROM users u JOIN seats s ON s.id = u.seat_id
    `).all();

    const usersBySeat = {};
    for (const u of users) {
      if (!usersBySeat[u.seat_email]) usersBySeat[u.seat_email] = [];
      usersBySeat[u.seat_email].push(u.name);
    }

    const enriched = rows.map(r => ({
      ...r,
      users: usersBySeat[r.seat_email] || [],
    }));

    res.json({ seats: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
