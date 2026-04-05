import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import {
  detectWindowAction,
  computeImpactRatio,
  computeIsWaste,
  getPeakHourVN,
  clampDelta,
  type DetectorSnapshot,
  type DetectorOpenWindow,
} from '../../packages/api/src/services/usage-window-detector.js'

const seatId = new Types.ObjectId()
const ownerId = new Types.ObjectId()

function snap(overrides: Partial<DetectorSnapshot> = {}): DetectorSnapshot {
  return {
    _id: new Types.ObjectId(),
    fetched_at: new Date('2026-04-05T08:00:00Z'),
    five_hour_pct: 10,
    five_hour_resets_at: new Date('2026-04-05T12:00:00Z'),
    seven_day_pct: 20,
    seven_day_sonnet_pct: 15,
    seven_day_opus_pct: 5,
    ...overrides,
  }
}

function openW(overrides: Partial<DetectorOpenWindow> = {}): DetectorOpenWindow {
  return {
    _id: new Types.ObjectId(),
    seat_id: seatId,
    owner_id: ownerId,
    window_start: new Date('2026-04-05T07:00:00Z'),
    window_end: new Date('2026-04-05T12:00:00Z'),
    utilization_pct: 10,
    delta_7d_pct: 0,
    delta_7d_sonnet_pct: 0,
    delta_7d_opus_pct: 0,
    peak_hour_of_day: null,
    snapshot_start_id: null,
    ...overrides,
  }
}

describe('usage-window-detector helpers', () => {
  it('clampDelta uses curr when negative (7d reset mid-window)', () => {
    expect(clampDelta(5, 10)).toBe(5) // diff=-5 → 7d reset → use curr as post-reset contribution
    expect(clampDelta(15, 10)).toBe(5) // normal positive delta
    expect(clampDelta(null, 5)).toBe(0)
    expect(clampDelta(5, null)).toBe(0)
    expect(clampDelta(2, 44)).toBe(2) // 7d reset: was 44%, now 2% → 2% accumulated since reset
  })

  it('computeImpactRatio returns null when util < 1', () => {
    expect(computeImpactRatio(2, 0.5)).toBeNull()
    expect(computeImpactRatio(2, 10)).toBe(0.2)
  })

  it('computeIsWaste: duration>=2 AND util<5', () => {
    expect(computeIsWaste(3, 2)).toBe(true)
    expect(computeIsWaste(3, 10)).toBe(false)
    expect(computeIsWaste(1, 2)).toBe(false)
  })

  it('getPeakHourVN converts UTC to Asia/Ho_Chi_Minh hour', () => {
    // 2026-04-05T08:00:00Z = 15:00 VN
    expect(getPeakHourVN(new Date('2026-04-05T08:00:00Z'))).toBe(15)
    // 2026-04-05T18:00:00Z = 01:00 VN (next day)
    expect(getPeakHourVN(new Date('2026-04-05T18:00:00Z'))).toBe(1)
  })
})

