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
): string {
  if (current === null || yesterdayPct === null) return ''
  const cycleReset = currentResetsAt && yesterdayResetsAt
    && Math.abs(currentResetsAt.getTime() - yesterdayResetsAt.getTime()) > 60_000
  const resetTag = cycleReset ? ', ↻ đã reset' : ''
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
