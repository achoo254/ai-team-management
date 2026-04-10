import { beforeEach, describe, expect, it, vi } from 'vitest'
import mongoose from 'mongoose'

// ── Mocks ────────────────────────────────────────────────────────────────────
// Stub ClaudeSession.findOneAndUpdate to capture upsert calls
const upsertCalls: Array<{ filter: unknown; update: unknown }> = []
vi.mock('../../packages/api/src/models/claude-session.js', () => ({
  ClaudeSession: {
    findOneAndUpdate: vi.fn(async (filter: unknown, update: unknown) => {
      upsertCalls.push({ filter, update })
      return { _id: 'fake-session' }
    }),
  },
}))

// Stub Seat.findOne — default: no match; tests override per case
const seatFindOneMock = vi.fn()
vi.mock('../../packages/api/src/models/seat.js', () => ({
  Seat: {
    findOne: (...args: unknown[]) => seatFindOneMock(...args),
  },
}))

import { ingestUsageReport } from '../../packages/api/src/services/webhook-ingest-service.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDevice() {
  return {
    _id: new mongoose.Types.ObjectId(),
    device_name: 'old-name',
    hostname: 'old-host',
    system_info: {},
    app_version: '0.0.0',
    last_ram_used_mb: 0,
    last_seen_at: new Date(0),
    user_id: new mongoose.Types.ObjectId(),
    save: vi.fn(async function (this: Record<string, unknown>) {
      return this
    }),
  }
}

function makePayload(overrides: Partial<Record<string, unknown>> = {}) {
  const base = {
    event: 'usage_report',
    app_version: '1.2.3',
    member_email: 'user@example.com',
    device_info: { device_name: 'laptop', hostname: 'host-1' },
    system_info: {
      os_name: 'Windows',
      os_version: '11',
      cpu_name: 'i7',
      cpu_cores: 8,
      ram_total_mb: 16000,
      ram_used_mb: 8000,
      arch: 'x64',
    },
    data: {
      profiles: [
        {
          email: 'profile@example.com',
          subscription_type: 'max_20x',
          rate_limit_tier: 'tier_20x',
          usage: {
            five_hour: { utilization: 42 },
            seven_day: { utilization: 17 },
            seven_day_sonnet: { utilization: 9 },
          },
        },
      ],
    },
    session_usage: {
      sessions: [
        {
          sessionId: 'sess-1',
          model: 'claude-opus-4-6',
          startedAt: '2026-04-10T00:00:00.000Z',
          endedAt: '2026-04-10T01:00:00.000Z',
          totalInputTokens: 100,
          totalOutputTokens: 200,
          totalCacheRead: 10,
          totalCacheWrite: 20,
          messageCount: 5,
        },
      ],
    },
    ...overrides,
  }
  return base as Parameters<typeof ingestUsageReport>[2]
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ingestUsageReport', () => {
  beforeEach(() => {
    upsertCalls.length = 0
    seatFindOneMock.mockReset()
    seatFindOneMock.mockReturnValue({ select: () => Promise.resolve(null) })
  })

  it('updates device snapshot from payload', async () => {
    const device = makeDevice()
    const userId = new mongoose.Types.ObjectId()
    await ingestUsageReport(device as never, userId, makePayload())

    expect(device.device_name).toBe('laptop')
    expect(device.hostname).toBe('host-1')
    expect(device.app_version).toBe('1.2.3')
    expect(device.last_ram_used_mb).toBe(8000)
    expect(device.system_info).toMatchObject({ os_name: 'Windows', cpu_cores: 8 })
    expect(device.save).toHaveBeenCalledOnce()
  })

  it('maps profile email → seat_id when seat exists', async () => {
    const seatId = new mongoose.Types.ObjectId()
    seatFindOneMock.mockReturnValue({
      select: () => Promise.resolve({ _id: seatId }),
    })

    const device = makeDevice()
    const result = await ingestUsageReport(
      device as never,
      new mongoose.Types.ObjectId(),
      makePayload(),
    )

    expect(result.accepted_sessions).toBe(1)
    expect(upsertCalls).toHaveLength(1)
    const update = upsertCalls[0].update as { $set: Record<string, unknown> }
    expect(update.$set.seat_id).toBe(seatId)
    expect(update.$set.profile_email).toBe('profile@example.com')
  })

  it('sets seat_id=null when no seat matches profile email', async () => {
    const device = makeDevice()
    await ingestUsageReport(
      device as never,
      new mongoose.Types.ObjectId(),
      makePayload(),
    )
    const update = upsertCalls[0].update as { $set: Record<string, unknown> }
    expect(update.$set.seat_id).toBeNull()
    expect(update.$set.profile_email).toBe('profile@example.com')
  })

  it('creates N upserts for N sessions', async () => {
    const device = makeDevice()
    const payload = makePayload()
    payload.session_usage.sessions = [
      { ...payload.session_usage.sessions[0], sessionId: 'a' },
      { ...payload.session_usage.sessions[0], sessionId: 'b' },
      { ...payload.session_usage.sessions[0], sessionId: 'c' },
    ]
    const result = await ingestUsageReport(
      device as never,
      new mongoose.Types.ObjectId(),
      payload,
    )
    expect(result.accepted_sessions).toBe(3)
    expect(upsertCalls).toHaveLength(3)
    expect(upsertCalls.map((c) => (c.filter as { session_id: string }).session_id)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('uses upsert:true for idempotency (same sessionId → one record)', async () => {
    const device = makeDevice()
    const payload = makePayload()
    await ingestUsageReport(device as never, new mongoose.Types.ObjectId(), payload)
    await ingestUsageReport(device as never, new mongoose.Types.ObjectId(), payload)
    // Both calls delegate to findOneAndUpdate with upsert:true — DB enforces single row
    expect(upsertCalls).toHaveLength(2)
    for (const call of upsertCalls) {
      expect((call.filter as { session_id: string }).session_id).toBe('sess-1')
    }
  })

  it('early-exits with 0 sessions when profiles is empty; still saves device', async () => {
    const device = makeDevice()
    const payload = makePayload()
    payload.data.profiles = []
    const result = await ingestUsageReport(
      device as never,
      new mongoose.Types.ObjectId(),
      payload,
    )
    expect(result.accepted_sessions).toBe(0)
    expect(device.save).toHaveBeenCalledOnce()
    expect(upsertCalls).toHaveLength(0)
  })

  it('copies utilization numbers into session record', async () => {
    const device = makeDevice()
    await ingestUsageReport(
      device as never,
      new mongoose.Types.ObjectId(),
      makePayload(),
    )
    const update = upsertCalls[0].update as { $set: Record<string, unknown> }
    expect(update.$set.usage_five_hour_pct).toBe(42)
    expect(update.$set.usage_seven_day_pct).toBe(17)
    expect(update.$set.usage_seven_day_sonnet_pct).toBe(9)
  })
})
