const router = require('express').Router();
const { getDb } = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth-middleware');
const { checkAlerts } = require('../services/alert-service');
const { sendWeeklyReport } = require('../services/telegram-service');

router.use(authenticate, requireAdmin);

// POST /api/admin/check-alerts — manually trigger alert check
router.post('/check-alerts', (req, res) => {
  try {
    const result = checkAlerts();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.team, u.seat_id, u.active,
             s.label as seat_label, s.email as seat_email
      FROM users u
      LEFT JOIN seats s ON s.id = u.seat_id
      ORDER BY u.team, u.name
    `).all();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/send-report — trigger Telegram weekly report (rate limited: 1 per 60s)
let lastReportSent = 0;
router.post('/send-report', async (req, res) => {
  const now = Date.now();
  if (now - lastReportSent < 60000) {
    const wait = Math.ceil((60000 - (now - lastReportSent)) / 1000);
    return res.status(429).json({ error: `Vui lòng chờ ${wait}s trước khi gửi lại` });
  }
  try {
    await sendWeeklyReport();
    lastReportSent = Date.now();
    res.json({ message: 'Đã gửi báo cáo qua Telegram' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/bulk-active — set active for all users
router.patch('/users/bulk-active', (req, res) => {
  try {
    const db = getDb();
    const { active } = req.body;
    if (active === undefined) return res.status(400).json({ error: 'active required' });
    // Never disable the current admin user
    const result = db.prepare('UPDATE users SET active = ? WHERE id != ?').run(active ? 1 : 0, req.user.id);
    if (!active) db.prepare('UPDATE users SET active = 1 WHERE id = ?').run(req.user.id);
    res.json({ message: 'Updated', count: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users
router.post('/users', (req, res) => {
  try {
    const db = getDb();
    const { name, email, role = 'user', team, seatId } = req.body;
    if (!name || !email || !team) {
      return res.status(400).json({ error: 'name, email, team required' });
    }
    const result = db.prepare(
      'INSERT INTO users (name, email, role, team, seat_id) VALUES (?, ?, ?, ?, ?)'
    ).run(name, email, role, team, seatId || null);
    const user = db.prepare('SELECT id, name, email, role, team, seat_id FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ user });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id
router.put('/users/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, email, role, team, seatId, active } = req.body;
    const fields = [];
    const values = [];
    if (name) { fields.push('name = ?'); values.push(name); }
    if (email) { fields.push('email = ?'); values.push(email); }
    if (role) { fields.push('role = ?'); values.push(role); }
    if (team) { fields.push('team = ?'); values.push(team); }
    if (seatId !== undefined) { fields.push('seat_id = ?'); values.push(seatId || null); }
    if (active !== undefined) {
      // Prevent admin from disabling themselves
      if (!active && String(req.params.id) === String(req.user.id)) {
        return res.status(400).json({ error: 'Không thể tự tắt tài khoản của mình' });
      }
      fields.push('active = ?'); values.push(active ? 1 : 0);
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const user = db.prepare('SELECT id, name, email, role, team, seat_id, active FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
