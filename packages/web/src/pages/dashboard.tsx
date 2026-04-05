import { useState } from "react";
import type { DashboardRange } from "@/hooks/use-dashboard";
import { useDashboardEnhanced } from "@/hooks/use-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { DashboardRangeFilter } from "@/components/dashboard-range-filter";
import { DashboardSeatFilter } from "@/components/dashboard-seat-filter";
import { DashboardStatOverview } from "@/components/dashboard-stat-overview";
import { DashboardSeatUsageChart } from "@/components/dashboard-seat-usage-chart";
import { DashboardTrendChart } from "@/components/dashboard-trend-chart";
import { DashboardSeatEfficiency } from "@/components/dashboard-seat-efficiency";
import { DashboardDetailTable } from "@/components/dashboard-detail-table";
import { DashboardEfficiency } from "@/components/dashboard-efficiency";
import { DashboardPeakHoursHeatmap } from "@/components/dashboard-peak-hours-heatmap";
import { DashboardMyEfficiency } from "@/components/dashboard-my-efficiency";
import { DashboardWelcome } from "@/components/dashboard-welcome";
import { DashboardPersonalContext } from "@/components/dashboard-personal-context";

export default function DashboardPage() {
  const [range, setRange] = useState<DashboardRange>("month");
  const [seatIds, setSeatIds] = useState<string[]>([]);
  const { user } = useAuth();
  const { data } = useDashboardEnhanced(range, seatIds);

  // Show welcome for non-admin users with no seats
  if (
    user?.role !== "admin" &&
    data &&
    data.usagePerSeat.length === 0 &&
    data.totalSeats === 0
  ) {
    return <DashboardWelcome />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          <DashboardSeatFilter value={seatIds} onChange={setSeatIds} />
          <DashboardRangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      {/* Row 1: Key metrics */}
      <DashboardStatOverview range={range} seatIds={seatIds} />

      {/* Row 2: Charts — usage per seat + trend */}
      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardSeatUsageChart range={range} seatIds={seatIds} />
        <DashboardTrendChart range={range} seatIds={seatIds} />
      </div>

      {/* Row 3: Personal context (non-admin only) */}
      {user?.role !== "admin" && <DashboardPersonalContext />}

      {/* My Efficiency (per-user summary) */}
      <DashboardMyEfficiency />

      {/* Row 4: Seat efficiency */}
      <DashboardSeatEfficiency range={range} seatIds={seatIds} />

      {/* Row 5: Usage Efficiency */}
      <DashboardEfficiency range={range} seatIds={seatIds} />

      {/* Peak hours heatmap */}
      <DashboardPeakHoursHeatmap range={range} seatIds={seatIds} />

      {/* Row 5: Full detail table */}
      <DashboardDetailTable range={range} seatIds={seatIds} />
    </div>
  );
}
