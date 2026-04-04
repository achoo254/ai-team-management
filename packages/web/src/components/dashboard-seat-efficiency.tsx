import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
  Cell, LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced, formatRangeDate, type SeatUsageItem, type DashboardRange } from "@/hooks/use-dashboard";
import { cssVar } from "@/lib/chart-colors";

/* ---------- Data transform ---------- */

function calcEfficiency(seat: SeatUsageItem) {
  const occupancy = seat.max_users > 0 ? seat.user_count / seat.max_users : 0;
  return {
    label: seat.label,
    team: seat.team,
    seven_day_pct: seat.seven_day_pct ?? 0,
    occupancy_pct: Math.round(occupancy * 100),
    user_count: seat.user_count,
    max_users: seat.max_users,
    per_user_usage: seat.user_count > 0 ? Math.round((seat.seven_day_pct ?? 0) / seat.user_count) : 0,
  };
}

/* ---------- Color helpers ---------- */

function barColor(perUserUsage: number): string {
  if (perUserUsage >= 50) return cssVar("--chart-4");
  if (perUserUsage >= 30) return cssVar("--chart-3");
  return cssVar("--chart-2");
}

/* ---------- Value label at end of bar ---------- */

function BarEndLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (value == null || value === 0) return null;
  const color = barColor(value);
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      dy={4}
      textAnchor="start"
      style={{ fontSize: 11, fontWeight: 700, fill: color }}
    >
      {value}%
    </text>
  );
}

/* ---------- Custom tooltip ---------- */

function EfficiencyTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-md p-3.5 text-sm shadow-xl min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: barColor(d.per_user_usage) }}
        />
        <p className="font-semibold text-foreground">{d.label}</p>
        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
          {d.team.toUpperCase()}
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        <TRow label="Dùng 7 ngày" value={`${d.seven_day_pct}%`} />
        <TRow label="Thành viên" value={`${d.user_count}/${d.max_users}`} />
        <TRow label="Tỷ lệ lấp đầy" value={`${d.occupancy_pct}%`} />
        <div className="flex justify-between gap-4 border-t border-border/40 pt-1.5 mt-2">
          <span className="text-muted-foreground">Dùng/người</span>
          <span className="font-bold tabular-nums" style={{ color: barColor(d.per_user_usage) }}>
            {d.per_user_usage}%
          </span>
        </div>
      </div>
    </div>
  );
}

function TRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/* ---------- Custom legend ---------- */

function EfficiencyLegend() {
  return (
    <div className="flex items-center justify-center gap-4 pt-2 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-1">
        <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: cssVar("--chart-2") }} />
        <span>&lt;30%</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: cssVar("--chart-3") }} />
        <span>30-50%</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: cssVar("--chart-4") }} />
        <span>≥50% (quá tải)</span>
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */

export function DashboardSeatEfficiency({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const { data, isLoading } = useDashboardEnhanced(range, seatIds);

  const chartData = (data?.usagePerSeat ?? [])
    .map(calcEfficiency)
    .sort((a, b) => b.per_user_usage - a.per_user_usage);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold">Hiệu suất Seat — Mức dùng trên mỗi thành viên</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tỷ lệ sử dụng 7 ngày chia đều cho số thành viên · <span className="font-medium">{formatRangeDate(range)}</span>
            </p>
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
                  domain={[0, "auto"]}
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
                  content={<EfficiencyTooltip />}
                  cursor={{ fill: cssVar("--foreground"), opacity: 0.04 }}
                />
                <ReferenceLine
                  x={50}
                  stroke={cssVar("--chart-4")}
                  strokeDasharray="6 4"
                  strokeOpacity={0.4}
                  strokeWidth={1.5}
                />
                <Bar
                  dataKey="per_user_usage"
                  name="Dùng/người %"
                  maxBarSize={22}
                  radius={[0, 5, 5, 0]}
                >
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={barColor(d.per_user_usage)} fillOpacity={0.85} />
                  ))}
                  <LabelList content={<BarEndLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <EfficiencyLegend />
          </>
        )}
      </CardContent>
    </Card>
  );
}
