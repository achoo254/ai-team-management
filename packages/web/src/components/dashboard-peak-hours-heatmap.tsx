import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePeakHours, type DashboardRange, type PeakHourCell } from "@/hooks/use-dashboard";
import { useCardSeatOverride } from "@/hooks/use-card-seat-override";
import { DashboardSeatFilter } from "@/components/dashboard-seat-filter";

const DOW_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const RANGE_DAYS_LABEL: Record<DashboardRange, string> = {
  day: "1 ngày",
  week: "7 ngày",
  month: "30 ngày",
  "3month": "90 ngày",
  "6month": "180 ngày",
};

// Fixed 0-100% scale: green = good utilization. High activity = desirable (maximizing subscription).
function intensityColor(avgUtil: number): string {
  if (avgUtil <= 0) return "bg-muted/30";
  if (avgUtil < 20) return "bg-emerald-500/10";
  if (avgUtil < 40) return "bg-emerald-500/25";
  if (avgUtil < 60) return "bg-emerald-500/40";
  if (avgUtil < 75) return "bg-emerald-500/60";
  if (avgUtil < 90) return "bg-emerald-500/80";
  return "bg-emerald-500";
}

export function DashboardPeakHoursHeatmap({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const filter = useCardSeatOverride(seatIds);
  const { data, isLoading } = usePeakHours(range, filter.effective);
  const filterBtn = <DashboardSeatFilter compact value={filter.effective} onChange={filter.setOverride} isOverride={filter.isOverride} onReset={filter.resetToGlobal} />;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Giờ cao điểm</CardTitle>
            {filterBtn}
          </div>
        </CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }

  const grid = data?.grid ?? [];
  if (grid.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Giờ cao điểm</CardTitle>
            {filterBtn}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            {filter.isOverride ? "Không có dữ liệu cho filter hiện tại" : "Chưa đủ dữ liệu để vẽ heatmap"}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Index grid by dow+hour
  const cellMap = new Map<string, PeakHourCell>();
  for (const c of grid) {
    cellMap.set(`${c.dow}-${c.hour}`, c);
  }

  // "Now" marker in Asia/Ho_Chi_Minh — distinguishes live cell from historical aggregates
  const nowVN = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const nowDow = nowVN.getDay();
  const nowHour = nowVN.getHours();

  // A cell is "historical-only" when its (dow, hour) hasn't happened yet in the current week
  // (for today's row: future hours; for future weekdays: entire row).
  // These cells show aggregate from prior weeks only — dim them so users don't read them as "now/future live".
  const isHistoricalOnly = (dow: number, h: number): boolean => {
    if (dow === nowDow) return h > nowHour; // today's future hours
    // Week starts Sunday (0); a "future" weekday is one that hasn't arrived yet this week
    const daysUntilDow = (dow - nowDow + 7) % 7;
    return daysUntilDow > 0; // dow after today in this week → hasn't happened this week
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">Giờ cao điểm</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mẫu sử dụng theo tuần — trung bình {RANGE_DAYS_LABEL[range]} gần nhất (Asia/Ho_Chi_Minh)
            </p>
          </div>
          {filterBtn}
        </div>
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
            {DOW_LABELS.map((label, dow) => {
              const isToday = dow === nowDow;
              return (
                <div key={dow} className="flex items-center gap-0.5 mb-0.5">
                  <div className={`w-6 text-[10px] pr-1 ${isToday ? "text-sky-400 font-semibold" : "text-muted-foreground"}`}>
                    {label}
                  </div>
                  {HOURS.map((h) => {
                    const cell = cellMap.get(`${dow}-${h}`);
                    const avg = cell?.avg_util ?? 0;
                    const max = cell?.max_util ?? 0;
                    const n = cell?.window_count ?? 0;
                    const isNow = isToday && h === nowHour;
                    const historicalOnly = isHistoricalOnly(dow, h);
                    const ring = isNow ? "ring-2 ring-sky-400 ring-offset-1 ring-offset-background" : "";
                    const dim = historicalOnly ? "opacity-40" : "";
                    const note = isNow
                      ? " · 🔵 bây giờ"
                      : historicalOnly
                      ? " · (chỉ tính các tuần trước)"
                      : "";
                    return (
                      <div
                        key={h}
                        className={`w-5 h-5 rounded-sm ${intensityColor(avg)} ${ring} ${dim}`}
                        title={`${label} ${h}h: TB ${avg.toFixed(1)}% / Peak ${max.toFixed(1)}% · ${n} sessions${note}`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-emerald-500/60 ring-2 ring-sky-400 ring-offset-1 ring-offset-background" />
              <span>bây giờ</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-emerald-500/60 opacity-40" />
              <span>tuần này chưa tới</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span>0%</span>
            <div className="w-3 h-3 rounded-sm bg-muted/30" />
            <div className="w-3 h-3 rounded-sm bg-red-500/25" />
            <div className="w-3 h-3 rounded-sm bg-emerald-500/60" />
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span>100%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