describe('detectWindowAction', () => {
  it('noop when five_hour_resets_at is null', () => {
    const action = detectWindowAction({
      seat_id: seatId,
      owner_id: ownerId,
      snapshotNow: snap({ five_hour_resets_at: null }),
      snapshotPrev: null,
      snapshotStart: null,
      openWindow: null,
    })
    expect(action.kind).toBe('noop')
  })

  it('create_partial on first-ever snapshot (no prev, no openWindow)', () => {
    const action = detectWindowAction({
      seat_id: seatId,
      owner_id: ownerId,
      snapshotNow: snap(),
      snapshotPrev: null,
      snapshotStart: null,
      openWindow: null,
    })
    expect(action.kind).toBe('create_partial')
    if (action.kind !== 'create_partial') return
    expect(action.payload.is_partial).toBe(true)
    expect(action.payload.is_closed).toBe(false)
    expect(action.payload.utilization_pct).toBe(10)
    expect(action.payload.delta_7d_pct).toBe(0)
  })

  it('create_partial from prev anchor (backfill mid-stream)', () => {
    const prev = snap({
      fetched_at: new Date('2026-04-05T07:00:00Z'),
      seven_day_pct: 10,
      seven_day_sonnet_pct: 8,
      seven_day_opus_pct: 2,
      five_hour_pct: 5,
    })
    const now = snap({ seven_day_pct: 25, seven_day_sonnet_pct: 18, seven_day_opus_pct: 7 })
    const action = detectWindowAction({
      seat_id: seatId,
      owner_id: ownerId,
      snapshotNow: now,
      snapshotPrev: prev,
      snapshotStart: null,
      openWindow: null,
    })
    expect(action.kind).toBe('create_partial')
    if (action.kind !== 'create_partial') return
    expect(action.payload.delta_7d_pct).toBe(15)
    expect(action.payload.delta_7d_sonnet_pct).toBe(10)
    expect(action.payload.delta_7d_opus_pct).toBe(5)
    expect(action.payload.utilization_pct).toBe(10)
    expect(action.payload.snapshot_start_id).toEqual(prev._id)
  })

  it('update_open when same reset cycle', () => {
    const reset = new Date('2026-04-05T12:00:00Z')
    const start = snap({
      fetched_at: new Date('2026-04-05T07:30:00Z'),
      five_hour_resets_at: reset,
      seven_day_pct: 10,
      five_hour_pct: 5,
    })
    const prev = snap({
      fetched_at: new Date('2026-04-05T07:35:00Z'),
      five_hour_resets_at: reset,
      seven_day_pct: 12,
      five_hour_pct: 7,
    })
    const now = snap({
      fetched_at: new Date('2026-04-05T08:00:00Z'),
      five_hour_resets_at: reset,
      seven_day_pct: 20,
      five_hour_pct: 15,
    })
    const open = openW({
      window_end: reset,
      utilization_pct: 7,
      delta_7d_pct: 2,
      snapshot_start_id: start._id,
    })
    const action = detectWindowAction({
      seat_id: seatId,
      owner_id: ownerId,
      snapshotNow: now,
      snapshotPrev: prev,
      snapshotStart: start,
      openWindow: open,
    })
    expect(action.kind).toBe('update_open')
    if (action.kind !== 'update_open') return
    expect(action.patch.utilization_pct).toBe(15)
    expect(action.patch.delta_7d_pct).toBe(10) // 20 - 10
    expect(action.patch.snapshot_end_id).toEqual(now._id)
  })

  it('open_new when reset_at differs (cycle transition)', () => {
    const oldReset = new Date('2026-04-05T12:00:00Z')
    const newReset = new Date('2026-04-05T17:00:00Z')
    const prev = snap({
      fetched_at: new Date('2026-04-05T11:55:00Z'),
      five_hour_resets_at: oldReset,
      seven_day_pct: 30,
      five_hour_pct: 50,
    })
    const now = snap({
      fetched_at: new Date('2026-04-05T12:05:00Z'),
      five_hour_resets_at: newReset,
      seven_day_pct: 30,
      five_hour_pct: 2,
    })
    const open = openW({
      window_start: new Date('2026-04-05T07:00:00Z'),
      window_end: oldReset,
      utilization_pct: 50,
    })
    const action = detectWindowAction({
      seat_id: seatId,
      owner_id: ownerId,
      snapshotNow: now,
      snapshotPrev: prev,
      snapshotStart: null,
      openWindow: open,
    })
    expect(action.kind).toBe('open_new')
    if (action.kind !== 'open_new') return
    expect(action.closePrev.is_closed).toBe(true)
    expect(action.closePrev.snapshot_end_id).toEqual(prev._id)
    expect(action.createNew.window_end).toEqual(newReset)
    expect(action.createNew.is_partial).toBe(false)
    expect(action.createNew.snapshot_start_id).toEqual(now._id)
  })

  it('peak_hour updates when utilization increases', () => {
    const reset = new Date('2026-04-05T12:00:00Z')
    const start = snap({ five_hour_resets_at: reset, seven_day_pct: 0 })
    const prev = snap({ five_hour_resets_at: reset, seven_day_pct: 5, five_hour_pct: 10 })
    const now = snap({
      fetched_at: new Date('2026-04-05T09:00:00Z'), // 16:00 VN
      five_hour_resets_at: reset,
      five_hour_pct: 30,
      seven_day_pct: 10,
    })
    const open = openW({ window_end: reset, utilization_pct: 10, peak_hour_of_day: 14 })
    const action = detectWindowAction({
      seat_id: seatId,
      owner_id: ownerId,
      snapshotNow: now,
      snapshotPrev: prev,
      snapshotStart: start,
      openWindow: open,
    })
    expect(action.kind).toBe('update_open')
    if (action.kind !== 'update_open') return
    expect(action.patch.peak_hour_of_day).toBe(16)
  })

  it('last_activity_at bumps when utilization strictly increases', () => {
    const reset = new Date('2026-04-05T12:00:00Z')
    const nowTime = new Date('2026-04-05T09:30:00Z')
    const now = snap({
      fetched_at: nowTime,
      five_hour_resets_at: reset,
      five_hour_pct: 25, // > open.utilization_pct (10)
      seven_day_pct: 8,
    })
    const open = openW({ window_end: reset, utilization_pct: 10 })
    const action = detectWindowAction({
      seat_id: seatId, owner_id: ownerId,
      snapshotNow: now, snapshotPrev: null, snapshotStart: null, openWindow: open,
    })
    expect(action.kind).toBe('update_open')
    if (action.kind !== 'update_open') return
    expect(action.patch.last_activity_at).toEqual(nowTime)
  })

  it('last_activity_at unchanged when utilization stays flat (idle)', () => {
    const reset = new Date('2026-04-05T12:00:00Z')
    const now = snap({
      fetched_at: new Date('2026-04-05T09:30:00Z'),
      five_hour_resets_at: reset,
      five_hour_pct: 10, // == open.utilization_pct, not strictly greater
      seven_day_pct: 8,
    })
    const open = openW({ window_end: reset, utilization_pct: 10 })
    const action = detectWindowAction({
      seat_id: seatId, owner_id: ownerId,
      snapshotNow: now, snapshotPrev: null, snapshotStart: null, openWindow: open,
    })
    expect(action.kind).toBe('update_open')
    if (action.kind !== 'update_open') return
    expect(action.patch.last_activity_at).toBeUndefined() // not touched → preserves DB value
  })
})
