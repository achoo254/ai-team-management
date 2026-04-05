import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, CartesianGrid, LabelList, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCardSeatOverride } from "@/hooks/use-card-seat-override";
import { DashboardSeatFilter } from "@/components/dashboard-seat-filter";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced, type SeatUsageItem, type DashboardRange } from "@/hooks/use-dashboard";
import { cssVar } from "@/lib/chart-colors";
import { formatResetTime } from "@/lib/format-reset";

/* ---------- Color helpers ---------- */

/** 7d bars: dynamic color based on usage level */
function usage7dColor(pct: number | null): string {
  if (pct === null) return cssVar("--muted-foreground");
  if (pct >= 80) return cssVar("--chart-4");
  if (pct >= 50) return cssVar("--chart-3");
  return cssVar("--chart-2");
}

/* ---------- Custom tooltip ---------- */

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const seat = payload[0]?.payload as SeatUsageItem | undefined;
  return (
    <div
      className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-md p-3.5 text-sm shadow-xl"
      style={{ minWidth: 210 }}
    >
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1.5 text-xs">
        <TooltipRow label="5h" value={seat?.five_hour_pct} color={cssVar("--chart-1")} resetsAt={seat?.five_hour_resets_at ?? null} />
        <TooltipRow label="7d" value={seat?.seven_day_pct} color={usage7dColor(seat?.seven_day_pct ?? null)} resetsAt={seat?.seven_day_resets_at ?? null} />
        <TooltipRow label="Sonnet 7d" value={seat?.seven_day_sonnet_pct} color={cssVar("--muted-foreground")} />
        <TooltipRow label="Opus 7d" value={seat?.seven_day_opus_pct} color={cssVar("--muted-foreground")} />
        <div className="border-t border-border/40 pt-1.5 mt-2">
          <p className="text-muted-foreground">
            Thành viên: {seat?.user_count}/{seat?.max_users}
            {seat?.users?.length ? ` — ${seat.users.join(", ")}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function TooltipRow({ label, value, color, resetsAt }: { label: string; value: number | null | undefined; color: string; resetsAt?: string | null }) {
  return (
    <div>
      <div className="flex justify-between gap-6">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-muted-foreground">{label}</span>
        </div>
        <span className="font-semibold tabular-nums" style={{ color }}>
          {value != null ? `${value}%` : "—"}
        </span>
      </div>
      {resetsAt != null && (
        <div className="ml-3.5 text-[10px] text-muted-foreground/80">
          ↻ {formatResetTime(resetsAt).label}
        </div>
      )}
    </div>
  );
}

/* ---------- Custom legend ---------- */

function ChartLegend() {
  const items = [
    { label: "5h %", color: cssVar("--chart-1"), type: "solid" as const },
    { label: "7d %", color: cssVar("--chart-2"), type: "gradient" as const },
  ];
  return (
    <div className="flex items-center justify-center gap-6 pt-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{
              backgroundColor: item.color,
              opacity: item.type === "solid" ? 1 : 0.85,
            }}
          />
          <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
        </div>
      ))}
      <div className="text-[10px] text-muted-foreground/60 ml-2">
        (7d: <span className="text-success">xanh</span> &lt;50% · <span className="text-warning">vàng</span> 50-80% · <span className="text-error">đỏ</span> ≥80%)
      </div>
    </div>
  );
}

/* ---------- Custom bar shape with gradient ---------- */

function GradientBar(props: any) {
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0) return null;
  const id = `bar-grad-${Math.round(x)}-${Math.round(y)}`;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity={1} />
          <stop offset="100%" stopColor={fill} stopOpacity={0.6} />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill={`url(#${id})`} />
    </g>
  );
}

/* ---------- Value label on top of bars ---------- */

function BarValueLabel(props: any) {
  const { x, y, width, value } = props;
  if (value == null || value === 0) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="middle"
      className="fill-foreground"
      style={{ fontSize: 10, fontWeight: 600 }}
    >
      {value}%
    </text>
  );
}

