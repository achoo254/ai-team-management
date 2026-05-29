import { describe, it, expect } from 'vitest'
import { isEmptyUsageResponse } from '../../packages/api/src/services/usage-collector-service.js'

describe('isEmptyUsageResponse (transient empty-response guard)', () => {
  it('returns true when both 5h and 7d have null resets_at (incident response)', () => {
    expect(isEmptyUsageResponse({ resetsAt: null }, { resetsAt: null })).toBe(true)
  })

  it('returns false when 7d window is live (idle but weekly counter persists)', () => {
    // Morning-idle case: 5h closed (null) but 7d still carries a resets_at.
    expect(
      isEmptyUsageResponse({ resetsAt: null }, { resetsAt: new Date('2026-06-03T00:00:00Z') }),
    ).toBe(false)
  })

  it('returns false when 5h window is live', () => {
    expect(
      isEmptyUsageResponse({ resetsAt: new Date('2026-05-29T05:00:00Z') }, { resetsAt: null }),
    ).toBe(false)
  })

  it('returns false when both windows are live (normal active state)', () => {
    expect(
      isEmptyUsageResponse(
        { resetsAt: new Date('2026-05-29T05:00:00Z') },
        { resetsAt: new Date('2026-06-03T00:00:00Z') },
      ),
    ).toBe(false)
  })
})
