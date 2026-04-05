import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePeakHours, type DashboardRange, type PeakHourCell } from "@/hooks/use-dashboard";

const DOW_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function intensityColor(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "bg-muted/30";
  const ratio = Math.min(1, value / max);
  if (ratio < 0.15) return "bg-red-500/10";
  if (ratio < 0.3) return "bg-red-500/25";
  if (ratio < 0.5) return "bg-red-500/40";
  if (ratio < 0.7) return "bg-red-500/60";
  if (ratio < 0.85) return "bg-red-500/80";
  return "bg-red-500";
}

export function DashboardPeakHoursHeatmap({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const { data, isLoading } = usePeakHours(range, seatIds);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Giờ cao điểm</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }

  const grid = data?.grid ?? [];
  if (grid.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Giờ cao điểm</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            Chưa đủ dữ liệu để vẽ heatmap
          </p>
        </CardContent>
      </Card>
    );
  }

  // Index grid by dow+hour
  const cellMap = new Map<string, PeakHourCell>();
  let maxVal = 0;
  for (const c of grid) {
    cellMap.set(`${c.dow}-${c.hour}`, c);
    if (c.avg_delta_7d > maxVal) maxVal = c.avg_delta_7d;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Giờ cao điểm</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Mức Δ7d trung bình theo ngày trong tuần × giờ (Asia/Ho_Chi_Minh)
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="flex items-center gap-0.5 mb-1 pl-7">
              {HOURS.map((h) => (
                <div key={h} className="w-5 text-center text-[9px] text-muted-foreground">
                  {h % 3 === 0 ? h : ""}
                </div>
              ))}
            </div>
            {DOW_LABELS.map((label, dow) => (
              <div key={dow} className="flex items-center gap-0.5 mb-0.5">
                <div className="w-6 text-[10px] text-muted-foreground pr-1">{label}</div>
                {HOURS.map((h) => {
                  const cell = cellMap.get(`${dow}-${h}`);
                  const v = cell?.avg_delta_7d ?? 0;
                  const n = cell?.window_count ?? 0;
                  return (
                    <div
                      key={h}
                      className={`w-5 h-5 rounded-sm ${intensityColor(v, maxVal)}`}
                      title={`${label} ${h}h: ${v.toFixed(1)}% avg Δ7d · ${n} windows`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-muted-foreground">
          <span>thấp</span>
          <div className="w-3 h-3 rounded-sm bg-muted/30" />
          <div className="w-3 h-3 rounded-sm bg-red-500/25" />
          <div className="w-3 h-3 rounded-sm bg-red-500/60" />
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span>cao</span>
        </div>
      </CardContent>
    </Card>
  );
}
