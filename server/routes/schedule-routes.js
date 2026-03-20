const router = require('express').Router();
const { getDb } = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth-middleware');

router.use(authenticate);

// GET /api/schedules?seatId=
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { seatId } = req.query;

    const sql = seatId
      ? 'SELECT sc.*, u.name as user_name, s.label as seat_label FROM schedules sc JOIN users u ON u.id = sc.user_id JOIN seats s ON s.id = sc.seat_id WHERE sc.seat_id = ? ORDER BY sc.day_of_week, sc.slot'
      : 'SELECT sc.*, u.name as user_name, s.label as seat_label FROM schedules sc JOIN users u ON u.id = sc.user_id JOIN seats s ON s.id = sc.seat_id ORDER BY sc.seat_id, sc.day_of_week, sc.slot';

    const schedules = seatId ? db.prepare(sql).all(seatId) : db.prepare(sql).all();
    res.json({ schedules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedules/today
router.get('/today', (req, res) => {
  try {
    const db = getDb();
    // JS day: 0=Sun, SQLite stores 0-6
    const dayOfWeek = new Date().getDay();

    const schedules = db.prepare(`
      SELECT sc.*, u.name as user_name, u.email as user_email, s.label as seat_label, s.email as seat_email
      FROM schedules sc
      JOIN users u ON u.id = sc.user_id
      JOIN seats s ON s.id = sc.seat_id
      WHERE sc.day_of_week = ?
      ORDER BY sc.seat_id, sc.slot
    `).all(dayOfWeek);

    res.json({ schedules, dayOfWeek });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/schedules/:seatId — replace all schedules for a seat
router.put('/:seatId', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { seatId } = req.params;
    const entries = req.body; // array of { userId, dayOfWeek, slot }

    if (!Array.isArray(entries)) return res.status(400).json({ error: 'Body must be an array' });

    const upsert = db.prepare(`
      INSERT INTO schedules (seat_id, user_id, day_of_week, slot)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(seat_id, day_of_week, slot) DO UPDATE SET user_id = excluded.user_id
    `);

    const tx = db.transaction(() => {
      for (const e of entries) {
        upsert.run(seatId, e.userId, e.dayOfWeek, e.slot);
      }
    });

    tx();
    res.json({ message: 'Schedules updated', count: entries.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
