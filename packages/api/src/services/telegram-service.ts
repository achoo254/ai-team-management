import { config } from '../config.js'
import { Seat } from '../models/seat.js'
import { User, type IUser } from '../models/user.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { decrypt, isEncryptionConfigured } from '../lib/encryption.js'
import { computeFleetKpis } from './bld-metrics-service.js'
import type { FleetKpis, FleetEfficiency } from '@repo/shared/types'
// AlertType imported from shared (same type used by alert-service + fcm-service)
type AlertType = import('@repo/shared/types').AlertType

/** Escape HTML special chars for Telegram */
function esc(str: string | number): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Build inline keyboard with app links. Appends ?seat=<id> when seatId provided for deep-linking. */
function buildInlineKeyboard(seatId?: string) {
  const url = config.webUrl
  if (!url.startsWith('https://')) return undefined

  const q = seatId ? `?seat=${seatId}` : ''
  return {
    inline_keyboard: [
      [
        { text: '📊 Dashboard', url: `${url}/dashboard${q}` },
        { text: '📈 Usage', url: `${url}/usage${q}` },
      ],
      [
        { text: '📅 Hoạt động Seats', url: `${url}/schedule${q}` },
        { text: '💺 Quản lý Seats', url: `${url}/seats${q}` },
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

/** Shared data types for report building */
interface SeatRow {
  seat_id: unknown
  email: string
  label: string
  five_hour_pct: number | null
  seven_day_pct: number | null
  seven_day_resets_at: Date | null
  extra_usage: { is_enabled: boolean; used_credits: number | null; monthly_limit: number | null; utilization: number | null } | null
}

/** Format a Date to VN date string (dd/MM) */
function fmtVnDate(d: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit',
  }).format(d)
}

/** Build efficiency section from FleetEfficiency data */
function buildEfficiencySection(eff: FleetEfficiency, seatResetMap: Map<string, Date | null>): string {
  if (eff.total_seats === 0) return ''

  // All unknown → show collecting message
  if (eff.unknown_count === eff.total_seats) {
    return `── <b>HIỆU QUẢ SỬ DỤNG</b> ────\n⏸ Đang thu thập dữ liệu (${eff.total_seats} seats)\n`
  }

  let msg = `── <b>HIỆU QUẢ SỬ DỤNG</b> ────\n`
  msg += `✅ Tối ưu:     ${eff.optimal_count} seats\n`

  if (eff.overload.length > 0) {
    const names = eff.overload
      .slice(0, 3)
      .map(o => {
        // Calculate specific exhaustion date from hours_early + reset date
        const resetAt = seatResetMap.get(o.seat_id)
        if (resetAt && o.hours_early > 0) {
          const exhaustDate = new Date(resetAt.getTime() - o.hours_early * 3600_000)
          return `${esc(o.seat_label)} (cạn ${fmtVnDate(exhaustDate)})`
        }
        return `${esc(o.seat_label)}`
      })
      .join(', ')
    const more = eff.overload.length > 3 ? ` +${eff.overload.length - 3}` : ''
    msg += `🔴 Quá tải:    ${eff.overload.length} seat(s) — ${names}${more}\n`
  } else {
    msg += `🔴 Quá tải:    0 seats\n`
  }

  if (eff.waste.seats.length > 0) {
    const names = eff.waste.seats
      .slice(0, 3)
      .map(w => `${esc(w.seat_label)} (${w.projected_pct}%)`)
      .join(', ')
    const more = eff.waste.seats.length > 3 ? ` +${eff.waste.seats.length - 3}` : ''
    msg += `🟡 Lãng phí:   ${eff.waste.seats.length} seats — ${names}${more} (~$${Math.round(eff.waste.total_waste_usd)}/chu kỳ)\n`
  } else {
    msg += `🟡 Lãng phí:   0 seats\n`
  }

  if (eff.unknown_count > 0) {
    msg += `⏸ Chưa đủ dữ liệu: ${eff.unknown_count} seats\n`
  }

  return msg
}

/** Build overview section from fleet KPIs */
function buildOverviewSection(kpis: FleetKpis, seatResetMap: Map<string, Date | null>): string {
  let msg = `── <b>TỔNG QUAN</b> ──────────────\n`
  msg += `📈 Tận dụng TB 7 ngày: <b>${Math.round(kpis.utilPct)}%</b>`
  if (kpis.wwDelta !== 0) {
    const sign = kpis.wwDelta > 0 ? '+' : ''
    msg += ` (so tuần trước: ${sign}${kpis.wwDelta.toFixed(1)}%)`
  }
  msg += `\n`
  msg += `💸 Lãng phí ước tính: <b>$${Math.round(kpis.wasteUsd)}</b>/$${Math.round(kpis.totalCostUsd)}/tháng\n`
  msg += `💺 Tổng: ${kpis.billableCount} seats\n`

  if (kpis.efficiency) {
    msg += `\n` + buildEfficiencySection(kpis.efficiency, seatResetMap)
  }

  return msg
}

/** Pick color emoji based on 7d usage: higher = better (green), lower = worse (red).
 *  Goal: maximize quota utilization — high usage is efficient. */
function usageColorEmoji(sevenDayPct: number | null): string {
  const pct = sevenDayPct ?? 0
  if (pct >= 70) return '🟢'  // Efficient: good utilization
  if (pct >= 40) return '🟡'  // Moderate: could use more
  return '🔴'                  // Low: wasting quota
}

/** Build HTML report from seat rows + optional fleet overview */
function buildReportHtml(
  rows: SeatRow[],
  usersBySeat: Record<string, string[]>,
  kpis: FleetKpis | null,
): string {
  let msg = `📊 <b>Báo cáo Usage — ${new Date().toLocaleDateString('vi-VN')}</b>\n\n`

  // Build reset date map for efficiency section
  const seatResetMap = new Map<string, Date | null>()
  for (const r of rows) {
    seatResetMap.set(String(r.seat_id), r.seven_day_resets_at)
  }

  // Fleet overview section
  if (kpis) {
    msg += buildOverviewSection(kpis, seatResetMap)
    msg += `\n── <b>CHI TIẾT SEATS</b> ──────────\n\n`
  }

  for (const s of rows) {
    const color = usageColorEmoji(s.seven_day_pct)
    msg += `${color} <b>${esc(s.label)}</b> <code>${esc(s.email)}</code>\n`

    if (s.five_hour_pct !== null) {
      msg += `   5h:  ${buildProgressBar(s.five_hour_pct)} ${s.five_hour_pct}%\n`
    }
    if (s.seven_day_pct !== null) {
      msg += `   7d:  ${buildProgressBar(s.seven_day_pct)} ${s.seven_day_pct}%\n`
    }
    if (s.five_hour_pct === null && s.seven_day_pct === null) {
      msg += `   <i>Chưa có dữ liệu</i>\n`
    }

    // Show 7d reset date
    if (s.seven_day_resets_at) {
      const resetStr = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(s.seven_day_resets_at)
      msg += `   🔄 Reset 7d: ${resetStr}\n`
    }

    if (s.extra_usage?.is_enabled && s.extra_usage.monthly_limit != null) {
      const used = s.extra_usage.used_credits ?? 0
      if (used > 0) {
        const pct = s.extra_usage.utilization ?? 0
        msg += `   💳 Phí phát sinh: $${used}/$${s.extra_usage.monthly_limit} (${pct}%)\n`
      } else {
        msg += `   💳 Phí phát sinh: chưa dùng (giới hạn $${s.extra_usage.monthly_limit})\n`
      }
    }

    const members = usersBySeat[String(s.seat_id)]
    if (members && members.length > 0) {
      msg += `   👥 ${members.map((n) => esc(n)).join(', ')}\n`
    }
    msg += '\n'
  }

  // Summary — color logic: high 7d = green (efficient), low 7d = red (wasteful)
  const total = rows.length
  const efficient = rows.filter((r) => (r.seven_day_pct ?? 0) >= 70)
  const moderate = rows.filter((r) => {
    const pct = r.seven_day_pct ?? 0
    return pct >= 40 && pct < 70
  })
  const low = total - efficient.length - moderate.length
  msg += `<b>📋 Tổng kết:</b> ${total} seats\n`
  msg += `🟢 Hiệu quả: ${efficient.length} | `
  msg += `🟡 Trung bình: ${moderate.length} | `
  msg += `🔴 Thấp: ${low}\n`

  return msg
}

/** Fetch common report data: snapshots map, users by seat */
async function fetchReportData() {
  const users = await User.find({ active: true }, 'name seat_ids').lean()

  const snapshots = await UsageSnapshot.aggregate([
    { $sort: { fetched_at: -1 } },
    { $group: {
      _id: '$seat_id',
      five_hour_pct: { $first: '$five_hour_pct' },
      seven_day_pct: { $first: '$seven_day_pct' },
      seven_day_resets_at: { $first: '$seven_day_resets_at' },
      extra_usage: { $first: '$extra_usage' },
    }},
  ])
  const snapMap = new Map(snapshots.map(s => [String(s._id), s]))

  const usersBySeat: Record<string, string[]> = {}
  for (const u of users) {
    for (const seatId of u.seat_ids ?? []) {
      const key = String(seatId)
      if (!usersBySeat[key]) usersBySeat[key] = []
      usersBySeat[key].push(u.name)
    }
  }

  return { snapMap, usersBySeat }
}

/** Build seat rows from seats + snapshot map */
function buildSeatRows(seats: any[], snapMap: Map<string, any>): SeatRow[] {
  return seats.map((s) => {
    const snap = snapMap.get(String(s._id))
    return {
      seat_id: s._id,
      email: s.email,
      label: s.label,
      five_hour_pct: snap?.five_hour_pct ?? null,
      seven_day_pct: snap?.seven_day_pct ?? null,
      seven_day_resets_at: snap?.seven_day_resets_at ? new Date(snap.seven_day_resets_at) : null,
      extra_usage: snap?.extra_usage ?? null,
    }
  })
}

/** Send usage report for a specific user covering all their watched seats. */
export async function sendUserReport(userId: string) {
  if (!isEncryptionConfigured()) return

  const user = await User.findById(userId, 'telegram_bot_token telegram_chat_id telegram_topic_id watched_seats name seat_ids')
  if (!user?.telegram_bot_token || !user?.telegram_chat_id) return

  const watchedIds = (user.watched_seats ?? []).map((w) => String(w.seat_id))
  let seats
  if (watchedIds.length > 0) {
    seats = await Seat.find({ _id: { $in: watchedIds }, include_in_overview: true }).sort({ label: 1 }).lean()
  } else {
    // Fallback: owned + assigned seats (only include_in_overview)
    const ownedSeats = await Seat.find({ owner_id: userId, include_in_overview: true }).lean()
    const assignedSeats = user.seat_ids?.length
      ? await Seat.find({ _id: { $in: user.seat_ids }, include_in_overview: true }).lean()
      : []
    const seatMap = new Map<string, any>()
    for (const s of [...ownedSeats, ...assignedSeats]) seatMap.set(String(s._id), s)
    seats = Array.from(seatMap.values()).sort((a: any, b: any) => a.label.localeCompare(b.label))
  }

  if (seats.length === 0) return

  const seatIds = seats.map((s: any) => String(s._id))
  const [{ snapMap, usersBySeat }, kpis] = await Promise.all([
    fetchReportData(),
    computeFleetKpis({ type: 'user', seatIds }).catch(() => null),
  ])
  const rows = buildSeatRows(seats, snapMap)
  const msg = buildReportHtml(rows, usersBySeat, kpis)

  const token = decrypt(user.telegram_bot_token)
  await sendMessageWithBot(token, user.telegram_chat_id, msg, user.telegram_topic_id ?? undefined)
}

/** Cron handler — for each user with report_enabled + matching day/hour, send report.
 *  Dedup via last_report_sent_at: skip if already sent today (same VN date). */
export async function checkAndSendScheduledReports() {
  const now = new Date()
  const { day, hour } = currentVnDayHour(now)

  const users = await User.find({
    'notification_settings.report_enabled': true,
    'notification_settings.report_days': day,
    'notification_settings.report_hour': hour,
    telegram_bot_token: { $ne: null },
    telegram_chat_id: { $ne: null },
  })

  // Today's VN date string for dedup
  const todayVn = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now)

  for (const user of users) {
    try {
      // Dedup: skip if already sent for today's VN date
      const lastSent = user.notification_settings?.last_report_sent_at
      if (lastSent) {
        const lastVn = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(lastSent))
        if (lastVn === todayVn) continue
      }

      await sendUserReport(String(user._id))

      // Mark as sent
      if (!user.notification_settings) {
        user.notification_settings = { report_enabled: true, report_days: [5], report_hour: 9, last_report_sent_at: now }
      } else {
        user.notification_settings.last_report_sent_at = now
      }
      await user.save()
      console.log(`[Scheduler] Sent report to ${user.name}`)
    } catch (err) {
      console.error(`[Scheduler] Failed for ${user.name}:`, err)
    }
  }
}

