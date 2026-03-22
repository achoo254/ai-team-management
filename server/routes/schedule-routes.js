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

// PATCH /api/schedules/swap — swap or move a person between two cells
router.patch('/swap', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { from, to } = req.body;
    // from/to: { seatId, dayOfWeek, slot }
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

    const getEntry = db.prepare(
      'SELECT * FROM schedules WHERE seat_id = ? AND day_of_week = ? AND slot = ?'
    );
    const upsert = db.prepare(`
      INSERT INTO schedules (seat_id, user_id, day_of_week, slot)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(seat_id, day_of_week, slot) DO UPDATE SET user_id = excluded.user_id
    `);
    const remove = db.prepare(
      'DELETE FROM schedules WHERE seat_id = ? AND day_of_week = ? AND slot = ?'
    );

    const fromEntry = getEntry.get(from.seatId, from.dayOfWeek, from.slot);
    const toEntry = getEntry.get(to.seatId, to.dayOfWeek, to.slot);

    if (!fromEntry) return res.status(400).json({ error: 'Source cell has no assignment' });

    // Validate: user must belong to target seat
    const userBelongsToSeat = db.prepare('SELECT 1 FROM users WHERE id = ? AND seat_id = ?');
    if (!userBelongsToSeat.get(fromEntry.user_id, to.seatId)) {
      return res.status(400).json({ error: 'Người dùng không thuộc seat đích' });
    }
    if (toEntry && !userBelongsToSeat.get(toEntry.user_id, from.seatId)) {
      return res.status(400).json({ error: 'Người dùng ở ô đích không thuộc seat nguồn' });
    }

    const tx = db.transaction(() => {
      // Move from → to
      upsert.run(to.seatId, fromEntry.user_id, to.dayOfWeek, to.slot);
      if (toEntry) {
        // Swap: move to → from
        upsert.run(from.seatId, toEntry.user_id, from.dayOfWeek, from.slot);
      } else {
        // Move: clear source
        remove.run(from.seatId, from.dayOfWeek, from.slot);
      }
    });

    tx();
    res.json({ message: toEntry ? 'Swapped' : 'Moved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/schedules/all — clear all schedule entries
router.delete('/all', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM schedules').run();
    res.json({ message: 'All schedules cleared', count: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/schedules/entry — remove a single schedule cell
router.delete('/entry', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { seatId, dayOfWeek, slot } = req.body;
    if (seatId == null || dayOfWeek == null || !slot) {
      return res.status(400).json({ error: 'seatId, dayOfWeek, slot required' });
    }
    db.prepare('DELETE FROM schedules WHERE seat_id = ? AND day_of_week = ? AND slot = ?')
      .run(seatId, dayOfWeek, slot);
    res.json({ message: 'Entry removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedules/assign — assign a user to a specific cell
router.post('/assign', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { seatId, userId, dayOfWeek, slot } = req.body;
    if (seatId == null || userId == null || dayOfWeek == null || !slot) {
      return res.status(400).json({ error: 'seatId, userId, dayOfWeek, slot required' });
    }
    // Validate user belongs to seat
    const user = db.prepare('SELECT 1 FROM users WHERE id = ? AND seat_id = ?').get(userId, seatId);
    if (!user) return res.status(400).json({ error: 'Người dùng không thuộc seat này' });

    db.prepare(`
      INSERT INTO schedules (seat_id, user_id, day_of_week, slot)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(seat_id, day_of_week, slot) DO UPDATE SET user_id = excluded.user_id
    `).run(seatId, userId, dayOfWeek, slot);
    res.json({ message: 'Assigned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
