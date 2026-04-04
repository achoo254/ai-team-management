import { config } from '../config.js'
import { Seat } from '../models/seat.js'
import { User } from '../models/user.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { Team } from '../models/team.js'

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
        { text: '📈 Usage', url: `${url}/usage` },
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

/** Send weekly usage report to Telegram using latest UsageSnapshot data. */
export async function sendWeeklyReport() {
  if (!config.telegram.botToken || !config.telegram.chatId) {
    throw new Error('Telegram chưa được cấu hình (thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID)')
  }

  const seats = await Seat.find().sort({ team: 1 }).lean()
  const users = await User.find({ active: true }, 'name seat_ids').lean()
  const teamRows = await Team.find({}, 'name label').sort({ name: 1 }).lean()

  // Latest snapshot per seat (no time window — TTL index handles cleanup)
  const snapshots = await UsageSnapshot.aggregate([
    { $sort: { fetched_at: -1 } },
    { $group: {
      _id: '$seat_id',
      five_hour_pct: { $first: '$five_hour_pct' },
      seven_day_pct: { $first: '$seven_day_pct' },
      extra_usage: { $first: '$extra_usage' },
    }},
  ])
  const snapMap = new Map(snapshots.map(s => [String(s._id), s]))

  // Group users by seat
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

  // Build rows with snapshot data
  const rows = seats.map((s) => {
    const snap = snapMap.get(String(s._id))
    return {
      seat_id: s._id,
      email: s.email,
      label: s.label,
      team: s.team,
      five_hour_pct: snap?.five_hour_pct ?? null,
      seven_day_pct: snap?.seven_day_pct ?? null,
      extra_usage: snap?.extra_usage ?? null,
    }
  })

  // Group seats by team
  const teams: Record<string, typeof rows> = {}
  for (const r of rows) {
    if (!teams[r.team]) teams[r.team] = []
    teams[r.team].push(r)
  }

  // Build HTML message
  let msg = `📊 <b>Báo cáo Usage — ${new Date().toLocaleDateString('vi-VN')}</b>\n\n`

  for (const [team, teamSeats] of Object.entries(teams)) {
    const label = teamLabels[team] || team
    msg += `<b>📌 ${esc(label)} Team</b>\n`
    msg += `${'─'.repeat(24)}\n`

    for (const s of teamSeats) {
      const highest = Math.max(s.five_hour_pct ?? 0, s.seven_day_pct ?? 0)
      const warn = highest >= 80 ? '🔴' : highest >= 50 ? '🟡' : '🟢'
      msg += `\n${warn} <b>${esc(s.label)}</b> <code>${esc(s.email)}</code>\n`

      if (s.five_hour_pct !== null) {
        msg += `   5h:  ${buildProgressBar(s.five_hour_pct)} ${s.five_hour_pct}%\n`
      }
      if (s.seven_day_pct !== null) {
        msg += `   7d:  ${buildProgressBar(s.seven_day_pct)} ${s.seven_day_pct}%\n`
      }
      if (s.five_hour_pct === null && s.seven_day_pct === null) {
        msg += `   <i>Chưa có dữ liệu</i>\n`
      }

      // Extra credits line (only if enabled)
      if (s.extra_usage?.is_enabled && s.extra_usage.used_credits != null && s.extra_usage.monthly_limit != null) {
        const pct = s.extra_usage.utilization ?? 0
        msg += `   💳 $${s.extra_usage.used_credits}/$${s.extra_usage.monthly_limit} (${pct}%)\n`
      }

      const members = usersBySeat[String(s.seat_id)]
      if (members && members.length > 0) {
        msg += `   👥 ${members.map((n) => esc(n)).join(', ')}\n`
      }
    }
    msg += '\n'
  }

  // Summary
  const total = rows.length
  const high = rows.filter((r) => Math.max(r.five_hour_pct ?? 0, r.seven_day_pct ?? 0) >= 80)
  const mid = rows.filter((r) => {
    const h = Math.max(r.five_hour_pct ?? 0, r.seven_day_pct ?? 0)
    return h >= 50 && h < 80
  })
  msg += `<b>📋 Tổng kết:</b> ${total} seats\n`
  msg += `🟢 Bình thường: ${total - high.length - mid.length} | `
  msg += `🟡 Trung bình: ${mid.length} | `
  msg += `🔴 Cao: ${high.length}\n`

  if (high.length > 0) {
    msg += `\n⚠️ <b>${high.length} seat(s) &gt; 80%</b> — cần giảm tải!`
  }

  await sendMessage(msg)
}

/** Send alert when token refresh fails for a seat */
export async function sendTokenRefreshAlert(seatLabel: string, error: string) {
  if (!config.telegram.botToken || !config.telegram.chatId) return
  const msg = `⚠️ <b>Token refresh failed</b>\n\n`
    + `Seat: <b>${esc(seatLabel)}</b>\n`
    + `Error: <code>${esc(error.slice(0, 200))}</code>\n\n`
    + `Token đã bị deactivate. Vui lòng re-import credential.`
  await sendMessage(msg)
}

/** Send Telegram notification for a new alert. Silently skips if Telegram not configured. */
export async function sendAlertNotification(
  type: 'rate_limit' | 'extra_credit' | 'token_failure',
  seatLabel: string,
  metadata: Record<string, unknown>,
  threshold?: number,
): Promise<void> {
  if (!config.telegram.botToken || !config.telegram.chatId) return

  let msg = ''
  switch (type) {
    case 'rate_limit':
      msg = `🔴 <b>Rate Limit Warning</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Window: ${esc(String(metadata.window ?? ''))} | Usage: ${esc(String(metadata.pct ?? ''))}%\n`
        + `Ngưỡng: ${threshold ?? ''}%`
      break
    case 'extra_credit':
      msg = `💳 <b>Extra Credit Warning</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Credits: $${esc(String(metadata.credits_used ?? ''))}/$${esc(String(metadata.credits_limit ?? ''))} (${esc(String(metadata.pct ?? ''))}%)\n`
        + `Ngưỡng: ${threshold ?? ''}%`
      break
    case 'token_failure':
      msg = `⚠️ <b>Token Failure</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Error: <code>${esc(String(metadata.error ?? 'unknown'))}</code>\n`
        + `→ Cần re-import credential`
      break
  }

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
