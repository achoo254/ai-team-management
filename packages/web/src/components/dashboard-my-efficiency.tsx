import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersonalDashboard, type MyEfficiencySeatRow } from "@/hooks/use-dashboard";

function MiniRow({ s }: { s: MyEfficiencySeatRow }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="truncate max-w-[160px]">{s.label}</span>
      <div className="flex items-center gap-2 text-muted-foreground">
        <b className="text-foreground tabular-nums">{s.avg_utilization}%</b>
        <span>· {s.window_count}w</span>
      </div>
    </div>
  );
}

export function DashboardMyEfficiency() {
  const { data, isLoading } = usePersonalDashboard();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Hiệu suất của tôi</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-28 w-full" /></CardContent>
      </Card>
    );
  }

  const eff = data?.myEfficiency;
  if (!eff) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Hiệu suất của tôi</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Chưa có window nào của bạn trong 30 ngày qua
          </p>
        </CardContent>
      </Card>
    );
  }

  const opusWarn = eff.my_opus_avg > eff.my_sonnet_avg;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Hiệu suất của tôi</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">30 ngày qua · seats bạn sở hữu</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <div className="text-xl font-bold tabular-nums">{eff.my_avg_utilization}%</div>
            <div className="text-[10px] text-muted-foreground">TB sử dụng</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold tabular-nums">{eff.my_window_count}</div>
            <div className="text-[10px] text-muted-foreground">Windows</div>
          </div>
          <div className="text-center">
            <div className={`text-xl font-bold tabular-nums ${eff.my_waste_count > 0 ? "text-amber-500" : ""}`}>
              {eff.my_waste_count}
            </div>
            <div className="text-[10px] text-muted-foreground">Lãng phí</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-bold tabular-nums">
              <span>{eff.my_sonnet_avg.toFixed(1)}% </span>
              <span className="text-muted-foreground">/</span>
              <span className={opusWarn ? "text-red-500" : ""}> {eff.my_opus_avg.toFixed(1)}%</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Sonnet / Opus</div>
          </div>
        </div>

        {eff.my_top_seats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Top seats</p>
              <div className="space-y-0.5">
                {eff.my_top_seats.map((s) => <MiniRow key={s.seat_id} s={s} />)}
              </div>
            </div>
            {eff.my_bottom_seats.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1">Seats kém nhất</p>
                <div className="space-y-0.5">
                  {eff.my_bottom_seats.map((s) => <MiniRow key={s.seat_id} s={s} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
