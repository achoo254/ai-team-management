import { config } from '../config.js'
import { Seat } from '../models/seat.js'
import { User } from '../models/user.js'
import { UsageLog } from '../models/usage-log.js'
import { Team } from '../models/team.js'
import { getCurrentWeekStart } from './usage-sync-service.js'

/** Format yyyy-MM-dd to dd/MM/yyyy */
function fmtDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

/** Escape HTML special chars for Telegram */
function esc(str: string | number): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Build inline keyboard with app links. Returns undefined if URL is not HTTPS (Telegram requirement). */
function buildInlineKeyboard() {
  const url = config.webUrl
  if (!url.startsWith('https://')) return undefined

  return {
    inline_keyboard: [
      [
        { text: '📊 Dashboard', url: `${url}/dashboard` },
        { text: '📝 Log Usage', url: `${url}/log-usage` },
      ],
      [
        { text: '📅 Lịch phân ca', url: `${url}/schedule` },
        { text: '💺 Quản lý Seats', url: `${url}/seats` },
      ],
    ],
  }
}

/** Build a simple text progress bar */
function buildProgressBar(pct: number): string {
  const filled = Math.round(pct / 10)
  const empty = 10 - filled
  return '▓'.repeat(filled) + '░'.repeat(empty)
}

/** Send weekly usage report to Telegram. Throws if config missing or send fails. */
export async function sendWeeklyReport() {
  if (!config.telegram.botToken || !config.telegram.chatId) {
    throw new Error('Telegram chưa được cấu hình (thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID)')
  }

  const weekStart = getCurrentWeekStart()
  const seats = await Seat.find().sort({ team: 1 }).lean()
  const logs = await UsageLog.find({ week_start: weekStart }).lean()
  const users = await User.find({ active: true }, 'name seat_ids').lean()
  const teamRows = await Team.find({}, 'name label').sort({ name: 1 }).lean()

  // Build lookup: seat_id -> log data (highest pct)
  const logBySeat: Record<string, { weekly_all_pct: number }> = {}
  for (const l of logs) {
    const key = String(l.seat_id)
    if (!logBySeat[key] || l.weekly_all_pct > logBySeat[key].weekly_all_pct) {
      logBySeat[key] = l
    }
  }

  const rows = seats.map((s) => ({
    seat_id: s._id,
    email: s.email,
    label: s.label,
    team: s.team,
    all_pct: logBySeat[String(s._id)]?.weekly_all_pct || 0,
  }))

  // Group users by seat_ids (user can be in multiple seats)
  const usersBySeat: Record<string, string[]> = {}
  for (const u of users) {
    for (const seatId of u.seat_ids ?? []) {
      const key = String(seatId)
      if (!usersBySeat[key]) usersBySeat[key] = []
      usersBySeat[key].push(u.name)
    }
  }

  // Dynamic team labels
  const teamLabels: Record<string, string> = {}
  for (const t of teamRows) teamLabels[t.name] = t.label

  // Group seats by team
  const teams: Record<string, typeof rows> = {}
  for (const r of rows) {
    if (!teams[r.team]) teams[r.team] = []
    teams[r.team].push(r)
  }

  // Build HTML message
  let msg = `📊 <b>Báo cáo Usage tuần ${fmtDate(weekStart)}</b>\n\n`

  for (const [team, teamSeats] of Object.entries(teams)) {
    const label = teamLabels[team] || team
    msg += `<b>📌 ${esc(label)} Team</b>\n`
    msg += `${'─'.repeat(24)}\n`

    for (const s of teamSeats) {
      const warn = s.all_pct >= 80 ? '🔴' : s.all_pct >= 50 ? '🟡' : '🟢'
      const bar = buildProgressBar(s.all_pct)
      msg += `\n${warn} <b>${esc(s.label)}</b> <code>${esc(s.email)}</code>\n`
      msg += `   All: ${bar} ${s.all_pct}%\n`

      const members = usersBySeat[String(s.seat_id)]
      if (members && members.length > 0) {
        msg += `   👥 ${members.map((n) => esc(n)).join(', ')}\n`
      }
    }
    msg += '\n'
  }

  // Summary
  const total = rows.length
  const high = rows.filter((r) => r.all_pct >= 80)
  const mid = rows.filter((r) => r.all_pct >= 50 && r.all_pct < 80)
  msg += `<b>📋 Tổng kết:</b> ${total} seats\n`
  msg += `🟢 Bình thường: ${total - high.length - mid.length} | `
  msg += `🟡 Trung bình: ${mid.length} | `
  msg += `🔴 Cao: ${high.length}\n`

  if (high.length > 0) {
    msg += `\n⚠️ <b>${high.length} seat(s) &gt; 80%</b> — cần giảm tải!`
  }

  await sendMessage(msg)
}

/** Send reminder to log usage before weekly report. Throws if config missing or send fails. */
export async function sendLogReminder() {
  const { botToken, chatId } = config.telegram
  if (!botToken || !chatId) {
    throw new Error('Telegram chưa được cấu hình (thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID)')
  }

  const weekStart = getCurrentWeekStart()
  const loggedSeatIds = await UsageLog.distinct('seat_id', { week_start: weekStart })
  const missing = await Seat.find({ _id: { $nin: loggedSeatIds } }).lean()

  if (missing.length === 0) return

  const users = await User.find({ active: true }, 'name seat_ids').lean()
  const usersBySeat: Record<string, string[]> = {}
  for (const u of users) {
    for (const seatId of u.seat_ids ?? []) {
      const key = String(seatId)
      if (!usersBySeat[key]) usersBySeat[key] = []
      usersBySeat[key].push(u.name)
    }
  }

  let msg = `⏰ <b>Nhắc log usage tuần ${fmtDate(weekStart)}</b>\n\n`
  msg += `<b>Các seat chưa log:</b>\n`
  for (const s of missing) {
    const members = usersBySeat[String(s._id)]
    const memberStr = members ? ` (${members.map((n) => esc(n)).join(', ')})` : ''
    msg += `• <b>${esc(s.label)}</b>${memberStr}\n`
  }
  msg += `\n📝 <i>Vui lòng log trước 17h hôm nay!</i>`

  await sendMessage(msg)
}

/** Send a message to Telegram with HTML + inline buttons. Throws on failure. */
async function sendMessage(text: string) {
  const { botToken, chatId, topicId } = config.telegram

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  const keyboard = buildInlineKeyboard()
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  }
  if (keyboard) body.reply_markup = keyboard
  if (topicId) body.message_thread_id = parseInt(topicId)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[Telegram] Send failed:', res.status, errText)
    throw new Error(`Gửi Telegram thất bại (${res.status}): ${errText}`)
  }
}
