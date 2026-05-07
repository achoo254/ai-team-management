import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboardEnhanced, formatRangeDate, type DashboardRange, type UsageTrendPoint } from "@/hooks/use-dashboard";
import { useCardSeatOverride } from "@/hooks/use-card-seat-override";
import { DashboardSeatFilter } from "@/components/dashboard-seat-filter";
import { cssVar, getChartColors } from "@/lib/chart-colors";

const RANGE_LABELS: Record<DashboardRange, string> = {
  day: "Hôm nay (theo giờ)",
  week: "7 ngày",
  month: "30 ngày",
  "3month": "3 tháng",
  "6month": "6 tháng",
};

type Metric = "5h" | "7d";

const METRIC_FIELD: Record<Metric, keyof Pick<UsageTrendPoint, "five_hour_pct" | "seven_day_pct">> = {
  "5h": "five_hour_pct",
  "7d": "seven_day_pct",
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
  const visible = payload.filter((e: any) => e.value != null);
  if (!visible.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-md p-3.5 text-sm shadow-xl min-w-[180px] max-w-[280px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        {visible.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.stroke }}
              />
              <span className="text-muted-foreground truncate">{entry.name}</span>
            </div>
            <span className="font-semibold tabular-nums shrink-0" style={{ color: entry.stroke }}>
              {`${entry.value}%`}
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
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2">
      {payload?.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Pivot helper ---------- */

interface PivotResult {
  rows: Array<Record<string, string | number | null>>;
  seats: Array<{ seat_id: string; seat_label: string }>;
}

function pivotTrend(points: UsageTrendPoint[], metric: Metric, range: DashboardRange): PivotResult {
  const field = METRIC_FIELD[metric];
  const seatMap = new Map<string, string>();
  const rowMap = new Map<string, Record<string, string | number | null>>();

  for (const p of points) {
    seatMap.set(p.seat_id, p.seat_label);
    let row = rowMap.get(p.date);
    if (!row) {
      row = { date: p.date, label: formatDate(p.date, range) };
      rowMap.set(p.date, row);
    }
    row[p.seat_id] = p[field];
  }

  const rows = [...rowMap.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const seats = [...seatMap.entries()]
    .map(([seat_id, seat_label]) => ({ seat_id, seat_label }))
    .sort((a, b) => a.seat_label.localeCompare(b.seat_label));

  return { rows, seats };
}

/* ---------- Main component ---------- */

export function DashboardTrendChart({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const filter = useCardSeatOverride(seatIds);
  const { data, isLoading } = useDashboardEnhanced(range, filter.effective);
  const [metric, setMetric] = useState<Metric>("5h");

  const { rows, seats } = useMemo(
    () => pivotTrend(data?.usageTrend ?? [], metric, range),
    [data?.usageTrend, metric, range],
  );

  const palette = getChartColors();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">Xu hướng sử dụng — {RANGE_LABELS[range]}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mức dùng usage theo từng seat · <span className="font-medium">{formatRangeDate(range)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={metric} onValueChange={(v) => setMetric((v as Metric) ?? "5h")}>
              <TabsList className="h-7">
                <TabsTrigger value="5h" className="text-xs px-2.5">5 giờ</TabsTrigger>
                <TabsTrigger value="7d" className="text-xs px-2.5">7 ngày</TabsTrigger>
              </TabsList>
            </Tabs>
            <DashboardSeatFilter compact value={filter.effective} onChange={filter.setOverride} isOverride={filter.isOverride} onReset={filter.resetToGlobal} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-[320px] w-full rounded-lg" />
        ) : seats.length === 0 ? (
          <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
            Chưa có dữ liệu usage trong khoảng thời gian này.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={rows} margin={{ top: 8, right: 12, left: -4, bottom: 4 }}>
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
              {seats.map((s, idx) => {
                const color = palette[idx % palette.length] || cssVar("--chart-1");
                return (
                  <Line
                    key={s.seat_id}
                    type="monotone"
                    dataKey={s.seat_id}
                    name={s.seat_label}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "var(--card)", stroke: color, strokeWidth: 2 }}
                    activeDot={{ r: 4 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
