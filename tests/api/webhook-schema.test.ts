import { describe, expect, it } from 'vitest'
import { usageReportSchema } from '../../packages/shared/webhook-schema.js'

function validPayload() {
  return {
    event: 'usage_report' as const,
    timestamp: '2026-04-10T01:00:00.000Z',
    app_version: '1.0.0',
    member_email: 'user@example.com',
    device_info: {
      device_id: '12345678-1234-4234-8234-123456789012',
      device_name: 'My MacBook',
      hostname: 'macbook.local',
    },
    system_info: {
      os_name: 'macOS',
      os_version: '14.0',
      hostname: 'macbook.local',
      cpu_name: 'Apple M2',
      cpu_cores: 8,
      ram_total_mb: 16384,
      ram_used_mb: 8192,
      arch: 'arm64',
    },
    data: {
      profiles: [
        {
          name: 'Alice',
          email: 'alice@claude.ai',
          subscription_type: 'max',
          rate_limit_tier: 'max_20x',
          is_active: true,
          is_expired: false,
          usage: {
            five_hour: { utilization: 42.5, resets_at: '2026-04-10T06:00:00.000Z' },
            seven_day: { utilization: 12.3, resets_at: '2026-04-17T01:00:00.000Z' },
          },
        },
      ],
    },
    session_usage: {
      period: '7d',
      summary: {
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        totalCacheRead: 300,
        totalCacheWrite: 200,
        sessionCount: 1,
      },
      sessions: [
        {
          sessionId: '87654321-4321-4321-8321-210987654321',
          model: 'claude-sonnet-4-5',
          startedAt: '2026-04-10T00:00:00.000Z',
          endedAt: '2026-04-10T00:30:00.000Z',
          totalInputTokens: 1000,
          totalOutputTokens: 500,
          totalCacheRead: 300,
          totalCacheWrite: 200,
          messageCount: 10,
        },
      ],
    },
  }
}

describe('usageReportSchema', () => {
  it('accepts a valid full payload', () => {
    const res = usageReportSchema.safeParse(validPayload())
    expect(res.success).toBe(true)
  })

  it('rejects payload with wrong event literal', () => {
    const p = validPayload()
    ;(p as { event: string }).event = 'other_event'
    expect(usageReportSchema.safeParse(p).success).toBe(false)
  })

  it('rejects payload missing device_info', () => {
    const p = validPayload() as Record<string, unknown>
    delete p.device_info
    expect(usageReportSchema.safeParse(p).success).toBe(false)
  })

  it('rejects payload with unknown top-level field (strict mode)', () => {
    const p = { ...validPayload(), extra_field: 'nope' }
    expect(usageReportSchema.safeParse(p).success).toBe(false)
  })

  it('rejects non-UUID device_id', () => {
    const p = validPayload()
    p.device_info.device_id = 'not-a-uuid'
    expect(usageReportSchema.safeParse(p).success).toBe(false)
  })

  it('rejects utilization out of 0-100 range', () => {
    const p = validPayload()
    p.data.profiles[0].usage.five_hour = {
      utilization: 150,
      resets_at: '2026-04-10T06:00:00.000Z',
    }
    expect(usageReportSchema.safeParse(p).success).toBe(false)
  })

  it('accepts empty profiles array', () => {
    const p = validPayload()
    p.data.profiles = []
    expect(usageReportSchema.safeParse(p).success).toBe(true)
  })

  it('accepts empty sessions array', () => {
    const p = validPayload()
    p.session_usage.sessions = []
    expect(usageReportSchema.safeParse(p).success).toBe(true)
  })
})
