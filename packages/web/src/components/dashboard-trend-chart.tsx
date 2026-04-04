import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced, type DashboardRange } from "@/hooks/use-dashboard";
import { cssVar } from "@/lib/chart-colors";

const RANGE_LABELS: Record<DashboardRange, string> = {
  day: "Hôm nay (theo giờ)",
  week: "7 ngày",
  month: "30 ngày",
  "3month": "3 tháng",
  "6month": "6 tháng",
};

function formatDate(dateStr: string, range: DashboardRange) {
  // Hourly format for "day" range: "2026-04-04 14:00" → "14:00"
  if (range === "day") {
    const hourMatch = dateStr.match(/(\d{2}:\d{2})$/);
    return hourMatch ? hourMatch[1] : dateStr;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function DashboardTrendChart({ range }: { range: DashboardRange }) {
  const { data, isLoading } = useDashboardEnhanced(range);

  const chartData = (data?.usageTrend ?? []).map((row) => ({
    ...row,
    label: formatDate(row.date, range),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Xu hướng Usage — {RANGE_LABELS[range]}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
              <defs>
                <linearGradient id="grad7d" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cssVar("--chart-1")} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={cssVar("--chart-1")} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="grad5h" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cssVar("--chart-3")} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={cssVar("--chart-3")} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(val) => `${val}%`}
                contentStyle={{
                  backgroundColor: cssVar("--card"),
                  border: `1px solid ${cssVar("--border")}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: cssVar("--foreground") }}
                itemStyle={{ color: cssVar("--foreground") }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="avg_7d_pct"
                name="Avg 7d %"
                stroke={cssVar("--chart-1")}
                strokeWidth={2}
                fill="url(#grad7d)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="avg_5h_pct"
                name="Avg 5h %"
                stroke={cssVar("--chart-3")}
                strokeWidth={2}
                fill="url(#grad5h)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