/** Send alert to a specific user via their personal bot */
export async function sendAlertToUser(
  user: IUser,
  type: AlertType,
  seatLabel: string,
  metadata: Record<string, unknown>,
  seatId?: string,
): Promise<void> {
  if (!user.telegram_bot_token || !user.telegram_chat_id || !isEncryptionConfigured()) return

  let msg: string
  switch (type) {
    case 'rate_limit': {
      const win = String(metadata.window ?? metadata.session ?? '')
      const pct = metadata.max_pct ?? metadata.pct
      const threshold = metadata.threshold
      const resetsAt = metadata.resets_at ? new Date(metadata.resets_at as string).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ''
      msg = `🔴 <b>Rate Limit Warning</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Window: ${esc(win)} | Usage: <b>${esc(String(pct ?? ''))}%</b>`
        + (threshold != null ? ` (ngưỡng ${esc(String(threshold))}%)` : '')
        + (resetsAt ? `\nReset: ${esc(resetsAt)}` : '')
      break
    }
    case 'token_failure':
      msg = `⚠️ <b>Token Failure</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Error: <code>${esc(String(metadata.error ?? 'unknown'))}</code>\n`
        + `→ Cần re-import credential`
      break
    case 'usage_exceeded':
      if (metadata.next_user) {
        msg = `📢 <b>Sắp đến lượt bạn</b>\n`
          + `Seat: <b>${esc(seatLabel)}</b>\n`
          + `User trước đã vượt budget — seat sắp sẵn sàng cho bạn`
      } else {
        msg = `🚫 <b>Usage Budget Exceeded</b>\n`
          + `Seat: <b>${esc(seatLabel)}</b>\n`
          + `User: ${esc(String(metadata.user_name ?? ''))}\n`
          + `Usage: ${esc(String(metadata.delta ?? ''))}% / Budget: ${esc(String(metadata.budget ?? ''))}%\n`
          + `Session: ${esc(String(metadata.session ?? ''))}\n`
          + `→ Vui lòng dừng sử dụng ngay`
      }
      break
    case 'session_waste':
      msg = `⚠️ <b>Session lãng phí</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `User: ${esc(String(metadata.user_name ?? ''))}\n`
        + `Thời gian: ${esc(String(metadata.duration ?? ''))}h nhưng chỉ dùng ${esc(String(metadata.delta ?? ''))}%\n`
        + `→ Cân nhắc rút ngắn session hoặc nhường seat`
      break
    case '7d_risk':
      msg = `🔴 <b>7d Usage Risk</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Hiện tại: ${esc(String(metadata.current_7d ?? ''))}%\n`
        + `Dự kiến: ${esc(String(metadata.projected ?? ''))}% (còn ${esc(String(metadata.remaining_sessions ?? ''))} sessions)\n`
        + `→ Cần giảm tải hoặc chuyển sang seat khác`
      break
    case 'quota_forecast': {
      const daysFmt = metadata.hours_to_full ? (Number(metadata.hours_to_full) / 24).toFixed(1) : '?'
      const slope = metadata.slope_per_hour ? Number(metadata.slope_per_hour).toFixed(1) : '?'
      const resetsIn = metadata.resets_at
        ? ((new Date(metadata.resets_at as string).getTime() - Date.now()) / 3600_000 / 24).toFixed(1)
        : null
      msg = `📈 <b>Quota Forecast Warning</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Hiện: ${esc(String(metadata.pct ?? ''))}% | Tăng: ${esc(slope)}%/h\n`
        + `Dự kiến chạm 100% trong ~${esc(daysFmt)} ngày`
        + (resetsIn ? `\nReset sau ${esc(resetsIn)} ngày` : '')
      break
    }
    case 'fast_burn': {
      const rate = metadata.burn_rate_per_hour ?? metadata.velocity ?? metadata.pct
      const mins = metadata.minutes_to_full ?? (metadata.eta_hours != null ? Math.round(Number(metadata.eta_hours) * 60) : null)
      msg = `⚡ <b>Fast Burn Alert</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Tiêu hao: ${esc(String(rate ?? ''))}%/h\n`
        + `Hiện: ${esc(String(metadata.pct ?? ''))}%`
        + (mins != null ? ` | Còn ~${esc(String(mins))} phút` : '')
      break
    }
    case 'unexpected_activity':
      msg = `🟡 <b>Hoạt động ngoài dự kiến</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Seat đang hoạt động ngoài giờ dự kiến`
      break
    case 'unexpected_idle':
      msg = `🟡 <b>Rảnh ngoài dự kiến</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Seat không hoạt động trong giờ dự kiến`
      break
    default:
      msg = `ℹ️ <b>${esc(type)}</b>\nSeat: <b>${esc(seatLabel)}</b>`
      break
  }

  const token = decrypt(user.telegram_bot_token)
  await sendMessageWithBot(token, user.telegram_chat_id, msg, user.telegram_topic_id ?? undefined, seatId)
}

/** Send via arbitrary bot token + chat ID */
async function sendMessageWithBot(botToken: string, chatId: string, text: string, topicId?: string, seatId?: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  const keyboard = buildInlineKeyboard(seatId)
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

/** Resolve current day-of-week (0=Sun..6=Sat) and hour (0-23) in Asia/Ho_Chi_Minh. */
function currentVnDayHour(now: Date): { day: number; hour: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: 'numeric', hour12: false,
    weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]))
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    day: dayMap[parts.weekday] ?? now.getDay(),
    hour: Number(parts.hour),
  }
}


/** Send notification to a specific user via their personal bot */
export async function sendToUser(userId: string, message: string) {
  if (!isEncryptionConfigured()) return
  try {
    const user = await User.findById(userId, 'telegram_bot_token telegram_chat_id telegram_topic_id')
    if (user?.telegram_bot_token && user?.telegram_chat_id) {
      const token = decrypt(user.telegram_bot_token)
      await sendMessageWithBot(token, user.telegram_chat_id, message, user.telegram_topic_id ?? undefined)
    }
  } catch (err) {
    console.error(`[Telegram] Personal bot failed for user ${userId}:`, err)
  }
}
