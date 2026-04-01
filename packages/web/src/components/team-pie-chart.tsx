
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, type PieLabelRenderProps } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced } from "@/hooks/use-dashboard";

const TEAM_COLORS: Record<string, string> = {
  dev: "#3b82f6",
  mkt: "#22c55e",
};

const FALLBACK_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

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
                    fill={TEAM_COLORS[entry.key] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(val) => `${val}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
