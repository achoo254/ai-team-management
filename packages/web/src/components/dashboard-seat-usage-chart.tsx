import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced, type SeatUsageItem, type DashboardRange } from "@/hooks/use-dashboard";
import { cssVar } from "@/lib/chart-colors";

function usageColor(pct: number | null): string {
  if (pct === null) return cssVar("--muted-foreground");
  if (pct >= 80) return cssVar("--chart-4");
  if (pct >= 50) return cssVar("--chart-3");
  return cssVar("--chart-2");
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const seat = payload[0]?.payload as SeatUsageItem | undefined;
  return (
    <div className="rounded-lg border bg-card p-3 text-sm shadow-md" style={{ minWidth: 200 }}>
      <p className="font-semibold mb-1.5">{label}</p>
      <div className="space-y-1 text-xs">
        <Row label="5h" value={seat?.five_hour_pct} />
        <Row label="7d" value={seat?.seven_day_pct} />
        <Row label="Sonnet 7d" value={seat?.seven_day_sonnet_pct} />
        <Row label="Opus 7d" value={seat?.seven_day_opus_pct} />
        <div className="border-t pt-1 mt-1.5">
          <p className="text-muted-foreground">
            Members: {seat?.user_count}/{seat?.max_users}
            {seat?.users?.length ? ` — ${seat.users.join(", ")}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium" style={{ color: usageColor(value ?? null) }}>
        {value != null ? `${value}%` : "—"}
      </span>
    </div>
  );
}

export function DashboardSeatUsageChart({ range }: { range: DashboardRange }) {
  const { data, isLoading } = useDashboardEnhanced(range);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Usage per Seat — 5h vs 7d</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={data?.usagePerSeat ?? []}
              margin={{ top: 4, right: 8, left: -8, bottom: 4 }}
            >
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: cssVar("--foreground"), opacity: 0.04 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={80} stroke={cssVar("--chart-4")} strokeDasharray="4 4" strokeOpacity={0.5} />
              <Bar dataKey="seven_day_pct" name="7d %" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {(data?.usagePerSeat ?? []).map((s, i) => (
                  <Cell key={i} fill={usageColor(s.seven_day_pct)} />
                ))}
              </Bar>
              <Bar dataKey="five_hour_pct" name="5h %" fill={cssVar("--chart-1")} radius={[3, 3, 0, 0]} maxBarSize={28} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
