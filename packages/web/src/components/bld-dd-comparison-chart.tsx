import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DdHistoryPoint } from "@repo/shared/types";

interface Props {
  data: DdHistoryPoint[];
}

function formatDayLabel(isoDate: string): string {
  const d = new Date(isoDate);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Bar color based on peak intensity */
function barColor(pct: number): string {
  if (pct >= 80) return "#22c55e"; // green — heavy use
  if (pct >= 50) return "#3b82f6"; // blue — moderate
  if (pct >= 20) return "#f59e0b"; // amber — light
  return "#ef4444";                // red — waste
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-md p-3 text-sm shadow-xl min-w-[140px]">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">Peak 5h TB</span>
        <span className="font-semibold tabular-nums" style={{ color: barColor(val) }}>
          {val}%
        </span>
      </div>
    </div>
  );
}

export function BldDdComparisonChart({ data }: Props) {
  if (data.length < 2) return null;

  const chartData = data.map((pt) => ({
    day: formatDayLabel(pt.date),
    peak: pt.avgPeak5h,
  }));

  const avgPeak = chartData.reduce((s, d) => s + d.peak, 0) / chartData.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">So sánh ngày / ngày (14 ngày gần nhất)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              className="text-muted-foreground"
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
            <ReferenceLine
              y={avgPeak}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{ value: `TB ${avgPeak.toFixed(0)}%`, position: "right", fontSize: 10, fill: "#94a3b8" }}
            />
            <Bar dataKey="peak" radius={[3, 3, 0, 0]} maxBarSize={32}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={barColor(entry.peak)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
