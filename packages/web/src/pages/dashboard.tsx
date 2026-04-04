import { useState } from "react";
import type { DashboardRange } from "@/hooks/use-dashboard";
import { DashboardRangeFilter } from "@/components/dashboard-range-filter";
import { DashboardStatOverview } from "@/components/dashboard-stat-overview";
import { DashboardSeatUsageChart } from "@/components/dashboard-seat-usage-chart";
import { DashboardTrendChart } from "@/components/dashboard-trend-chart";
import { DashboardTeamStats } from "@/components/dashboard-team-stats";
import { DashboardSeatEfficiency } from "@/components/dashboard-seat-efficiency";
import { DashboardDetailTable } from "@/components/dashboard-detail-table";
import { DashboardEfficiency } from "@/components/dashboard-efficiency";

export default function DashboardPage() {
  const [range, setRange] = useState<DashboardRange>("month");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <DashboardRangeFilter value={range} onChange={setRange} />
      </div>

      {/* Row 1: Key metrics */}
      <DashboardStatOverview range={range} />

      {/* Row 2: Charts — usage per seat + trend */}
      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardSeatUsageChart range={range} />
        <DashboardTrendChart range={range} />
      </div>

      {/* Row 3: Efficiency + team comparison */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <DashboardSeatEfficiency range={range} />
        </div>
        <div className="lg:col-span-2">
          <DashboardTeamStats range={range} />
        </div>
      </div>

      {/* Row 4: Usage Efficiency */}
      <DashboardEfficiency range={range} />

      {/* Row 5: Full detail table */}
      <DashboardDetailTable range={range} />
    </div>
  );
}
