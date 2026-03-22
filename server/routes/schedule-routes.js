const router = require('express').Router();
const Schedule = require('../models/schedule-model');
const User = require('../models/user-model');
const { authenticate, requireAdmin } = require('../middleware/auth-middleware');

router.use(authenticate);

// GET /api/schedules?seatId=
router.get('/', async (req, res) => {
  try {
    const { seatId } = req.query;
    let query = {};
    if (seatId) query.seat_id = seatId;

    const schedules = await Schedule.find(query)
      .populate('user_id', 'name')
      .populate('seat_id', 'label')
      .sort({ seat_id: 1, day_of_week: 1, slot: 1 })
      .lean();

    const result = schedules.map(sc => ({
      ...sc,
      id: sc._id,
      user_name: sc.user_id?.name,
      seat_label: sc.seat_id?.label,
      user_id: sc.user_id?._id,
      seat_id: sc.seat_id?._id,
    }));

    res.json({ schedules: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedules/today
router.get('/today', async (req, res) => {
  try {
    const dayOfWeek = new Date().getDay();

    const schedules = await Schedule.find({ day_of_week: dayOfWeek })
      .populate('user_id', 'name email')
      .populate('seat_id', 'label email')
      .sort({ seat_id: 1, slot: 1 })
      .lean();

    const result = schedules.map(sc => ({
      ...sc,
      id: sc._id,
      user_name: sc.user_id?.name,
      user_email: sc.user_id?.email,
      seat_label: sc.seat_id?.label,
      seat_email: sc.seat_id?.email,
      user_id: sc.user_id?._id,
      seat_id: sc.seat_id?._id,
    }));

    res.json({ schedules: result, dayOfWeek });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/schedules/:seatId — replace all schedules for a seat
router.put('/:seatId', requireAdmin, async (req, res) => {
  try {
    const { seatId } = req.params;
    const entries = req.body; // array of { userId, dayOfWeek, slot }

    if (!Array.isArray(entries)) return res.status(400).json({ error: 'Body must be an array' });

    for (const e of entries) {
      await Schedule.findOneAndUpdate(
        { seat_id: seatId, day_of_week: e.dayOfWeek, slot: e.slot },
        { user_id: e.userId },
        { upsert: true, new: true }
      );
    }

    res.json({ message: 'Schedules updated', count: entries.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/schedules/swap — swap or move a person between two cells
router.patch('/swap', requireAdmin, async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

    const fromEntry = await Schedule.findOne({
      seat_id: from.seatId, day_of_week: from.dayOfWeek, slot: from.slot,
    }).lean();
    const toEntry = await Schedule.findOne({
      seat_id: to.seatId, day_of_week: to.dayOfWeek, slot: to.slot,
    }).lean();

    if (!fromEntry) return res.status(400).json({ error: 'Source cell has no assignment' });

    // Validate: user must belong to target seat
    const userBelongs = await User.findOne({ _id: fromEntry.user_id, seat_id: to.seatId }).lean();
    if (!userBelongs) {
      return res.status(400).json({ error: 'Người dùng không thuộc seat đích' });
    }
    if (toEntry) {
      const toUserBelongs = await User.findOne({ _id: toEntry.user_id, seat_id: from.seatId }).lean();
      if (!toUserBelongs) {
        return res.status(400).json({ error: 'Người dùng ở ô đích không thuộc seat nguồn' });
      }
    }

    // Move from → to
    await Schedule.findOneAndUpdate(
      { seat_id: to.seatId, day_of_week: to.dayOfWeek, slot: to.slot },
      { user_id: fromEntry.user_id, seat_id: to.seatId, day_of_week: to.dayOfWeek, slot: to.slot },
      { upsert: true }
    );
    if (toEntry) {
      // Swap: move to → from
      await Schedule.findOneAndUpdate(
        { seat_id: from.seatId, day_of_week: from.dayOfWeek, slot: from.slot },
        { user_id: toEntry.user_id },
        { upsert: true }
      );
    } else {
      // Move: clear source
      await Schedule.deleteOne({ seat_id: from.seatId, day_of_week: from.dayOfWeek, slot: from.slot });
    }

    res.json({ message: toEntry ? 'Swapped' : 'Moved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/schedules/all — clear all schedule entries
router.delete('/all', requireAdmin, async (req, res) => {
  try {
    const result = await Schedule.deleteMany({});
    res.json({ message: 'All schedules cleared', count: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/schedules/entry — remove a single schedule cell
router.delete('/entry', requireAdmin, async (req, res) => {
  try {
    const { seatId, dayOfWeek, slot } = req.body;
    if (seatId == null || dayOfWeek == null || !slot) {
      return res.status(400).json({ error: 'seatId, dayOfWeek, slot required' });
    }
    await Schedule.deleteOne({ seat_id: seatId, day_of_week: dayOfWeek, slot });
    res.json({ message: 'Entry removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedules/assign — assign a user to a specific cell
router.post('/assign', requireAdmin, async (req, res) => {
  try {
    const { seatId, userId, dayOfWeek, slot } = req.body;
    if (seatId == null || userId == null || dayOfWeek == null || !slot) {
      return res.status(400).json({ error: 'seatId, userId, dayOfWeek, slot required' });
    }
    // Validate user belongs to seat
    const user = await User.findOne({ _id: userId, seat_id: seatId }).lean();
    if (!user) return res.status(400).json({ error: 'Người dùng không thuộc seat này' });

    await Schedule.findOneAndUpdate(
      { seat_id: seatId, day_of_week: dayOfWeek, slot },
      { user_id: userId },
      { upsert: true }
    );
    res.json({ message: 'Assigned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
