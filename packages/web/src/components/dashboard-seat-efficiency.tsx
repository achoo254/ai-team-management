import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Cell, LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCardSeatOverride } from "@/hooks/use-card-seat-override";
import { DashboardSeatFilter } from "@/components/dashboard-seat-filter";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced, formatRangeDate, type SeatUsageItem, type DashboardRange } from "@/hooks/use-dashboard";
import { cssVar } from "@/lib/chart-colors";

/* ---------- Data transform ---------- */

/** Compute 5h burn rate (%/h) from current pct and time into window */
function calcBurnRate5h(seat: SeatUsageItem): number {
  if (seat.five_hour_pct == null || seat.five_hour_pct <= 0) return 0;
  if (!seat.five_hour_resets_at) return 0;

  const resetsAt = new Date(seat.five_hour_resets_at).getTime();
  const now = Date.now();
  const windowStart = resetsAt - 5 * 60 * 60 * 1000;

  // Guard: stale or future window → no meaningful burn rate
  if (now < windowStart || now > resetsAt) return 0;

  const hoursElapsed = Math.max(0.5, (now - windowStart) / (60 * 60 * 1000));
  return Math.round((seat.five_hour_pct / hoursElapsed) * 10) / 10;
}

function calcChartData(seat: SeatUsageItem) {
  const burnRate = calcBurnRate5h(seat);
  return {
    label: seat.label,
    burn_rate: burnRate,
    sessions: seat.session_count_7d,
  };
}

/* ---------- Color helpers ---------- */

/** Burn rate color — higher = consuming faster = more urgent */
function burnRateColor(rate: number): string {
  if (rate >= 30) return cssVar("--chart-4");   // critical: >30%/h
  if (rate >= 15) return cssVar("--chart-3");   // warning: 15-30%/h
  return cssVar("--chart-2");                   // healthy: <15%/h
}

/** Session count — neutral color, not severity-based */
function sessionColor(): string {
  return cssVar("--chart-5");
}

/* ---------- Value label at end of bar ---------- */

function BurnRateLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (value == null || value === 0) return null;
  return (
    <text
      x={x + width + 4}
      y={y + height / 2}
      dy={4}
      textAnchor="start"
      style={{ fontSize: 10, fontWeight: 600, fill: burnRateColor(value) }}
    >
      {value}%/h
    </text>
  );
}

function SessionLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (value == null || value === 0) return null;
  return (
    <text
      x={x + width + 4}
      y={y + height / 2}
      dy={4}
      textAnchor="start"
      style={{ fontSize: 10, fontWeight: 600, fill: sessionColor() }}
    >
      {value}
    </text>
  );
}

/* ---------- Custom tooltip ---------- */

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-md p-3.5 text-sm shadow-xl min-w-[200px]">
      <p className="font-semibold text-foreground mb-2">{d.label}</p>
      <div className="space-y-1.5 text-xs">
        <TRow label="Burn rate 5h" value={`${d.burn_rate}%/h`} color={burnRateColor(d.burn_rate)} />
        <TRow label="Sessions (7d)" value={`${d.sessions}`} color={sessionColor()} />
      </div>
    </div>
  );
}

function TRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

/* ---------- Custom legend ---------- */

function ChartLegend() {
  return (
    <div className="flex items-center justify-center gap-5 pt-2 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-1">
        <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: cssVar("--chart-2") }} />
        <span>Burn rate 5h (%/h)</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: cssVar("--chart-5") }} />
        <span>Sessions (7d)</span>
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */

export function DashboardSeatEfficiency({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const filter = useCardSeatOverride(seatIds);
  const { data, isLoading } = useDashboardEnhanced(range, filter.effective);

  const chartData = (data?.usagePerSeat ?? [])
    .map(calcChartData)
    .sort((a, b) => b.burn_rate - a.burn_rate);

  // Dynamic max for X axis (burn rate can vary widely)
  const maxBurn = Math.max(...chartData.map((d) => d.burn_rate), 10);
  const maxSessions = Math.max(...chartData.map((d) => d.sessions), 5);
  const xMax = Math.max(maxBurn, maxSessions);

  const barSize = Math.min(16, Math.max(10, Math.floor(240 / Math.max(chartData.length, 1))));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">Tốc độ tiêu thụ Seat</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Burn rate 5h và số sessions 7 ngày · <span className="font-medium">{formatRangeDate(range)}</span>
            </p>
          </div>
          <DashboardSeatFilter compact value={filter.effective} onChange={filter.setOverride} isOverride={filter.isOverride} onReset={filter.resetToGlobal} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-[280px] w-full rounded-lg" />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 50, left: 4, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke={cssVar("--border")}
                  strokeOpacity={0.4}
                />
                <XAxis
                  type="number"
                  domain={[0, Math.ceil(xMax * 1.2)]}
                  tick={{ fontSize: 11, fontWeight: 500, fill: cssVar("--muted-foreground") }}
                  axisLine={{ stroke: cssVar("--border"), strokeOpacity: 0.5 }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fontWeight: 500, fill: cssVar("--muted-foreground") }}
                  width={80}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: cssVar("--foreground"), opacity: 0.04 }}
                />
                {/* Burn rate bar */}
                <Bar
                  dataKey="burn_rate"
                  name="Burn rate 5h"
                  maxBarSize={barSize}
                  radius={[0, 4, 4, 0]}
                >
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={burnRateColor(d.burn_rate)} fillOpacity={0.8} />
                  ))}
                  <LabelList content={<BurnRateLabel />} />
                </Bar>
                {/* Sessions bar */}
                <Bar
                  dataKey="sessions"
                  name="Sessions 7d"
                  maxBarSize={barSize}
                  radius={[0, 4, 4, 0]}
                >
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={sessionColor()} fillOpacity={0.8} />
                  ))}
                  <LabelList content={<SessionLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <ChartLegend />
          </>
        )}
      </CardContent>
    </Card>
  );
}
