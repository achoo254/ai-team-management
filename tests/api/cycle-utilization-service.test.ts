/**
 * Completed-cycle utilization — the basis for real (as opposed to
 * phase-of-cycle) waste accounting.
 */

import { describe, it, expect } from 'vitest'
import { summarizeSeatCycles } from '@/services/cycle-utilization-service'

const NOW = new Date('2026-08-01T12:00:00Z')
const SEAT = 'seat-1'
const FULL = 2016 // a full cycle of 5-minute snapshots

interface Row {
  seat_id: string
  resets_at: Date
  peak_pct: number
  sample_count: number
}

function row(resetsAt: string, peak: number, samples = FULL, seat = SEAT): Row {
  return { seat_id: seat, resets_at: new Date(resetsAt), peak_pct: peak, sample_count: samples }
}

describe('summarizeSeatCycles', () => {
  it('averages the peaks of completed cycles, newest first', () => {
    const out = summarizeSeatCycles([
      row('2026-07-08T00:00:00Z', 80),
      row('2026-07-22T00:00:00Z', 90),
      row('2026-07-15T00:00:00Z', 70),
      row('2026-07-29T00:00:00Z', 100),
    ], SEAT, 'Seat 1', NOW, 4)

    expect(out.completed.map(c => c.peak_pct)).toEqual([100, 90, 70, 80])
    expect(out.lastCyclePct).toBe(100)
    expect(out.avgPct).toBe(85)
  })

  it('excludes the cycle still in progress', () => {
    const out = summarizeSeatCycles([
      row('2026-07-29T00:00:00Z', 97),
      row('2026-08-05T00:00:00Z', 47), // resets in the future
    ], SEAT, 'Seat 1', NOW, 4)

    expect(out.completed).toHaveLength(1)
    expect(out.avgPct).toBe(97)
  })

  it('drops cycles with too little snapshot coverage', () => {
    // A collector outage leaves a handful of samples whose max is not the peak.
    const out = summarizeSeatCycles([
      row('2026-07-29T00:00:00Z', 95),
      row('2026-07-22T00:00:00Z', 12, 6),
    ], SEAT, 'Seat 1', NOW, 4)

    expect(out.completed).toHaveLength(1)
    expect(out.avgPct).toBe(95)
  })

  it('honours the window and keeps the most recent cycles', () => {
    const out = summarizeSeatCycles([
      row('2026-07-01T00:00:00Z', 10),
      row('2026-07-08T00:00:00Z', 20),
      row('2026-07-15T00:00:00Z', 30),
      row('2026-07-22T00:00:00Z', 40),
      row('2026-07-29T00:00:00Z', 50),
    ], SEAT, 'Seat 1', NOW, 2)

    expect(out.completed.map(c => c.peak_pct)).toEqual([50, 40])
    expect(out.avgPct).toBe(45)
  })

  it('ignores rows belonging to other seats', () => {
    const out = summarizeSeatCycles([
      row('2026-07-29T00:00:00Z', 95),
      row('2026-07-29T00:00:00Z', 10, FULL, 'seat-2'),
    ], SEAT, 'Seat 1', NOW, 4)

    expect(out.completed).toHaveLength(1)
    expect(out.avgPct).toBe(95)
  })

  it('reports nulls when the seat has no completed cycle', () => {
    const out = summarizeSeatCycles([
      row('2026-08-05T00:00:00Z', 47),
    ], SEAT, 'Seat 1', NOW, 4)

    expect(out.completed).toHaveLength(0)
    expect(out.lastCyclePct).toBeNull()
    expect(out.avgPct).toBeNull()
  })
})
