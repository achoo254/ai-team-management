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

function calcDensity(seat: SeatUsageItem) {
  const occupancy = seat.max_users > 0 ? seat.user_count / seat.max_users : 0;
  const occupancyPct = Math.round(occupancy * 100);
  const usagePct = seat.seven_day_pct ?? 0;
  return {
    label: seat.label,
    occupancy_pct: occupancyPct,
    seven_day_pct: usagePct,
    user_count: seat.user_count,
    max_users: seat.max_users,
    /* Risk score: weighted combo — high occupancy + high usage = bottleneck */
    risk: occupancyPct * 0.4 + usagePct * 0.6,
  };
}

/* ---------- Color helpers ---------- */

/** Occupancy bar color — based on how full the seat is */
function occupancyColor(pct: number): string {
  if (pct >= 100) return cssVar("--chart-4");   // full
  if (pct >= 75) return cssVar("--chart-3");    // nearly full
  return cssVar("--chart-5");                   // ok
}

/** Usage bar color — based on 7d consumption */
function usageColor(pct: number): string {
  if (pct >= 80) return cssVar("--chart-4");    // critical
  if (pct >= 50) return cssVar("--chart-3");    // warning
  return cssVar("--chart-2");                   // healthy
}

/* ---------- Value label at end of bar ---------- */

function OccupancyLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (value == null || value === 0) return null;
  return (
    <text
      x={x + width + 4}
      y={y + height / 2}
      dy={4}
      textAnchor="start"
      style={{ fontSize: 10, fontWeight: 600, fill: occupancyColor(value) }}
    >
      {value}%
    </text>
  );
}

function UsageLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (value == null || value === 0) return null;
  return (
    <text
      x={x + width + 4}
      y={y + height / 2}
      dy={4}
      textAnchor="start"
      style={{ fontSize: 10, fontWeight: 600, fill: usageColor(value) }}
    >
      {value}%
    </text>
  );
}

/* ---------- Custom tooltip ---------- */

function DensityTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const riskLevel = d.risk >= 60 ? "Cao" : d.risk >= 35 ? "TB" : "Thấp";
  const riskColor = d.risk >= 60 ? cssVar("--chart-4") : d.risk >= 35 ? cssVar("--chart-3") : cssVar("--chart-2");

  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-md p-3.5 text-sm shadow-xl min-w-[200px]">
      <p className="font-semibold text-foreground mb-2">{d.label}</p>
      <div className="space-y-1.5 text-xs">
        <TRow label="Lấp đầy" value={`${d.user_count}/${d.max_users} (${d.occupancy_pct}%)`} color={occupancyColor(d.occupancy_pct)} />
        <TRow label="Dùng 7 ngày" value={`${d.seven_day_pct}%`} color={usageColor(d.seven_day_pct)} />
        <div className="flex justify-between gap-4 border-t border-border/40 pt-1.5 mt-2">
          <span className="text-muted-foreground">Mức rủi ro</span>
          <span className="font-bold" style={{ color: riskColor }}>{riskLevel}</span>
        </div>
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

function DensityLegend() {
  return (
    <div className="flex items-center justify-center gap-5 pt-2 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-1">
        <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: cssVar("--chart-5") }} />
        <span>Lấp đầy %</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: cssVar("--chart-2") }} />
        <span>Dùng 7d %</span>
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */

export function DashboardSeatEfficiency({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const filter = useCardSeatOverride(seatIds);
  const { data, isLoading } = useDashboardEnhanced(range, filter.effective);

  const chartData = (data?.usagePerSeat ?? [])
    .map(calcDensity)
    .sort((a, b) => b.risk - a.risk);

  const barSize = Math.min(16, Math.max(10, Math.floor(240 / Math.max(chartData.length, 1))));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">Mật độ sử dụng Seat</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tỷ lệ lấp đầy vs mức dùng 7 ngày · <span className="font-medium">{formatRangeDate(range)}</span>
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
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
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
                  content={<DensityTooltip />}
                  cursor={{ fill: cssVar("--foreground"), opacity: 0.04 }}
                />
                {/* Occupancy bar */}
                <Bar
                  dataKey="occupancy_pct"
                  name="Lấp đầy %"
                  maxBarSize={barSize}
                  radius={[0, 4, 4, 0]}
                >
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={occupancyColor(d.occupancy_pct)} fillOpacity={0.8} />
                  ))}
                  <LabelList content={<OccupancyLabel />} />
                </Bar>
                {/* 7d usage bar */}
                <Bar
                  dataKey="seven_day_pct"
                  name="Dùng 7d %"
                  maxBarSize={barSize}
                  radius={[0, 4, 4, 0]}
                >
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={usageColor(d.seven_day_pct)} fillOpacity={0.8} />
                  ))}
                  <LabelList content={<UsageLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <DensityLegend />
          </>
        )}
      </CardContent>
    </Card>
  );
}
