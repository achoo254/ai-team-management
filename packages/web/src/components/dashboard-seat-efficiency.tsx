import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced, type SeatUsageItem, type DashboardRange } from "@/hooks/use-dashboard";
import { cssVar } from "@/lib/chart-colors";

/**
 * Efficiency = 7d usage / occupancy ratio.
 * High usage + low occupancy → overloaded seat (needs more members or fewer tasks)
 * Low usage + high occupancy → underutilized (can reassign members)
 */
function calcEfficiency(seat: SeatUsageItem) {
  const occupancy = seat.max_users > 0 ? seat.user_count / seat.max_users : 0;
  return {
    label: seat.label,
    team: seat.team,
    seven_day_pct: seat.seven_day_pct ?? 0,
    occupancy_pct: Math.round(occupancy * 100),
    user_count: seat.user_count,
    max_users: seat.max_users,
    // efficiency score: usage relative to occupancy — higher means each user consumes more
    per_user_usage: seat.user_count > 0 ? Math.round((seat.seven_day_pct ?? 0) / seat.user_count) : 0,
  };
}

function EfficiencyTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-lg border bg-card p-3 text-sm shadow-md" style={{ minWidth: 180 }}>
      <p className="font-semibold mb-1">{d.label} ({d.team.toUpperCase()})</p>
      <div className="space-y-0.5 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">7d Usage</span>
          <span className="font-medium">{d.seven_day_pct}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Members</span>
          <span className="font-medium">{d.user_count}/{d.max_users}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Occupancy</span>
          <span className="font-medium">{d.occupancy_pct}%</span>
        </div>
        <div className="flex justify-between gap-4 border-t pt-1 mt-1">
          <span className="text-muted-foreground">Usage/user</span>
          <span className="font-bold">{d.per_user_usage}%</span>
        </div>
      </div>
    </div>
  );
}

function barColor(perUserUsage: number): string {
  if (perUserUsage >= 40) return cssVar("--chart-4"); // red — heavy per-user load
  if (perUserUsage >= 20) return cssVar("--chart-3"); // yellow — moderate
  return cssVar("--chart-2"); // green — balanced
}

export function DashboardSeatEfficiency({ range }: { range: DashboardRange }) {
  const { data, isLoading } = useDashboardEnhanced(range);

  const chartData = (data?.usagePerSeat ?? [])
    .map(calcEfficiency)
    .sort((a, b) => b.per_user_usage - a.per_user_usage);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Seat Efficiency — Usage per Member</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cao = mỗi user dùng nhiều → cần thêm member hoặc giảm tải
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
            >
              <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={80} />
              <Tooltip content={<EfficiencyTooltip />} cursor={{ fill: cssVar("--foreground"), opacity: 0.04 }} />
              <ReferenceLine x={30} stroke={cssVar("--chart-4")} strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: "High", fontSize: 10, fill: cssVar("--muted-foreground") }} />
              <Bar dataKey="per_user_usage" name="Usage/user %" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={barColor(d.per_user_usage)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
