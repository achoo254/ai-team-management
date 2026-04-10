import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

// Mock UsageSnapshot.aggregate so getDueSeatsForUser doesn't need a real DB
vi.mock("@/models/usage-snapshot", () => ({
  UsageSnapshot: {
    aggregate: vi.fn(),
  },
}));

import { UsageSnapshot } from "@/models/usage-snapshot";
import { getDueSeatsForUser } from "@/services/telegram-service";
import type { IUser } from "@/models/user";

const mockAggregate = vi.mocked(UsageSnapshot.aggregate);

/** Build a minimal IUser-like object with watched_seats + cycle_reported map. */
function makeUser(opts: {
  seatIds?: string[];
  cycleReported?: Map<string, Date>;
} = {}): IUser {
  const watched = (opts.seatIds ?? []).map((id) => ({
    seat_id: new Types.ObjectId(id),
    threshold_5h_pct: 90,
    threshold_7d_pct: 85,
    burn_rate_threshold: 15,
    eta_warning_hours: 1.5,
    forecast_warning_hours: 48,
  }));
  return {
    _id: new Types.ObjectId(),
    name: "Tester",
    role: "user",
    active: true,
    fcm_tokens: [],
    push_enabled: false,
    watched_seats: watched,
    notification_settings: {
      report_enabled: true,
      cycle_reported: opts.cycleReported ?? new Map(),
    },
  } as unknown as IUser;
}

/** Stub aggregate result shape: { _id: ObjectId, seven_day_resets_at: Date|null } */
function snap(seatId: string, resetAt: Date | null) {
  return { _id: new Types.ObjectId(seatId), seven_day_resets_at: resetAt };
}

describe("getDueSeatsForUser", () => {
  // Fixed reference time → window = [+1h, +7h)
  const NOW = new Date("2026-04-10T00:00:00Z");
  const windowStart = new Date(NOW.getTime() + 1 * 3600_000);
  const windowEnd = new Date(NOW.getTime() + 7 * 3600_000);

  beforeEach(() => {
    mockAggregate.mockReset();
  });

  it("returns empty when user has no watched seats", async () => {
    mockAggregate.mockResolvedValue([]);
    const user = makeUser({ seatIds: [] });

    const result = await getDueSeatsForUser(user, windowStart, windowEnd);

    expect(result.dueSeatIds).toEqual([]);
    expect(result.resetMap.size).toBe(0);
    expect(mockAggregate).not.toHaveBeenCalled();
  });

  it("excludes seat whose reset_at is past the window", async () => {
    const seatId = new Types.ObjectId().toString();
    // reset = +10h → after windowEnd (+7h) → excluded
    const resetAt = new Date(NOW.getTime() + 10 * 3600_000);
    mockAggregate.mockResolvedValue([snap(seatId, resetAt)]);

    const result = await getDueSeatsForUser(makeUser({ seatIds: [seatId] }), windowStart, windowEnd);

    expect(result.dueSeatIds).toEqual([]);
  });

  it("excludes seat whose reset_at is before window start (already reset / too soon)", async () => {
    const seatId = new Types.ObjectId().toString();
    // reset = +0.5h → before windowStart (+1h) → excluded
    const resetAt = new Date(NOW.getTime() + 0.5 * 3600_000);
    mockAggregate.mockResolvedValue([snap(seatId, resetAt)]);

    const result = await getDueSeatsForUser(makeUser({ seatIds: [seatId] }), windowStart, windowEnd);

    expect(result.dueSeatIds).toEqual([]);
  });

  it("includes seat whose reset_at falls inside the window", async () => {
    const seatId = new Types.ObjectId().toString();
    const resetAt = new Date(NOW.getTime() + 3 * 3600_000); // +3h ∈ [+1h, +7h)
    mockAggregate.mockResolvedValue([snap(seatId, resetAt)]);

    const result = await getDueSeatsForUser(makeUser({ seatIds: [seatId] }), windowStart, windowEnd);

    expect(result.dueSeatIds).toEqual([seatId]);
    expect(result.resetMap.get(seatId)?.getTime()).toBe(resetAt.getTime());
  });

  it("dedup: skips seat already reported for the same cycle", async () => {
    const seatId = new Types.ObjectId().toString();
    const resetAt = new Date(NOW.getTime() + 3 * 3600_000);
    mockAggregate.mockResolvedValue([snap(seatId, resetAt)]);

    const cycleReported = new Map<string, Date>([[seatId, resetAt]]);
    const result = await getDueSeatsForUser(
      makeUser({ seatIds: [seatId], cycleReported }),
      windowStart,
      windowEnd,
    );

    expect(result.dueSeatIds).toEqual([]);
  });

  it("re-includes seat when reported reset_at differs (new cycle)", async () => {
    const seatId = new Types.ObjectId().toString();
    const newResetAt = new Date(NOW.getTime() + 3 * 3600_000);
    const oldResetAt = new Date(NOW.getTime() - 7 * 24 * 3600_000); // last week's cycle
    mockAggregate.mockResolvedValue([snap(seatId, newResetAt)]);

    const cycleReported = new Map<string, Date>([[seatId, oldResetAt]]);
    const result = await getDueSeatsForUser(
      makeUser({ seatIds: [seatId], cycleReported }),
      windowStart,
      windowEnd,
    );

    expect(result.dueSeatIds).toEqual([seatId]);
    expect(result.resetMap.get(seatId)?.getTime()).toBe(newResetAt.getTime());
  });

  it("skips seats with no snapshot and seats with null reset_at", async () => {
    const seatA = new Types.ObjectId().toString();
    const seatB = new Types.ObjectId().toString();
    // seatA missing entirely; seatB has null reset
    mockAggregate.mockResolvedValue([snap(seatB, null)]);

    const result = await getDueSeatsForUser(
      makeUser({ seatIds: [seatA, seatB] }),
      windowStart,
      windowEnd,
    );

    expect(result.dueSeatIds).toEqual([]);
  });

  it("returns multiple due seats in one call", async () => {
    const seatA = new Types.ObjectId().toString();
    const seatB = new Types.ObjectId().toString();
    const seatC = new Types.ObjectId().toString();
    const resetA = new Date(NOW.getTime() + 2 * 3600_000); // due
    const resetB = new Date(NOW.getTime() + 5 * 3600_000); // due
    const resetC = new Date(NOW.getTime() + 9 * 3600_000); // outside window
    mockAggregate.mockResolvedValue([snap(seatA, resetA), snap(seatB, resetB), snap(seatC, resetC)]);

    const result = await getDueSeatsForUser(
      makeUser({ seatIds: [seatA, seatB, seatC] }),
      windowStart,
      windowEnd,
    );

    expect(result.dueSeatIds.sort()).toEqual([seatA, seatB].sort());
    expect(result.resetMap.size).toBe(2);
  });
});
