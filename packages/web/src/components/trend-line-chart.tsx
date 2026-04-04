
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced } from "@/hooks/use-dashboard";
import { cssVar } from "@/lib/chart-colors";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function TrendLineChart() {
  const { data, isLoading } = useDashboardEnhanced();

  const chartData = (data?.usageTrend ?? []).map((row) => ({
    ...row,
    label: formatDate(row.date),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Xu hướng 30 ngày</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(val) => `${val}%`}
                cursor={{ stroke: cssVar("--muted"), strokeWidth: 1, strokeOpacity: 0.5 }}
                contentStyle={{ backgroundColor: cssVar("--card"), border: `1px solid ${cssVar("--border")}`, borderRadius: 8 }}
                labelStyle={{ color: cssVar("--foreground") }}
                itemStyle={{ color: cssVar("--foreground") }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="avg_pct"
                name="Avg 7d"
                stroke={cssVar("--chart-1")}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
