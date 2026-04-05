import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WwHistoryPoint } from "@repo/shared/types";

interface Props {
  data: WwHistoryPoint[];
}

function formatWeekLabel(isoDate: string): string {
  const d = new Date(isoDate);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-md p-3 text-sm shadow-xl min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any) => {
          const isPct = entry.name === "Mức sử dụng (%)";
          const v = entry.value;
          return (
            <div
              key={entry.name}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.stroke }}
                />
                <span className="text-muted-foreground">{entry.name}</span>
              </div>
              <span
                className="font-semibold tabular-nums"
                style={{ color: entry.stroke }}
              >
                {v != null ? (isPct ? `${v}%` : `$${v}`) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartLegend({ payload }: any) {
  return (
    <div className="flex items-center justify-center gap-5 pt-2">
      {payload?.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-6 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground font-medium">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BldWwComparisonChart({ data }: Props) {
  const chartData = data.map((pt) => ({
    week: formatWeekLabel(pt.week_start),
    "Mức sử dụng (%)": Number(pt.utilPct.toFixed(1)),
    "Lãng phí ($)": Number(pt.wasteUsd.toFixed(0)),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">So sánh tuần / tuần (8 tuần gần nhất)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradUtil" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradWaste" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <YAxis
              yAxisId="left"
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              className="text-muted-foreground"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
              className="text-muted-foreground"
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
            <Legend content={<ChartLegend />} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="Mức sử dụng (%)"
              stroke="#22c55e"
              fill="url(#gradUtil)"
              strokeWidth={2}
              dot={false}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="Lãng phí ($)"
              stroke="#f59e0b"
              fill="url(#gradWaste)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
