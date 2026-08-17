import type { AlertType } from '@repo/shared/types'

/** Escape HTML special chars for Telegram */
export function esc(str: string | number): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Render one alert as a Telegram HTML message body. */
export function buildAlertMessage(
  type: AlertType,
  seatLabel: string,
  metadata: Record<string, unknown>,
): string {
  switch (type) {
    case 'rate_limit': {
      const win = String(metadata.window ?? metadata.session ?? '')
      const pct = metadata.max_pct ?? metadata.pct
      const threshold = metadata.threshold
      const resetsAt = metadata.resets_at ? new Date(metadata.resets_at as string).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ''
      return `🔴 <b>Rate Limit Warning</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Window: ${esc(win)} | Usage: <b>${esc(String(pct ?? ''))}%</b>`
        + (threshold != null ? ` (ngưỡng ${esc(String(threshold))}%)` : '')
        + (resetsAt ? `\nReset: ${esc(resetsAt)}` : '')
    }
    case 'token_failure': {
      // hard_fail = the refresh token itself was rejected, so the credential is
      // unrecoverable without a fresh login. Anything else is a transient fetch
      // error the next cron tick retries on its own — telling the user to
      // re-import there sends them to redo a credential that still works.
      const hardFail = metadata.hard_fail === true
      return (hardFail ? `⚠️ <b>Token Failure</b>\n` : `⚠️ <b>Token Fetch Error</b>\n`)
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Error: <code>${esc(String(metadata.error ?? 'unknown'))}</code>\n`
        + (hardFail
          ? `→ Cần re-import credential`
          : `→ Lỗi tạm thời, hệ thống sẽ tự thử lại`)
    }
    case 'usage_exceeded':
      if (metadata.next_user) {
        return `📢 <b>Sắp đến lượt bạn</b>\n`
          + `Seat: <b>${esc(seatLabel)}</b>\n`
          + `User trước đã vượt budget — seat sắp sẵn sàng cho bạn`
      }
      return `🚫 <b>Usage Budget Exceeded</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `User: ${esc(String(metadata.user_name ?? ''))}\n`
        + `Usage: ${esc(String(metadata.delta ?? ''))}% / Budget: ${esc(String(metadata.budget ?? ''))}%\n`
        + `Session: ${esc(String(metadata.session ?? ''))}\n`
        + `→ Vui lòng dừng sử dụng ngay`
    case 'session_waste':
      return `⚠️ <b>Session lãng phí</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `User: ${esc(String(metadata.user_name ?? ''))}\n`
        + `Thời gian: ${esc(String(metadata.duration ?? ''))}h nhưng chỉ dùng ${esc(String(metadata.delta ?? ''))}%\n`
        + `→ Cân nhắc rút ngắn session hoặc nhường seat`
    case '7d_risk':
      return `🔴 <b>7d Usage Risk</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Hiện tại: ${esc(String(metadata.current_7d ?? ''))}%\n`
        + `Dự kiến: ${esc(String(metadata.projected ?? ''))}% (còn ${esc(String(metadata.remaining_sessions ?? ''))} sessions)\n`
        + `→ Cần giảm tải hoặc chuyển sang seat khác`
    case 'quota_forecast': {
      const daysFmt = metadata.hours_to_full ? (Number(metadata.hours_to_full) / 24).toFixed(1) : '?'
      const slope = metadata.slope_per_hour ? Number(metadata.slope_per_hour).toFixed(1) : '?'
      const resetsIn = metadata.resets_at
        ? ((new Date(metadata.resets_at as string).getTime() - Date.now()) / 3600_000 / 24).toFixed(1)
        : null
      return `📈 <b>Quota Forecast Warning</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Hiện: ${esc(String(metadata.pct ?? ''))}% | Tăng: ${esc(slope)}%/h\n`
        + `Dự kiến chạm 100% trong ~${esc(daysFmt)} ngày`
        + (resetsIn ? `\nReset sau ${esc(resetsIn)} ngày` : '')
    }
    case 'fast_burn': {
      const rate = metadata.burn_rate_per_hour ?? metadata.velocity ?? metadata.pct
      const mins = metadata.minutes_to_full ?? (metadata.eta_hours != null ? Math.round(Number(metadata.eta_hours) * 60) : null)
      return `⚡ <b>Fast Burn Alert</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Tiêu hao: ${esc(String(rate ?? ''))}%/h\n`
        + `Hiện: ${esc(String(metadata.pct ?? ''))}%`
        + (mins != null ? ` | Còn ~${esc(String(mins))} phút` : '')
    }
    case 'unexpected_activity':
      return `🟡 <b>Hoạt động ngoài dự kiến</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Seat đang hoạt động ngoài giờ dự kiến`
    case 'unexpected_idle':
      return `🟡 <b>Rảnh ngoài dự kiến</b>\n`
        + `Seat: <b>${esc(seatLabel)}</b>\n`
        + `Seat không hoạt động trong giờ dự kiến`
    default:
      return `ℹ️ <b>${esc(type)}</b>\nSeat: <b>${esc(seatLabel)}</b>`
  }
}
