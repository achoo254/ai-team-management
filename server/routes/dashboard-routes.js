const router = require('express').Router();
const Seat = require('../models/seat-model');
const User = require('../models/user-model');
const UsageLog = require('../models/usage-log-model');
const Alert = require('../models/alert-model');
const Schedule = require('../models/schedule-model');
const { authenticate } = require('../middleware/auth-middleware');

router.use(authenticate);

// GET /api/dashboard/summary — percentage-based summary
router.get('/summary', async (req, res) => {
  try {
    const latestLog = await UsageLog.findOne().sort({ week_start: -1 }).lean();
    const latestWeek = latestLog?.week_start;

    let avgAll = 0, avgSonnet = 0;
    if (latestWeek) {
      const result = await UsageLog.aggregate([
        { $match: { week_start: latestWeek } },
        { $group: {
          _id: null,
          avgAll: { $avg: '$weekly_all_pct' },
          avgSonnet: { $avg: '$weekly_sonnet_pct' },
        }},
      ]);
      if (result.length > 0) {
        avgAll = Math.round(result[0].avgAll) || 0;
        avgSonnet = Math.round(result[0].avgSonnet) || 0;
      }
    }

    const activeAlerts = await Alert.countDocuments({ resolved: false });
    const totalLogs = await UsageLog.countDocuments();

    res.json({ avgAllPct: avgAll, avgSonnetPct: avgSonnet, activeAlerts, totalLogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/usage/by-seat — latest weekly % per seat
router.get('/usage/by-seat', async (req, res) => {
  try {
    // Get latest week per seat_email with max pct
    const latestUsage = await UsageLog.aggregate([
      { $sort: { week_start: -1 } },
      { $group: {
        _id: '$seat_email',
        weekly_all_pct: { $first: '$weekly_all_pct' },
        weekly_sonnet_pct: { $first: '$weekly_sonnet_pct' },
        last_logged: { $first: '$week_start' },
      }},
    ]);

    const usageMap = {};
    for (const u of latestUsage) usageMap[u._id] = u;

    const seats = await Seat.find().lean();
    const users = await User.find({ active: true, seat_id: { $ne: null } }, 'name seat_id').lean();

    // Build usersBySeatEmail via seat lookup
    const seatIdToEmail = {};
    for (const s of seats) seatIdToEmail[String(s._id)] = s.email;

    const usersBySeatEmail = {};
    for (const u of users) {
      const seatEmail = seatIdToEmail[String(u.seat_id)];
      if (seatEmail) {
        if (!usersBySeatEmail[seatEmail]) usersBySeatEmail[seatEmail] = [];
        usersBySeatEmail[seatEmail].push(u.name);
      }
    }

    const enriched = seats.map(s => ({
      seat_id: s._id,
      seat_email: s.email,
      label: s.label,
      team: s.team,
      weekly_all_pct: usageMap[s.email]?.weekly_all_pct || 0,
      weekly_sonnet_pct: usageMap[s.email]?.weekly_sonnet_pct || 0,
      last_logged: usageMap[s.email]?.last_logged || null,
      users: usersBySeatEmail[s.email] || [],
    })).sort((a, b) => b.weekly_all_pct - a.weekly_all_pct);

    res.json({ seats: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/enhanced — all metrics for the new dashboard
router.get('/enhanced', async (req, res) => {
  try {
    const dayOfWeek = new Date().getDay();

    // Team counts
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ active: true });
    const totalSeats = await Seat.countDocuments();

    // Today's schedule
    const schedules = await Schedule.find({ day_of_week: dayOfWeek })
      .populate('user_id', 'name')
      .populate('seat_id', 'label')
      .sort({ seat_id: 1, slot: 1 })
      .lean();

    const todaySchedules = schedules.map(sc => ({
      slot: sc.slot,
      name: sc.user_id?.name,
      seat_label: sc.seat_id?.label,
    }));

    // Alerts summary
    const unresolvedAlerts = await Alert.countDocuments({ resolved: false });

    // Usage per seat (latest week)
    const latestUsage = await UsageLog.aggregate([
      { $sort: { week_start: -1 } },
      { $group: {
        _id: '$seat_email',
        weekly_all_pct: { $first: '$weekly_all_pct' },
        weekly_sonnet_pct: { $first: '$weekly_sonnet_pct' },
      }},
    ]);
    const usageMap = {};
    for (const u of latestUsage) usageMap[u._id] = u;

    const seats = await Seat.find().sort({ _id: 1 }).lean();
    const usagePerSeat = seats.map(s => ({
      label: s.label,
      team: s.team,
      all_pct: usageMap[s.email]?.weekly_all_pct || 0,
      sonnet_pct: usageMap[s.email]?.weekly_sonnet_pct || 0,
    }));

    // Usage trend (last 8 weeks)
    const usageTrend = await UsageLog.aggregate([
      { $group: {
        _id: '$week_start',
        avg_all: { $avg: '$weekly_all_pct' },
        avg_sonnet: { $avg: '$weekly_sonnet_pct' },
      }},
      { $sort: { _id: -1 } },
      { $limit: 8 },
      { $project: {
        week_start: '$_id',
        avg_all: { $round: ['$avg_all', 0] },
        avg_sonnet: { $round: ['$avg_sonnet', 0] },
        _id: 0,
      }},
    ]);
    usageTrend.reverse();

    // Team usage breakdown
    const seatTeamMap = {};
    for (const s of seats) seatTeamMap[s.email] = s.team;

    const teamUsageCalc = {};
    for (const s of seats) {
      const team = s.team;
      if (!teamUsageCalc[team]) teamUsageCalc[team] = { total: 0, count: 0 };
      teamUsageCalc[team].total += usageMap[s.email]?.weekly_all_pct || 0;
      teamUsageCalc[team].count++;
    }
    const teamUsage = Object.entries(teamUsageCalc).map(([team, data]) => ({
      team,
      avg_pct: Math.round(data.total / data.count) || 0,
    }));

    res.json({
      totalUsers, activeUsers, totalSeats, unresolvedAlerts,
      todaySchedules, usagePerSeat, usageTrend, teamUsage,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
