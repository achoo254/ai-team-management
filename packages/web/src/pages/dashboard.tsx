import { StatCards } from "@/components/stat-cards";
import { UsageBarChart } from "@/components/usage-bar-chart";
import { TrendLineChart } from "@/components/trend-line-chart";
import { TeamPieChart } from "@/components/team-pie-chart";
import { UsageTable } from "@/components/usage-table";

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
