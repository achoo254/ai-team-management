
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced } from "@/hooks/use-dashboard";
import { cssVar } from "@/lib/chart-colors";

export function UsageBarChart() {
  const { data, isLoading } = useDashboardEnhanced();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Usage per Seat</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.usagePerSeat ?? []} margin={{ top: 4, right: 8, left: -4, bottom: 4 }}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(val) => `${val}%`}
                cursor={{ fill: cssVar("--foreground"), opacity: 0.06 }}
                contentStyle={{ backgroundColor: cssVar("--card"), border: `1px solid ${cssVar("--border")}`, borderRadius: 8 }}
                labelStyle={{ color: cssVar("--foreground") }}
                itemStyle={{ color: cssVar("--foreground") }}
              />
              <Legend />
              <Bar dataKey="all_pct" name="All models" fill={cssVar("--chart-1")} radius={[3, 3, 0, 0]} />
              <Bar dataKey="sonnet_pct" name="Sonnet" fill={cssVar("--chart-2")} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
