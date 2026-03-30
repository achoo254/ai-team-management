// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createTestQueryWrapper } from "../helpers/query-wrapper";
import { useDashboardEnhanced, useUsageBySeat } from "@/hooks/use-dashboard";

const mockDashboard = {
  totalUsers: 10,
  activeUsers: 8,
  totalSeats: 4,
  unresolvedAlerts: 2,
  todaySchedules: 3,
  usagePerSeat: [{ label: "Seat 1", team: "dev", all_pct: 60, sonnet_pct: 40 }],
  usageTrend: [{ week_start: "2026-03-23", avg_all: 55, avg_sonnet: 35 }],
  teamUsage: [{ team: "dev", avg_pct: 58 }],
};

const mockUsageBySeat = {
  seats: [
    {
      seat_id: "seat-1",
      seat_email: "seat1@example.com",
      label: "Seat 1",
      team: "dev",
      weekly_all_pct: 60,
      weekly_sonnet_pct: 40,
      last_logged: "2026-03-24",
      users: ["Alice"],
    },
  ],
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

describe("useUsageBySeat", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockUsageBySeat), { status: 200 })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches usage by seat data successfully", async () => {
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useUsageBySeat(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.seats).toHaveLength(1);
    expect(result.current.data?.seats[0].label).toBe("Seat 1");
    expect(result.current.data?.seats[0].weekly_all_pct).toBe(60);
  });
});
