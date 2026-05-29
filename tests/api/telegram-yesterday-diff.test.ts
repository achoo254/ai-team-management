import { describe, it, expect } from 'vitest'

/**
 * Mirror of buildDiffSuffix from packages/api/src/services/telegram-service.ts.
 * The helper is private; we replicate it here so we can unit-test the
 * "yesterday peak vs current cycle" logic in isolation.
 *
 * Source of truth: telegram-service.ts → buildDiffSuffix(...)
 * If the source signature/behavior changes, update this mirror.
 */
function buildDiffSuffix(
  current: number | null,
  currentResetsAt: Date | null,
  yesterdayPct: number | null,
  yesterdayResetsAt: Date | null,
  isSevenDay = false,
): string {
  if (current === null || yesterdayPct === null) return ''
  const cycleReset = currentResetsAt && yesterdayResetsAt
    && Math.abs(currentResetsAt.getTime() - yesterdayResetsAt.getTime()) > 60_000
  let resetTag = ''
  if (cycleReset) {
    resetTag = ', ↻ đã reset'
  } else if (
    isSevenDay && currentResetsAt !== null && yesterdayResetsAt !== null
    && current < yesterdayPct
  ) {
    resetTag = ', ↻ đã đặt lại'
  }
  return ` <i>(hôm qua cao nhất ${yesterdayPct}%${resetTag})</i>`
}

describe('buildDiffSuffix (yesterday peak vs current cycle)', () => {
  it('returns empty string when current is null', () => {
    expect(buildDiffSuffix(null, null, 30, null)).toBe('')
  })

  it('returns empty string when yesterday peak is null (no snapshot in window)', () => {
    expect(buildDiffSuffix(50, null, null, null)).toBe('')
  })

  it('shows yesterday peak with no reset flag when same cycle', () => {
    const reset = new Date('2026-05-14T02:00:00Z')
    const out = buildDiffSuffix(40, reset, 65, reset)
    expect(out).toContain('hôm qua cao nhất 65%')
    expect(out).not.toContain('↻ đã reset')
  })

  it('marks ↻ when cycle reset between yesterday peak and current', () => {
    const out = buildDiffSuffix(
      10, new Date('2026-05-14T02:00:00Z'),
      90, new Date('2026-05-07T02:00:00Z'),
    )
    expect(out).toContain('hôm qua cao nhất 90%')
    expect(out).toContain('↻ đã reset')
  })

  it('does NOT flag reset when peak exceeds current within same cycle', () => {
    // Peak (65%) was earlier today within the same 5h cycle — still no reset
    const reset = new Date('2026-05-10T07:00:00Z')
    const out = buildDiffSuffix(15, reset, 65, reset)
    expect(out).toContain('hôm qua cao nhất 65%')
    expect(out).not.toContain('↻ đã reset')
  })

  it('tolerates sub-60s ms drift in resets_at (Anthropic API jitter)', () => {
    // Same cycle, but API returned ms-level drift → must not flag reset
    const out = buildDiffSuffix(
      76, new Date('2026-05-13T00:00:00.430Z'),
      74, new Date('2026-05-13T00:00:00.378Z'),
    )
    expect(out).toContain('hôm qua cao nhất 74%')
    expect(out).not.toContain('↻ đã reset')
  })

  it('shows yesterday peak when both pcts equal, same cycle', () => {
    const reset = new Date('2026-05-14T02:00:00Z')
    const out = buildDiffSuffix(50, reset, 50, reset)
    expect(out).toContain('hôm qua cao nhất 50%')
    expect(out).not.toContain('↻ đã reset')
  })

  it('handles null resets_at on both sides without flagging reset', () => {
    // Cannot determine cycle change without resets_at → no flag
    const out = buildDiffSuffix(15, null, 80, null)
    expect(out).toContain('hôm qua cao nhất 80%')
    expect(out).not.toContain('↻ đã reset')
  })
})

describe('buildDiffSuffix — 7d silent-reset detection (isSevenDay)', () => {
  it('flags "đã đặt lại" when 7d current < yesterday peak within same cycle', () => {
    // 7d is monotonic within a weekly cycle; current below peak with unchanged
    // reset boundary = counter cleared mid-cycle (upstream incident).
    const reset = new Date('2026-06-03T00:00:00Z')
    const out = buildDiffSuffix(10, reset, 37, reset, true)
    expect(out).toContain('hôm qua cao nhất 37%')
    expect(out).toContain('↻ đã đặt lại')
    expect(out).not.toContain('↻ đã reset')
  })

  it('does NOT flag "đã đặt lại" when 7d current >= yesterday peak (healthy growth)', () => {
    const reset = new Date('2026-06-03T00:00:00Z')
    const out = buildDiffSuffix(40, reset, 37, reset, true)
    expect(out).toContain('hôm qua cao nhất 37%')
    expect(out).not.toContain('↻ đã đặt lại')
    expect(out).not.toContain('↻ đã reset')
  })

  it('uses "đã reset" (not "đã đặt lại") when 7d cycle actually reset', () => {
    // Different reset boundary → genuine weekly reset takes precedence.
    const out = buildDiffSuffix(
      20, new Date('2026-06-04T00:00:00Z'),
      69, new Date('2026-05-28T00:00:00Z'),
      true,
    )
    expect(out).toContain('hôm qua cao nhất 69%')
    expect(out).toContain('↻ đã reset')
    expect(out).not.toContain('↻ đã đặt lại')
  })

  it('tolerates sub-60s 7d resets_at drift without flagging "đã đặt lại" falsely', () => {
    // Same cycle (ms drift) AND current >= peak → no flag at all.
    const out = buildDiffSuffix(
      38, new Date('2026-06-03T00:00:00.430Z'),
      37, new Date('2026-06-03T00:00:00.180Z'),
      true,
    )
    expect(out).toContain('hôm qua cao nhất 37%')
    expect(out).not.toContain('↻ đã')
  })

  it('5h window (isSevenDay=false) never flags "đã đặt lại" even if current < peak', () => {
    // A VN day spans several 5h cycles, so peak > current is normal for 5h.
    const reset = new Date('2026-05-29T00:00:00Z')
    const out = buildDiffSuffix(15, reset, 84, reset, false)
    expect(out).toContain('hôm qua cao nhất 84%')
    expect(out).not.toContain('↻ đã đặt lại')
    expect(out).not.toContain('↻ đã reset')
  })

  it('does NOT flag "đã đặt lại" when both resets_at null (cycle indeterminate)', () => {
    // Degraded state: cannot prove same cycle without boundaries → no false flag.
    const out = buildDiffSuffix(10, null, 37, null, true)
    expect(out).toContain('hôm qua cao nhất 37%')
    expect(out).not.toContain('↻ đã đặt lại')
    expect(out).not.toContain('↻ đã reset')
  })
})
