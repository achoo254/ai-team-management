import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced, formatRangeDate, type DashboardRange } from "@/hooks/use-dashboard";
import { useCardSeatOverride } from "@/hooks/use-card-seat-override";
import { DashboardSeatFilter } from "@/components/dashboard-seat-filter";
import { cssVar } from "@/lib/chart-colors";

const RANGE_LABELS: Record<DashboardRange, string> = {
  day: "Hôm nay (theo giờ)",
  week: "7 ngày",
  month: "30 ngày",
  "3month": "3 tháng",
  "6month": "6 tháng",
};

function formatDate(dateStr: string, range: DashboardRange) {
  if (range === "day") {
    const hourMatch = dateStr.match(/(\d{2}:\d{2})$/);
    return hourMatch ? hourMatch[1] : dateStr;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ---------- Custom tooltip ---------- */

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-md p-3.5 text-sm shadow-xl min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.stroke }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
            </div>
            <span className="font-semibold tabular-nums" style={{ color: entry.stroke }}>
              {entry.value != null ? `${entry.value}%` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Custom legend ---------- */

function ChartLegend({ payload }: any) {
  return (
    <div className="flex items-center justify-center gap-5 pt-2">
      {payload?.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-6 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Custom active dot ---------- */

function ActiveDot(props: any) {
  const { cx, cy, stroke } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill={stroke} fillOpacity={0.15} />
      <circle cx={cx} cy={cy} r={3.5} fill="var(--card)" stroke={stroke} strokeWidth={2} />
    </g>
  );
}

/* ---------- Main component ---------- */

export function DashboardTrendChart({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const filter = useCardSeatOverride(seatIds);
  const { data, isLoading } = useDashboardEnhanced(range, filter.effective);

  const chartData = (data?.usageTrend ?? []).map((row) => ({
    ...row,
    label: formatDate(row.date, range),
  }));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">Xu hướng sử dụng — {RANGE_LABELS[range]}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Biến động mức dùng trung bình của tất cả seat theo thời gian · <span className="font-medium">{formatRangeDate(range)}</span>
            </p>
          </div>
          <DashboardSeatFilter compact value={filter.effective} onChange={filter.setOverride} isOverride={filter.isOverride} onReset={filter.resetToGlobal} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-[320px] w-full rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -4, bottom: 4 }}>
              <defs>
                <linearGradient id="trendGrad7d" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cssVar("--chart-1")} stopOpacity={0.35} />
                  <stop offset="50%" stopColor={cssVar("--chart-1")} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={cssVar("--chart-1")} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="trendGrad5h" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cssVar("--chart-3")} stopOpacity={0.3} />
                  <stop offset="50%" stopColor={cssVar("--chart-3")} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={cssVar("--chart-3")} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={cssVar("--border")}
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fontWeight: 500, fill: cssVar("--muted-foreground") }}
                axisLine={{ stroke: cssVar("--border"), strokeOpacity: 0.5 }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fontWeight: 500, fill: cssVar("--muted-foreground") }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<TrendTooltip />} />
              <Legend content={<ChartLegend />} />
              <Area
                type="monotone"
                dataKey="avg_7d_pct"
                name="TB 7 ngày %"
                stroke={cssVar("--chart-1")}
                strokeWidth={2.5}
                fill="url(#trendGrad7d)"
                dot={{ r: 3, fill: "var(--card)", stroke: cssVar("--chart-1"), strokeWidth: 2 }}
                activeDot={<ActiveDot />}
              />
              <Area
                type="monotone"
                dataKey="avg_5h_pct"
                name="TB 5 giờ %"
                stroke={cssVar("--chart-3")}
                strokeWidth={2.5}
                fill="url(#trendGrad5h)"
                dot={{ r: 3, fill: "var(--card)", stroke: cssVar("--chart-3"), strokeWidth: 2 }}
                activeDot={<ActiveDot />}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
