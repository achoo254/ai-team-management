const config = require('../config');
const Seat = require('../models/seat-model');
const User = require('../models/user-model');
const UsageLog = require('../models/usage-log-model');
const Team = require('../models/team-model');
const { getCurrentWeekStart } = require('./usage-sync-service');

/** Format yyyy-MM-dd to dd/MM/yyyy */
function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/** Escape HTML special chars for Telegram */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Build inline keyboard with app links */
function buildInlineKeyboard() {
  const url = config.appUrl;
  return {
    inline_keyboard: [
      [
        { text: '📊 Dashboard', url: `${url}/#dashboard` },
        { text: '📝 Log Usage', url: `${url}/#log-usage` },
      ],
      [
        { text: '📅 Lịch phân ca', url: `${url}/#schedule` },
        { text: '💺 Quản lý Seats', url: `${url}/#seats` },
      ],
    ],
  };
}

/** Build a simple text progress bar */
function buildProgressBar(pct) {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

/** Send weekly usage report to Telegram */
async function sendWeeklyReport() {
  if (!config.telegram.botToken || !config.telegram.chatId) return;

  const weekStart = getCurrentWeekStart();

  const seats = await Seat.find().sort({ team: 1 }).lean();
  const logs = await UsageLog.find({ week_start: weekStart }).lean();
  const users = await User.find({ active: true }, 'name seat_id').lean();
  const teamRows = await Team.find({}, 'name label').sort({ name: 1 }).lean();

  // Build lookup: seat_email -> log data (highest pct)
  const logBySeat = {};
  for (const l of logs) {
    if (!logBySeat[l.seat_email] || l.weekly_all_pct > logBySeat[l.seat_email].weekly_all_pct) {
      logBySeat[l.seat_email] = l;
    }
  }

  // Build rows similar to old SQL result
  const rows = seats.map(s => ({
    seat_id: s._id,
    email: s.email,
    label: s.label,
    team: s.team,
    all_pct: logBySeat[s.email]?.weekly_all_pct || 0,
    sonnet_pct: logBySeat[s.email]?.weekly_sonnet_pct || 0,
  }));

  // Group users by seat_id (string key for ObjectId)
  const usersBySeat = {};
  for (const u of users) {
    const key = String(u.seat_id);
    if (!usersBySeat[key]) usersBySeat[key] = [];
    usersBySeat[key].push(u.name);
  }

  // Dynamic team labels
  const teamLabels = {};
  for (const t of teamRows) teamLabels[t.name] = t.label;

  // Group seats by team
  const teams = {};
  for (const r of rows) {
    if (!teams[r.team]) teams[r.team] = [];
    teams[r.team].push(r);
  }

  // Build HTML message
  let msg = `📊 <b>Báo cáo Usage tuần ${fmtDate(weekStart)}</b>\n\n`;

  for (const [team, teamSeats] of Object.entries(teams)) {
    const label = teamLabels[team] || team;
    msg += `<b>📌 ${esc(label)} Team</b>\n`;
    msg += `${'─'.repeat(24)}\n`;

    for (const s of teamSeats) {
      const warn = s.all_pct >= 80 ? '🔴' : s.all_pct >= 50 ? '🟡' : '🟢';
      const bar = buildProgressBar(s.all_pct);
      msg += `\n${warn} <b>${esc(s.label)}</b> <code>${esc(s.email)}</code>\n`;
      msg += `   All: ${bar} ${s.all_pct}%\n`;
      msg += `   Sonnet: <b>${s.sonnet_pct}%</b>\n`;

      // Show assigned users
      const members = usersBySeat[String(s.seat_id)];
      if (members && members.length > 0) {
        msg += `   👥 ${members.map(n => esc(n)).join(', ')}\n`;
      }
    }
    msg += '\n';
  }

  // Summary
  const total = rows.length;
  const high = rows.filter(r => r.all_pct >= 80);
  const mid = rows.filter(r => r.all_pct >= 50 && r.all_pct < 80);
  msg += `<b>📋 Tổng kết:</b> ${total} seats\n`;
  msg += `🟢 Bình thường: ${total - high.length - mid.length} | `;
  msg += `🟡 Trung bình: ${mid.length} | `;
  msg += `🔴 Cao: ${high.length}\n`;

  if (high.length > 0) {
    msg += `\n⚠️ <b>${high.length} seat(s) &gt; 80%</b> — cần giảm tải!`;
  }

  await sendMessage(msg);
}

/** Send reminder to log usage before weekly report */
async function sendLogReminder() {
  const { botToken, chatId } = config.telegram;
  if (!botToken || !chatId) return;

  const weekStart = getCurrentWeekStart();

  const loggedEmails = await UsageLog.distinct('seat_email', { week_start: weekStart });
  const missing = await Seat.find({ email: { $nin: loggedEmails } }).lean();

  if (missing.length === 0) return;

  const users = await User.find({ active: true }, 'name seat_id').lean();
  const usersBySeat = {};
  for (const u of users) {
    const key = String(u.seat_id);
    if (!usersBySeat[key]) usersBySeat[key] = [];
    usersBySeat[key].push(u.name);
  }

  let msg = `⏰ <b>Nhắc log usage tuần ${fmtDate(weekStart)}</b>\n\n`;
  msg += `<b>Các seat chưa log:</b>\n`;
  for (const s of missing) {
    const members = usersBySeat[String(s._id)];
    const memberStr = members ? ` (${members.map(n => esc(n)).join(', ')})` : '';
    msg += `• <b>${esc(s.label)}</b>${memberStr}\n`;
  }
  msg += `\n📝 <i>Vui lòng log trước 17h hôm nay!</i>`;

  await sendMessage(msg);
}

/** Send a message to Telegram with HTML + inline buttons */
async function sendMessage(text) {
  const { botToken, chatId, topicId } = config.telegram;
  if (!botToken || !chatId) return;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: buildInlineKeyboard(),
  };
  if (topicId) body.message_thread_id = parseInt(topicId);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[Telegram] Send failed:', res.status, errText);
  }
}

module.exports = { sendWeeklyReport, sendLogReminder };
