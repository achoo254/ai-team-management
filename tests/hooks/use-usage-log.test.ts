// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createTestQueryWrapper } from "../helpers/query-wrapper";
import { useWeekLog, useBulkLog, getWeekStart } from "@/hooks/use-usage-log";

const mockWeekLog = {
  weekStart: "2026-03-23",
  seats: [
    {
      seatId: "seat-1",
      seatEmail: "seat1@example.com",
      seatLabel: "Seat 1",
      team: "dev",
      weeklyAllPct: 75,
      weeklySonnetPct: 50,
      loggedAt: "2026-03-24T08:00:00.000Z",
    },
  ],
};

describe("getWeekStart", () => {
  it("returns Monday of the week for a Wednesday", () => {
    // 2026-03-25 is a Wednesday; Monday is 2026-03-23
    expect(getWeekStart(new Date("2026-03-25"))).toBe("2026-03-23");
  });

  it("returns Monday itself when date is already Monday", () => {
    expect(getWeekStart(new Date("2026-03-23"))).toBe("2026-03-23");
  });
});

describe("useWeekLog", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockWeekLog), { status: 200 })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches week log for given weekStart", async () => {
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useWeekLog("2026-03-23"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.weekStart).toBe("2026-03-23");
    expect(result.current.data?.seats).toHaveLength(1);
    expect(result.current.data?.seats[0].weeklyAllPct).toBe(75);
  });

  it("calls the correct URL with weekStart param", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockWeekLog), { status: 200 })
    );
    const wrapper = createTestQueryWrapper();
    renderHook(() => useWeekLog("2026-03-23"), { wrapper });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/usage-log/week?weekStart=2026-03-23",
      expect.any(Object)
    );
  });
});

describe("useBulkLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls POST /api/usage-log/bulk on mutate", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useBulkLog(), { wrapper });

    await act(async () => {
      result.current.mutate({
        weekStart: "2026-03-23",
        entries: [{ seatEmail: "seat1@example.com", weeklyAllPct: 75, weeklySonnetPct: 50 }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/usage-log/bulk",
      expect.objectContaining({ method: "POST" })
    );
  });
});
