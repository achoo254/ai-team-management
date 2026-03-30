// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createTestQueryWrapper } from "../helpers/query-wrapper";
import { useSchedules, useAssignSchedule, useDeleteEntry } from "@/hooks/use-schedules";

const mockSchedule = {
  _id: "sched-1",
  seat_id: "seat-1",
  user_id: "user-1",
  day_of_week: 1,
  slot: "morning" as const,
  user_name: "Alice",
  seat_label: "Seat 1",
};

describe("useSchedules", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ schedules: [mockSchedule] }), { status: 200 })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches schedules successfully", async () => {
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useSchedules(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.schedules).toHaveLength(1);
    expect(result.current.data?.schedules[0].slot).toBe("morning");
  });

  it("enters error state when fetch fails", async () => {
    vi.restoreAllMocks();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Server error" }), { status: 500 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useSchedules(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useAssignSchedule", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls POST /api/schedules/assign on mutate", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useAssignSchedule(), { wrapper });

    await act(async () => {
      result.current.mutate({ seatId: "seat-1", userId: "user-1", dayOfWeek: 1, slot: "morning" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/schedules/assign",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("useDeleteEntry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls DELETE /api/schedules/entry on mutate", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useDeleteEntry(), { wrapper });

    await act(async () => {
      result.current.mutate({ seatId: "seat-1", dayOfWeek: 1, slot: "morning" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/schedules/entry",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
