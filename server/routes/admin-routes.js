const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth-middleware');
const { importCsv } = require('../services/usage-sync-service');
const { checkAlerts } = require('../services/alert-service');

router.use(authenticate, requireAdmin);

// POST /api/admin/import-csv — import usage data from Console CSV export
router.post('/import-csv', (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'rows array required' });
    }
    const result = importCsv(rows);
    // Run alert check after import
    const alertResult = checkAlerts();
    res.json({ import: result, alerts: alertResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
      SELECT u.id, u.name, u.email, u.role, u.team, u.seat_id,
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

// POST /api/admin/users
router.post('/users', (req, res) => {
  try {
    const db = getDb();
    const { name, email, password, role = 'user', team, seatId } = req.body;
    if (!name || !email || !password || !team) {
      return res.status(400).json({ error: 'name, email, password, team required' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (name, email, password_hash, role, team, seat_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, email, hash, role, team, seatId || null);
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
    const { name, email, password, role, team, seatId } = req.body;
    const fields = [];
    const values = [];
    if (name) { fields.push('name = ?'); values.push(name); }
    if (email) { fields.push('email = ?'); values.push(email); }
    if (password) { fields.push('password_hash = ?'); values.push(bcrypt.hashSync(password, 10)); }
    if (role) { fields.push('role = ?'); values.push(role); }
    if (team) { fields.push('team = ?'); values.push(team); }
    if (seatId !== undefined) { fields.push('seat_id = ?'); values.push(seatId || null); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const user = db.prepare('SELECT id, name, email, role, team, seat_id FROM users WHERE id = ?').get(req.params.id);
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