/* ---------- Axis ticks ---------- */

function AxisTick({ x, y, payload, rotate }: any) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0} y={0} dy={14}
        textAnchor={rotate ? "end" : "middle"}
        transform={rotate ? "rotate(-20)" : undefined}
        className="fill-muted-foreground"
        style={{ fontSize: 11, fontWeight: 500 }}
      >
        {payload.value}
      </text>
    </g>
  );
}

function YAxisTick({ x, y, payload }: any) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0} y={0} dy={4}
        textAnchor="end"
        className="fill-muted-foreground"
        style={{ fontSize: 11, fontWeight: 500 }}
      >
        {payload.value}%
      </text>
    </g>
  );
}

/* ---------- Main component ---------- */

/** Format the most recent fetched_at across seats as HH:MM (Asia/Ho_Chi_Minh) */
function formatLatestFetch(seats: SeatUsageItem[] | undefined): string | null {
  if (!seats?.length) return null;
  const timestamps = seats
    .map((s) => s.last_fetched_at)
    .filter((t): t is string => !!t)
    .map((t) => new Date(t).getTime());
  if (timestamps.length === 0) return null;
  const latest = new Date(Math.max(...timestamps));
  return latest.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export function DashboardSeatUsageChart({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const filter = useCardSeatOverride(seatIds);
  const { data, isLoading } = useDashboardEnhanced(range, filter.effective);
  const latestFetchTime = formatLatestFetch(data?.usagePerSeat);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">Mức dùng theo Seat — 5h vs 7d</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              So sánh % sử dụng chu kỳ 5 giờ gần nhất và trung bình 7 ngày ·{" "}
              <span className="font-medium">
                Realtime{latestFetchTime ? ` (cập nhật ${latestFetchTime})` : ""}
              </span>
              <span className="ml-1 text-muted-foreground/70">— không phụ thuộc bộ lọc thời gian</span>
            </p>
          </div>
          <DashboardSeatFilter compact value={filter.effective} onChange={filter.setOverride} isOverride={filter.isOverride} onReset={filter.resetToGlobal} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-[340px] w-full rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={data?.usagePerSeat ?? []}
              margin={{ top: 20, right: 12, left: -4, bottom: 4 }}
              barCategoryGap="20%"
              barGap={4}
            >
              <defs>
                <linearGradient id="bar5hGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cssVar("--chart-1")} stopOpacity={1} />
                  <stop offset="100%" stopColor={cssVar("--chart-1")} stopOpacity={0.65} />
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
                tick={<AxisTick rotate />}
                interval={0}
                height={50}
                axisLine={{ stroke: cssVar("--border"), strokeOpacity: 0.5 }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={<YAxisTick />}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: cssVar("--foreground"), opacity: 0.04 }}
              />
              <Legend content={<ChartLegend />} />
              <ReferenceLine
                y={80}
                stroke={cssVar("--chart-4")}
                strokeDasharray="6 4"
                strokeOpacity={0.45}
                strokeWidth={1.5}
              />
              {/* 5h bar — solid blue (chart-1) */}
              <Bar
                dataKey="five_hour_pct"
                name="5h %"
                fill="url(#bar5hGrad)"
                radius={[5, 5, 0, 0]}
                maxBarSize={32}
              >
                <LabelList content={<BarValueLabel />} />
              </Bar>
              {/* 7d bar — dynamic color by usage level */}
              <Bar
                dataKey="seven_day_pct"
                name="7d %"
                radius={[5, 5, 0, 0]}
                maxBarSize={32}
                shape={<GradientBar />}
              >
                {(data?.usagePerSeat ?? []).map((s, i) => (
                  <Cell key={i} fill={usage7dColor(s.seven_day_pct)} />
                ))}
                <LabelList content={<BarValueLabel />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
