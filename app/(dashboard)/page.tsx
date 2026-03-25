"use client";

import { StatCards } from "@/components/dashboard/stat-cards";
import { UsageBarChart } from "@/components/dashboard/usage-bar-chart";
import { TrendLineChart } from "@/components/dashboard/trend-line-chart";
import { TeamPieChart } from "@/components/dashboard/team-pie-chart";
import { UsageTable } from "@/components/dashboard/usage-table";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <StatCards />
      <div className="grid gap-6 lg:grid-cols-2">
        <UsageBarChart />
        <TrendLineChart />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UsageTable />
        </div>
        <TeamPieChart />
      </div>
    </div>
  );
}
