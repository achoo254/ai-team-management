import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Cell, LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCardSeatOverride } from "@/hooks/use-card-seat-override";
import { DashboardSeatFilter } from "@/components/dashboard-seat-filter";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced, type SeatUsageItem, type DashboardRange } from "@/hooks/use-dashboard";
import { cssVar } from "@/lib/chart-colors";

/* ---------- Data transform ---------- */

const FIVE_HOUR_MS = 5 * 60 * 60 * 1000;

/** Burn rate 5h: % quota 5h đã dùng / số giờ kể từ lần reset 5h gần nhất */
function calcBurnRate5h(pct: number | null, resetsAt: string | null): number {
  if (pct == null || pct <= 0) return 0;
  if (!resetsAt) return 0;

  const resetsAtMs = new Date(resetsAt).getTime();
  const now = Date.now();
  const windowStart = resetsAtMs - FIVE_HOUR_MS;

  if (now < windowStart || now > resetsAtMs) return 0;

  const hoursElapsed = Math.max(0.5, (now - windowStart) / (60 * 60 * 1000));
  return Math.round((pct / hoursElapsed) * 10) / 10;
}

function calcChartData(seat: SeatUsageItem) {
  return {
    label: seat.label,
    burn_rate_5h: calcBurnRate5h(seat.five_hour_pct, seat.five_hour_resets_at),
    // Burn rate 7d đo trong cùng cửa sổ "cycle 5h hiện tại" (do backend tính sẵn)
    // → idle ⇒ 0%/h, apples-to-apples với burn_rate_5h.
    burn_rate_7d: seat.burn_rate_7d_current_cycle,
  };
}

/* ---------- Color helpers ---------- */

/** Burn rate color — higher = consuming faster = more urgent */
function burnRateColor(rate: number): string {
  if (rate >= 30) return cssVar("--chart-4");   // critical: >30%/h
  if (rate >= 15) return cssVar("--chart-3");   // warning: 15-30%/h
  return cssVar("--chart-2");                   // healthy: <15%/h
}

/** Baseline (7d burn rate) color — neutral muted, contrasts with current burn */
function baselineColor(): string {
  return cssVar("--muted-foreground");
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

function BaselineLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (value == null || value === 0) return null;
  return (
    <text
      x={x + width + 4}
      y={y + height / 2}
      dy={4}
      textAnchor="start"
      style={{ fontSize: 10, fontWeight: 600, fill: baselineColor() }}
    >
      {value}%/h
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
        <TRow label="Burn rate 5h" value={`${d.burn_rate_5h}%/h`} color={burnRateColor(d.burn_rate_5h)} />
        <TRow label="Burn rate 7d" value={`${d.burn_rate_7d}%/h`} color={baselineColor()} />
      </div>
      <p className="mt-2 text-[10px] leading-tight text-muted-foreground/80">
        Cùng cửa sổ 5h hiện tại — quota 5h vs quota 7d. Idle ⇒ 0%/h.
      </p>
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
        <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: cssVar("--muted-foreground") }} />
        <span>Burn rate 7d (%/h)</span>
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
    .sort((a, b) => b.burn_rate_5h - a.burn_rate_5h);

  // Dynamic max for X axis (both bars share %/h unit)
  const maxBurn5h = Math.max(...chartData.map((d) => d.burn_rate_5h), 10);
  const maxBurn7d = Math.max(...chartData.map((d) => d.burn_rate_7d), 10);
  const xMax = Math.max(maxBurn5h, maxBurn7d);

  const barSize = Math.min(16, Math.max(10, Math.floor(240 / Math.max(chartData.length, 1))));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">Tốc độ tiêu thụ Seat</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cùng cửa sổ 5h hiện tại — trên quota 5h vs trên quota 7d
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/70 italic hidden sm:inline">
              Không chịu ảnh hưởng bởi filter thời gian
            </span>
            <DashboardSeatFilter compact value={filter.effective} onChange={filter.setOverride} isOverride={filter.isOverride} onReset={filter.resetToGlobal} />
          </div>
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
                {/* Burn rate 5h bar */}
                <Bar
                  dataKey="burn_rate_5h"
                  name="Burn rate 5h"
                  maxBarSize={barSize}
                  radius={[0, 4, 4, 0]}
                >
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={burnRateColor(d.burn_rate_5h)} fillOpacity={0.8} />
                  ))}
                  <LabelList content={<BurnRateLabel />} />
                </Bar>
                {/* Burn rate 7d bar */}
                <Bar
                  dataKey="burn_rate_7d"
                  name="Burn rate 7d"
                  maxBarSize={barSize}
                  radius={[0, 4, 4, 0]}
                >
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={baselineColor()} fillOpacity={0.8} />
                  ))}
                  <LabelList content={<BaselineLabel />} />
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
