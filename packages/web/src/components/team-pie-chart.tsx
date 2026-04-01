
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, type PieLabelRenderProps } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced } from "@/hooks/use-dashboard";
import { cssVar, getTeamColor } from "@/lib/chart-colors";

function renderCustomLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, name, value } = props;
  const cxN = Number(cx ?? 0);
  const cyN = Number(cy ?? 0);
  const midN = Number(midAngle ?? 0);
  const innerN = Number(innerRadius ?? 0);
  const outerN = Number(outerRadius ?? 0);
  const RADIAN = Math.PI / 180;
  const r = innerN + (outerN - innerN) * 0.5;
  const x = cxN + r * Math.cos(-midN * RADIAN);
  const y = cyN + r * Math.sin(-midN * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12}>
      {`${name} ${value}%`}
    </text>
  );
}

export function TeamPieChart() {
  const { data, isLoading } = useDashboardEnhanced();

  const chartData = (data?.teamUsage ?? []).map((t) => ({
    name: t.team.toUpperCase(),
    value: Math.round(t.avg_pct),
    key: t.team.toLowerCase(),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Usage theo Team</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                labelLine={false}
                label={renderCustomLabel}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.key}
                    fill={getTeamColor(entry.key, index)}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(val) => `${val}%`}
                contentStyle={{ backgroundColor: cssVar("--card"), border: `1px solid ${cssVar("--border")}`, borderRadius: 8 }}
                labelStyle={{ color: cssVar("--foreground") }}
                itemStyle={{ color: cssVar("--foreground") }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
