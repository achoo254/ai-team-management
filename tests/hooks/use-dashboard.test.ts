// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createTestQueryWrapper } from "../helpers/query-wrapper";
import { useDashboardEnhanced } from "@/hooks/use-dashboard";

const mockDashboard = {
  totalUsers: 10,
  activeUsers: 8,
  totalSeats: 4,
  unresolvedAlerts: 2,
  tokenIssueCount: 0,
  fullSeatCount: 1,
  todaySchedules: 3,
  usagePerSeat: [{ label: "Seat 1", owner_name: "John", five_hour_pct: 40, seven_day_pct: 60 }],
  usageTrend: [{ date: "2026-03-23", avg_7d_pct: 55, avg_5h_pct: 40 }],
  overBudgetSeats: [],
};

describe("useDashboardEnhanced", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockDashboard), { status: 200 })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches enhanced dashboard data successfully", async () => {
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useDashboardEnhanced(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalUsers).toBe(10);
    expect(result.current.data?.activeUsers).toBe(8);
    expect(result.current.data?.unresolvedAlerts).toBe(2);
  });

  it("enters error state when fetch fails", async () => {
    vi.restoreAllMocks();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Server error" }), { status: 500 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useDashboardEnhanced(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
