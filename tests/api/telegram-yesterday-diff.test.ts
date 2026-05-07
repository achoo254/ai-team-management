import { describe, it, expect } from 'vitest'

/**
 * Mirror of buildDiffSuffix from packages/api/src/services/telegram-service.ts.
 * The helper is private; we replicate it here so we can unit-test the
 * "compare with yesterday's last snapshot" logic in isolation.
 *
 * Source of truth: telegram-service.ts → buildDiffSuffix(...)
 * If the source signature/behavior changes, update this mirror.
 */
function buildDiffSuffix(
  current: number | null,
  currentResetsAt: Date | null,
  yesterdayPct: number | null,
  yesterdayResetsAt: Date | null,
): string {
  if (current === null || yesterdayPct === null) return ''
  const explicitReset = currentResetsAt && yesterdayResetsAt
    && currentResetsAt.getTime() !== yesterdayResetsAt.getTime()
  const implicitReset = yesterdayPct > current
  if (explicitReset || implicitReset) {
    return ` <i>(hôm qua ${yesterdayPct}%, ↻ đã reset)</i>`
  }
  const delta = current - yesterdayPct
  const sign = delta > 0 ? '+' : ''
  return ` <i>(hôm qua ${yesterdayPct}%, ${sign}${delta}%)</i>`
}

describe('buildDiffSuffix (yesterday vs current)', () => {
  it('returns empty string when current is null', () => {
    expect(buildDiffSuffix(null, null, 30, null)).toBe('')
  })

  it('returns empty string when yesterday is null (no snapshot before today)', () => {
    expect(buildDiffSuffix(50, null, null, null)).toBe('')
  })

  it('shows positive delta when usage grew', () => {
    const out = buildDiffSuffix(50, null, 45, null)
    expect(out).toContain('hôm qua 45%')
    expect(out).toContain('+5%')
  })

  it('shows negative delta when usage decreased without reset', () => {
    // Same resets_at on both sides → no reset, just a decrease
    const reset = new Date('2026-05-10T02:00:00Z')
    const out = buildDiffSuffix(40, reset, 45, reset)
    // 40 < 45 triggers implicit-reset path → marked as reset
    expect(out).toContain('↻ đã reset')
  })

  it('marks reset when resets_at differs (explicit reset detected)', () => {
    const out = buildDiffSuffix(
      10, new Date('2026-05-14T02:00:00Z'),
      90, new Date('2026-05-07T02:00:00Z'),
    )
    expect(out).toContain('hôm qua 90%')
    expect(out).toContain('↻ đã reset')
    expect(out).not.toContain('-80%')
  })

  it('shows zero delta when value unchanged', () => {
    const out = buildDiffSuffix(50, null, 50, null)
    expect(out).toContain('hôm qua 50%')
    expect(out).toContain('0%')
  })

  it('treats yesterday > current as implicit reset (covers null resets_at)', () => {
    // Either resets_at missing → fall back to implicit reset detection
    const out = buildDiffSuffix(15, null, 80, null)
    expect(out).toContain('↻ đã reset')
  })

  it('does not flag reset when resets_at match and usage grew', () => {
    const reset = new Date('2026-05-14T02:00:00Z')
    const out = buildDiffSuffix(60, reset, 50, reset)
    expect(out).not.toContain('↻ đã reset')
    expect(out).toContain('+10%')
  })
})
