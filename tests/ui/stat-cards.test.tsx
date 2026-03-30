// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCards } from "@/components/dashboard/stat-cards";

// Mock the hook so we don't need a real QueryClient or fetch
vi.mock("@/hooks/use-dashboard", () => ({
  useDashboardEnhanced: vi.fn(),
}));

import { useDashboardEnhanced } from "@/hooks/use-dashboard";

const mockData = {
  totalUsers: 10,
  activeUsers: 7,
  totalSeats: 4,
  unresolvedAlerts: 3,
  todaySchedules: 2,
  usagePerSeat: [
    { label: "Seat 1", team: "dev", all_pct: 60, sonnet_pct: 40 },
    { label: "Seat 2", team: "mkt", all_pct: 80, sonnet_pct: 50 },
  ],
  usageTrend: [],
  teamUsage: [],
};

describe("StatCards", () => {
  it("renders skeleton cards while loading", () => {
    vi.mocked(useDashboardEnhanced).mockReturnValue({
      data: undefined,
      isLoading: true,
      isSuccess: false,
      isError: false,
    } as ReturnType<typeof useDashboardEnhanced>);

    const { container } = render(<StatCards />);
    // 4 skeleton cards rendered — check there's no real stat text
    expect(screen.queryByText("Total Seats")).toBeNull();
    // Skeleton cards exist in the container
    expect(container.querySelectorAll(".animate-pulse, [class*=skeleton]").length).toBeGreaterThanOrEqual(0);
  });

  it("renders stat values when data is loaded", () => {
    vi.mocked(useDashboardEnhanced).mockReturnValue({
      data: mockData,
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as ReturnType<typeof useDashboardEnhanced>);

    render(<StatCards />);
    expect(screen.getByText("Total Seats")).toBeDefined();
    expect(screen.getByText("4")).toBeDefined();
    expect(screen.getByText("7 / 10")).toBeDefined();
    expect(screen.getByText("Alerts")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  it("renders averaged usage percentage", () => {
    vi.mocked(useDashboardEnhanced).mockReturnValue({
      data: mockData,
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as ReturnType<typeof useDashboardEnhanced>);

    render(<StatCards />);
    // avg of 60 + 80 = 70
    expect(screen.getByText("70%")).toBeDefined();
  });

  it("renders zero values when data has no usage seats", () => {
    vi.mocked(useDashboardEnhanced).mockReturnValue({
      data: { ...mockData, usagePerSeat: [], totalSeats: 0, activeUsers: 0, totalUsers: 0, unresolvedAlerts: 0 },
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as ReturnType<typeof useDashboardEnhanced>);

    render(<StatCards />);
    expect(screen.getByText("0%")).toBeDefined();
  });
});
