const config = require('../config');
const { getDb } = require('../db/database');
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

/** Send weekly usage report to Telegram */
async function sendWeeklyReport() {
  if (!config.telegram.botToken || !config.telegram.chatId) return;

  const db = getDb();
  const weekStart = getCurrentWeekStart();

  // Get seats with usage + assigned users
  const rows = db.prepare(`
    SELECT s.id as seat_id, s.email, s.label, s.team,
           COALESCE(u.weekly_all_pct, 0) as all_pct,
           COALESCE(u.weekly_sonnet_pct, 0) as sonnet_pct
    FROM seats s
    LEFT JOIN usage_logs u ON u.seat_email = s.email AND u.week_start = ?
    ORDER BY s.team, all_pct DESC
  `).all(weekStart);

  const users = db.prepare(`
    SELECT name, seat_id, active FROM users WHERE active = 1 ORDER BY seat_id, name
  `).all();

  // Group users by seat_id
  const usersBySeat = {};
  for (const u of users) {
    if (!usersBySeat[u.seat_id]) usersBySeat[u.seat_id] = [];
    usersBySeat[u.seat_id].push(u.name);
  }

  // Get dynamic team labels from teams table
  const teamRows = db.prepare('SELECT name, label FROM teams ORDER BY name').all();
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

  for (const [team, seats] of Object.entries(teams)) {
    const label = teamLabels[team] || team;
    msg += `<b>📌 ${esc(label)} Team</b>\n`;
    msg += `${'─'.repeat(24)}\n`;

    for (const s of seats) {
      const warn = s.all_pct >= 80 ? '🔴' : s.all_pct >= 50 ? '🟡' : '🟢';
      const bar = buildProgressBar(s.all_pct);
      msg += `\n${warn} <b>${esc(s.label)}</b> <code>${esc(s.email)}</code>\n`;
      msg += `   All: ${bar} ${s.all_pct}%\n`;
      msg += `   Sonnet: <b>${s.sonnet_pct}%</b>\n`;

      // Show assigned users
      const members = usersBySeat[s.seat_id];
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

/** Build a simple text progress bar */
function buildProgressBar(pct) {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

/** Send reminder to log usage before weekly report */
async function sendLogReminder() {
  const { botToken, chatId } = config.telegram;
  if (!botToken || !chatId) return;

  const db = getDb();
  const weekStart = getCurrentWeekStart();

  // Find seats that haven't logged this week
  const missing = db.prepare(`
    SELECT s.id as seat_id, s.label, s.email
    FROM seats s
    WHERE s.email NOT IN (
      SELECT DISTINCT seat_email FROM usage_logs WHERE week_start = ?
    )
  `).all(weekStart);

  if (missing.length === 0) return;

  const users = db.prepare(`
    SELECT name, seat_id FROM users WHERE active = 1 ORDER BY seat_id, name
  `).all();
  const usersBySeat = {};
  for (const u of users) {
    if (!usersBySeat[u.seat_id]) usersBySeat[u.seat_id] = [];
    usersBySeat[u.seat_id].push(u.name);
  }

  let msg = `⏰ <b>Nhắc log usage tuần ${fmtDate(weekStart)}</b>\n\n`;
  msg += `<b>Các seat chưa log:</b>\n`;
  for (const s of missing) {
    const members = usersBySeat[s.seat_id];
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
