import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEfficiency, formatRangeDate, type DashboardRange } from "@/hooks/use-dashboard";

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

export function DashboardEfficiency({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const { data, isLoading } = useEfficiency(range, seatIds);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Hiệu suất sử dụng</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    );
  }

  const s = data?.summary;
  const coverage = data?.coverage;
  if (!s || s.total_sessions === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Hiệu suất sử dụng</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Dữ liệu đang thu thập (session 5h đầu tiên)
          </p>
        </CardContent>
      </Card>
    );
  }

  const wasteRate = s.total_sessions > 0 ? Math.round((s.waste_sessions / s.total_sessions) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Hiệu suất sử dụng</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Phân tích mức sử dụng thực tế và lãng phí dựa trên dữ liệu session · <span className="font-medium">{formatRangeDate(range)}</span>
            </p>
          </div>
          {(data?.activeSessions?.length ?? 0) > 0 && (
            <Badge variant="default" className="text-[10px]">
              {data!.activeSessions.length} session đang mở
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {coverage && !coverage.has_data && (
          <div className="text-xs bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5 text-amber-700 dark:text-amber-400">
            Chưa có session nào được ghi nhận. Dữ liệu sẽ xuất hiện sau chu kỳ 5h đầu tiên.
          </div>
        )}
        {coverage && coverage.has_data && coverage.seats_with_data < coverage.seats_total && (
          <div className="text-xs bg-blue-500/10 border border-blue-500/30 rounded px-2 py-1.5 text-blue-700 dark:text-blue-400">
            Đang thu thập dữ liệu: {coverage.seats_with_data}/{coverage.seats_total} seats có session đã đóng.
          </div>
        )}
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="TB sử dụng" value={Math.round(s.avg_utilization)} suffix="%" />
          <StatBox label="Tác động 5h→7d" value={s.avg_impact_ratio != null ? s.avg_impact_ratio.toFixed(2) : "—"} />
          <StatBox label="Sessions" value={s.total_sessions} />
          <StatBox label="Tỷ lệ lãng phí" value={wasteRate} suffix="%" warn={wasteRate > 20} />
        </div>
        {/* Sonnet vs Opus split */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="TB Δ7d Sonnet" value={s.avg_delta_7d_sonnet.toFixed(1)} suffix="%" />
          <StatBox
            label="TB Δ7d Opus"
            value={s.avg_delta_7d_opus.toFixed(1)}
            suffix="%"
            warn={s.avg_delta_7d_opus > s.avg_delta_7d_sonnet}
          />
        </div>

        {/* Active sessions (real-time) */}
        {data?.activeSessions && data.activeSessions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Phiên đang chạy</p>
            <div className="space-y-1">
              {data.activeSessions.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1.5">
                  <span className="font-medium">{a.user_name}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>Util: <b className="text-foreground">{a.delta_5h}%</b></span>
                    <span>Δ7d: <b className="text-foreground">{a.delta_7d}%</b></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-user breakdown */}
        {data?.perUser && data.perUser.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Theo người dùng</p>
            <div className="space-y-1">
              {data.perUser
                .sort((a, b) => b.avg_utilization - a.avg_utilization)
                .map((u) => (
                  <div key={u.user_id} className="flex items-center justify-between text-xs">
                    <span className="truncate max-w-[120px]">{u.name}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>Dùng: <b className="text-foreground">{Math.round(u.avg_utilization)}%</b></span>
                      <span>{u.session_count} sessions · {Math.round(u.total_hours)}h</span>
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
