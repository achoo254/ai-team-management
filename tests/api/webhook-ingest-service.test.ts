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
    device_id: 'uuid-device',
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

function makeProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: 'p',
    email: 'profile@example.com',
    subscription_type: 'max_20x',
    rate_limit_tier: 'tier_20x',
    is_active: true,
    is_expired: false,
    usage: {
      five_hour: { utilization: 42 },
      seven_day: { utilization: 17 },
      seven_day_sonnet: { utilization: 9 },
    },
    ...overrides,
  }
}

function makePayload(overrides: Partial<Record<string, unknown>> = {}) {
  const base = {
    event: 'usage_report',
    app_version: '1.2.3',
    member_email: 'user@example.com',
    device_info: { device_id: 'uuid-device', device_name: 'laptop', hostname: 'host-1' },
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
      profiles: [makeProfile()],
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

function mockSeatByEmail(map: Record<string, mongoose.Types.ObjectId>) {
  seatFindOneMock.mockImplementation((filter: { email: string }) => ({
    select: () => ({
      lean: () => Promise.resolve(map[filter.email] ? { _id: map[filter.email] } : null),
    }),
  }))
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ingestUsageReport', () => {
  beforeEach(() => {
    upsertCalls.length = 0
    seatFindOneMock.mockReset()
    mockSeatByEmail({})
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

  // Scenario A: new session with profile A active → attribution locked to A
  it('[A] attributes new session to active profile + matched seat via $setOnInsert', async () => {
    const seatAId = new mongoose.Types.ObjectId()
    mockSeatByEmail({ 'profile@example.com': seatAId })

    const device = makeDevice()
    const result = await ingestUsageReport(
      device as never,
      new mongoose.Types.ObjectId(),
      makePayload(),
    )

    expect(result.accepted_sessions).toBe(1)
    const update = upsertCalls[0].update as {
      $setOnInsert: Record<string, unknown>
      $set: Record<string, unknown>
    }
    expect(update.$setOnInsert.seat_id).toBe(seatAId)
    expect(update.$setOnInsert.profile_email).toBe('profile@example.com')
    // usage fields remain in $set (always updatable)
    expect(update.$set.usage_five_hour_pct).toBe(42)
    expect(update.$set.total_input_tokens).toBe(100)
    // attribution is NOT in $set (frozen)
    expect(update.$set.seat_id).toBeUndefined()
    expect(update.$set.profile_email).toBeUndefined()
  })

  // Scenario B: re-ingest same session with profile B active → attribution stays A
  it('[B] re-ingest with different active profile keeps original attribution ($setOnInsert)', async () => {
    const seatAId = new mongoose.Types.ObjectId()
    const seatBId = new mongoose.Types.ObjectId()
    mockSeatByEmail({ 'a@x.com': seatAId, 'b@x.com': seatBId })

    const device = makeDevice()
    const payloadA = makePayload({
      data: { profiles: [makeProfile({ email: 'a@x.com', is_active: true })] },
    })
    const payloadB = makePayload({
      data: { profiles: [makeProfile({ email: 'b@x.com', is_active: true })] },
    })
    payloadB.session_usage.sessions[0].totalInputTokens = 999

    await ingestUsageReport(device as never, new mongoose.Types.ObjectId(), payloadA)
    await ingestUsageReport(device as never, new mongoose.Types.ObjectId(), payloadB)

    expect(upsertCalls).toHaveLength(2)
    // Mongo $setOnInsert is a no-op on existing docs; we assert the service still
    // emits the *current active* profile in $setOnInsert — correctness comes from Mongo.
    const secondUpdate = upsertCalls[1].update as {
      $setOnInsert: Record<string, unknown>
      $set: Record<string, unknown>
    }
    expect(secondUpdate.$setOnInsert.profile_email).toBe('b@x.com')
    expect(secondUpdate.$setOnInsert.seat_id).toBe(seatBId)
    // Tokens still updated via $set
    expect(secondUpdate.$set.total_input_tokens).toBe(999)
    // Critical: attribution NEVER in $set — prevents accidental overwrite
    expect(secondUpdate.$set.profile_email).toBeUndefined()
    expect(secondUpdate.$set.seat_id).toBeUndefined()
  })

  // Scenario C: profiles[] empty → early exit
  it('[C] empty profiles → 0 sessions, no upsert, device still saved', async () => {
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

  // Scenario D: no profile has is_active=true → fallback to profiles[0]
  it('[D] no active profile → fallback to profiles[0]', async () => {
    const device = makeDevice()
    const payload = makePayload({
      data: {
        profiles: [
          makeProfile({ email: 'first@x.com', is_active: false }),
          makeProfile({ email: 'second@x.com', is_active: false }),
        ],
      },
    })
    await ingestUsageReport(device as never, new mongoose.Types.ObjectId(), payload)
    const update = upsertCalls[0].update as { $setOnInsert: Record<string, unknown> }
    expect(update.$setOnInsert.profile_email).toBe('first@x.com')
  })

  // Scenario E: email doesn't match any seat → seat_id=null, profile_email set
  it('[E] unknown profile email → seat_id=null but profile_email preserved', async () => {
    const device = makeDevice()
    await ingestUsageReport(
      device as never,
      new mongoose.Types.ObjectId(),
      makePayload(),
    )
    const update = upsertCalls[0].update as { $setOnInsert: Record<string, unknown> }
    expect(update.$setOnInsert.seat_id).toBeNull()
    expect(update.$setOnInsert.profile_email).toBe('profile@example.com')
  })

  it('picks correct active profile when multiple profiles present', async () => {
    const seatActiveId = new mongoose.Types.ObjectId()
    mockSeatByEmail({ 'active@x.com': seatActiveId })

    const device = makeDevice()
    const payload = makePayload({
      data: {
        profiles: [
          makeProfile({ email: 'inactive@x.com', is_active: false }),
          makeProfile({ email: 'active@x.com', is_active: true }),
        ],
      },
    })
    await ingestUsageReport(device as never, new mongoose.Types.ObjectId(), payload)
    const update = upsertCalls[0].update as { $setOnInsert: Record<string, unknown> }
    expect(update.$setOnInsert.profile_email).toBe('active@x.com')
    expect(update.$setOnInsert.seat_id).toBe(seatActiveId)
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

  it('copies utilization numbers into session record ($set)', async () => {
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
