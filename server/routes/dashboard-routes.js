const router = require('express').Router();
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth-middleware');

router.use(authenticate);

// GET /api/dashboard/summary — percentage-based summary
router.get('/summary', (req, res) => {
  try {
    const db = getDb();

    const avgAll = db.prepare(`
      SELECT COALESCE(ROUND(AVG(weekly_all_pct)), 0) as val
      FROM usage_logs WHERE week_start = (SELECT MAX(week_start) FROM usage_logs)
    `).get().val;

    const avgSonnet = db.prepare(`
      SELECT COALESCE(ROUND(AVG(weekly_sonnet_pct)), 0) as val
      FROM usage_logs WHERE week_start = (SELECT MAX(week_start) FROM usage_logs)
    `).get().val;

    const activeAlerts = db.prepare(
      'SELECT COUNT(*) as total FROM alerts WHERE resolved = 0'
    ).get().total;

    const totalLogs = db.prepare('SELECT COUNT(*) as total FROM usage_logs').get().total;

    res.json({ avgAllPct: avgAll, avgSonnetPct: avgSonnet, activeAlerts, totalLogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/usage/by-seat — latest weekly % per seat
router.get('/usage/by-seat', (req, res) => {
  try {
    const db = getDb();

    const rows = db.prepare(`
      SELECT
        s.id as seat_id, s.email as seat_email, s.label, s.team,
        COALESCE(u.weekly_all_pct, 0) as weekly_all_pct,
        COALESCE(u.weekly_sonnet_pct, 0) as weekly_sonnet_pct,
        u.last_logged
      FROM seats s
      LEFT JOIN (
        SELECT l.seat_email,
               MAX(l.weekly_all_pct) as weekly_all_pct,
               MAX(l.weekly_sonnet_pct) as weekly_sonnet_pct,
               l.week_start as last_logged
        FROM usage_logs l
        INNER JOIN (
          SELECT seat_email, MAX(week_start) as max_week
          FROM usage_logs GROUP BY seat_email
        ) latest ON l.seat_email = latest.seat_email AND l.week_start = latest.max_week
        GROUP BY l.seat_email
      ) u ON u.seat_email = s.email
      ORDER BY weekly_all_pct DESC
    `).all();

    // Get users per seat
    const users = db.prepare(`
      SELECT u.name, s.email as seat_email
      FROM users u JOIN seats s ON s.id = u.seat_id
      WHERE u.active = 1
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

// GET /api/dashboard/enhanced — all metrics for the new dashboard
router.get('/enhanced', (req, res) => {
  try {
    const db = getDb();
    const dayOfWeek = new Date().getDay();

    // Team counts
    const totalUsers = db.prepare('SELECT COUNT(*) as v FROM users').get().v;
    const activeUsers = db.prepare('SELECT COUNT(*) as v FROM users WHERE active = 1').get().v;
    const totalSeats = db.prepare('SELECT COUNT(*) as v FROM seats').get().v;

    // Today's schedule
    const todaySchedules = db.prepare(`
      SELECT sc.slot, u.name, s.label as seat_label
      FROM schedules sc
      JOIN users u ON u.id = sc.user_id
      JOIN seats s ON s.id = sc.seat_id
      WHERE sc.day_of_week = ?
      ORDER BY sc.seat_id, sc.slot
    `).all(dayOfWeek);

    // Alerts summary
    const unresolvedAlerts = db.prepare('SELECT COUNT(*) as v FROM alerts WHERE resolved = 0').get().v;

    // Usage per seat (latest week)
    const usagePerSeat = db.prepare(`
      SELECT s.label, s.team,
        COALESCE(u.weekly_all_pct, 0) as all_pct,
        COALESCE(u.weekly_sonnet_pct, 0) as sonnet_pct
      FROM seats s
      LEFT JOIN (
        SELECT l.seat_email, MAX(l.weekly_all_pct) as weekly_all_pct,
               MAX(l.weekly_sonnet_pct) as weekly_sonnet_pct
        FROM usage_logs l
        INNER JOIN (SELECT seat_email, MAX(week_start) as mw FROM usage_logs GROUP BY seat_email) lt
          ON l.seat_email = lt.seat_email AND l.week_start = lt.mw
        GROUP BY l.seat_email
      ) u ON u.seat_email = s.email
      ORDER BY s.id
    `).all();

    // Usage trend (last 8 weeks)
    const usageTrend = db.prepare(`
      SELECT week_start, ROUND(AVG(weekly_all_pct)) as avg_all, ROUND(AVG(weekly_sonnet_pct)) as avg_sonnet
      FROM usage_logs
      GROUP BY week_start
      ORDER BY week_start DESC
      LIMIT 8
    `).all().reverse();

    // Team usage breakdown
    const teamUsage = db.prepare(`
      SELECT s.team, ROUND(AVG(COALESCE(u.weekly_all_pct, 0))) as avg_pct
      FROM seats s
      LEFT JOIN (
        SELECT l.seat_email, MAX(l.weekly_all_pct) as weekly_all_pct
        FROM usage_logs l
        INNER JOIN (SELECT seat_email, MAX(week_start) as mw FROM usage_logs GROUP BY seat_email) lt
          ON l.seat_email = lt.seat_email AND l.week_start = lt.mw
        GROUP BY l.seat_email
      ) u ON u.seat_email = s.email
      GROUP BY s.team
    `).all();

    res.json({
      totalUsers, activeUsers, totalSeats, unresolvedAlerts,
      todaySchedules, usagePerSeat, usageTrend, teamUsage
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
