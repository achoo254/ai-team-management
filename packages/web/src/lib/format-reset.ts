// VN-localized quota reset time formatter. Pure function, testable via `now` param.

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const

export interface ResetFormat {
  label: string
  isOverdue: boolean
  isImminent: boolean
}

/** "HH:MM" 24h padded */
export function formatClockTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** "T5 07/04" (weekday + DD/MM) */
export function formatDateLabel(d: Date): string {
  const wd = WEEKDAYS[d.getDay()]
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${wd} ${dd}/${mm}`
}

/** diffMs → "Xmin" | "Xh" | "Xh YYmin" (relative tail, not including "Còn" prefix) */
export function formatRelative(diffMs: number): string {
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const rem = mins % 60
  return rem === 0 ? `${h}h` : `${h}h${String(rem).padStart(2, '0')}min`
}

/**
 * Format quota reset ISO string into VN-localized label.
 *
 * Bands:
 * - null → "—"
 * - past (diff≤0) → "Đang chờ cập nhật" (isOverdue)
 * - <5min → "Sắp reset (HH:MM)" (isImminent)
 * - same calendar day → "Còn {rel} (HH:MM)"
 * - next calendar day (<24h) → "Còn {rel} (HH:MM mai)"
 * - else → "T{D} DD/MM ~HH:MM (còn X ngày)"
 *
 * @example formatResetTime("2026-04-06T09:00:00Z") // { label: "Còn 18h (16:00 mai)", ... }
 */
export function formatResetTime(iso: string | null, now: Date = new Date()): ResetFormat {
  if (iso == null) return { label: '—', isOverdue: false, isImminent: false }
  const target = new Date(iso)
  const diffMs = target.getTime() - now.getTime()

  if (diffMs <= 0) return { label: 'Đang chờ cập nhật', isOverdue: true, isImminent: false }

  const clock = formatClockTime(target)

  if (diffMs < 5 * 60_000) {
    return { label: `Sắp reset (${clock})`, isOverdue: false, isImminent: true }
  }

  const sameDay =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()

  const nextDay = (() => {
    const n = new Date(now)
    n.setDate(n.getDate() + 1)
    return (
      target.getFullYear() === n.getFullYear() &&
      target.getMonth() === n.getMonth() &&
      target.getDate() === n.getDate()
    )
  })()

  if (sameDay) {
    return { label: `Còn ${formatRelative(diffMs)} (${clock})`, isOverdue: false, isImminent: false }
  }
  if (nextDay) {
    // For next-day, drop minute portion if > 1h to keep label short
    const mins = Math.floor(diffMs / 60_000)
    const h = Math.floor(mins / 60)
    const rel = `${h}h`
    return { label: `Còn ${rel} (${clock} mai)`, isOverdue: false, isImminent: false }
  }

  const days = Math.floor(diffMs / (24 * 3600_000))
  return {
    label: `${formatDateLabel(target)} ~${clock} (còn ${days} ngày)`,
    isOverdue: false,
    isImminent: false,
  }
}
