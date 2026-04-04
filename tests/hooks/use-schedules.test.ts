// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createTestQueryWrapper } from "../helpers/query-wrapper";
import { useSchedules, useCreateScheduleEntry, useDeleteEntry } from "@/hooks/use-schedules";

const mockSchedule = {
  _id: "sched-1",
  seat_id: "seat-1",
  user_id: "user-1",
  day_of_week: 1,
  start_hour: 8,
  end_hour: 12,
  usage_budget_pct: null,
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
    expect(result.current.data?.schedules[0].start_hour).toBe(8);
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

describe("useCreateScheduleEntry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls POST /api/schedules/entry on mutate", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ entry: mockSchedule }), { status: 201 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useCreateScheduleEntry(), { wrapper });

    await act(async () => {
      result.current.mutate({
        seatId: "seat-1", userId: "user-1", dayOfWeek: 1,
        startHour: 8, endHour: 12,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/schedules/entry",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("useDeleteEntry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls DELETE /api/schedules/entry/:id on mutate", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Schedule entry removed" }), { status: 200 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useDeleteEntry(), { wrapper });

    await act(async () => {
      result.current.mutate("sched-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/schedules/entry/sched-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
