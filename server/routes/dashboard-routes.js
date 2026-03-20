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

    const tokensThisWeek = db.prepare(
      "SELECT COALESCE(SUM(input_tokens + output_tokens), 0) as total FROM usage_logs WHERE date >= date('now', '-7 days')"
    ).get().total;

    const costThisMonth = db.prepare(
      "SELECT COALESCE(SUM(estimated_cost_cents), 0) as total FROM usage_logs WHERE date >= date('now', 'start of month')"
    ).get().total;

    const activeAlerts = db.prepare(
      'SELECT COUNT(*) as total FROM alerts WHERE resolved = 0'
    ).get().total;

    res.json({ sessionsToday, tokensThisWeek, costThisMonth, activeAlerts });
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
        COALESCE(SUM(u.input_tokens + u.output_tokens), 0) as total_tokens,
        COALESCE(SUM(u.estimated_cost_cents), 0) as total_cost_cents,
        MAX(u.date) as last_active
      FROM seats s
      LEFT JOIN usage_logs u ON u.seat_email = s.email
      GROUP BY s.id
      ORDER BY total_cost_cents DESC
    `).all();

    res.json({ seats: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
