import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEfficiency, type DashboardRange } from "@/hooks/use-dashboard";

function StatBox({ label, value, suffix, warn }: { label: string; value: string | number; suffix?: string; warn?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold tabular-nums ${warn ? "text-red-500" : ""}`}>
        {value}{suffix}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

export function DashboardEfficiency({ range }: { range: DashboardRange }) {
  const { data, isLoading } = useEfficiency(range);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Usage Efficiency</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    );
  }

  const s = data?.summary;
  if (!s || s.total_sessions === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Usage Efficiency</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground text-center py-4">Chưa có dữ liệu session</p></CardContent>
      </Card>
    );
  }

  const wasteRate = s.total_sessions > 0 ? Math.round((s.waste_sessions / s.total_sessions) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Usage Efficiency</CardTitle>
          {(data?.activeSessions?.length ?? 0) > 0 && (
            <Badge variant="default" className="text-[10px]">
              {data!.activeSessions.length} session đang active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Avg Utilization" value={Math.round(s.avg_utilization)} suffix="%" />
          <StatBox label="5h→7d Impact" value={s.avg_impact_ratio != null ? s.avg_impact_ratio.toFixed(2) : "—"} />
          <StatBox label="Sessions" value={s.total_sessions} />
          <StatBox label="Waste Rate" value={wasteRate} suffix="%" warn={wasteRate > 20} />
        </div>

        {/* Active sessions (real-time) */}
        {data?.activeSessions && data.activeSessions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Sessions đang chạy</p>
            <div className="space-y-1">
              {data.activeSessions.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1.5">
                  <span className="font-medium">{a.user_name}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>Δ5h: <b className="text-foreground">{a.delta_5h}%</b></span>
                    <span>Δ7d: <b className="text-foreground">{a.delta_7d}%</b></span>
                    <span>Resets: {a.reset_count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-user breakdown */}
        {data?.perUser && data.perUser.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Per-user</p>
            <div className="space-y-1">
              {data.perUser
                .sort((a, b) => b.avg_utilization - a.avg_utilization)
                .map((u) => (
                  <div key={u.user_id} className="flex items-center justify-between text-xs">
                    <span className="truncate max-w-[120px]">{u.name}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>Util: <b className="text-foreground">{Math.round(u.avg_utilization)}%</b></span>
                      <span>Avg Δ5h: {u.avg_delta_5h.toFixed(1)}%</span>
                      <span>{u.session_count} sessions · {u.total_hours}h</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
