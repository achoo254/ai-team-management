import { Monitor, Users, Zap, TrendingUp, AlertTriangle, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced, type DashboardRange } from "@/hooks/use-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { useCardSeatOverride } from "@/hooks/use-card-seat-override";
import { DashboardSeatFilter } from "@/components/dashboard-seat-filter";
import { formatResetTime } from "@/lib/format-reset";

function soonestIso(values: (string | null)[]): string | null {
  const times = values
    .filter((v): v is string => !!v)
    .map((v) => new Date(v).getTime())
    .filter((t) => !Number.isNaN(t));
  if (times.length === 0) return null;
  return new Date(Math.min(...times)).toISOString();
}

interface MiniStatProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}

function MiniStat({ label, value, sub, icon: Icon, accent }: MiniStatProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
            <p className="text-2xl font-bold tracking-tight mt-0.5">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
          </div>
          <div className={`shrink-0 rounded-lg p-2 ${accent}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-7 w-14" />
        <Skeleton className="h-3 w-28 mt-1" />
      </CardContent>
    </Card>
  );
}

export function DashboardStatOverview({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const filter = useCardSeatOverride(seatIds);
  const { data, isLoading } = useDashboardEnhanced(range, filter.effective);
  const { user } = useAuth();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-end">
          <DashboardSeatFilter compact value={filter.effective} onChange={filter.setOverride} isOverride={filter.isOverride} onReset={filter.resetToGlobal} />
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const seats = data?.usagePerSeat ?? [];
  const valid7d = seats.filter((s) => s.seven_day_pct !== null);
  const valid5h = seats.filter((s) => s.five_hour_pct !== null);
  const avg7d = valid7d.length ? Math.round(valid7d.reduce((a, s) => a + (s.seven_day_pct ?? 0), 0) / valid7d.length) : 0;
  const avg5h = valid5h.length ? Math.round(valid5h.reduce((a, s) => a + (s.five_hour_pct ?? 0), 0) / valid5h.length) : 0;
  const soonest5h = soonestIso(seats.map((s) => s.five_hour_resets_at));
  const soonest7d = soonestIso(seats.map((s) => s.seven_day_resets_at));
  const sub5h = soonest5h ? `Reset sớm nhất: ${formatResetTime(soonest5h).label}` : "chu kỳ cuốn chiếu 5 giờ";
  const sub7d = soonest7d ? `Reset sớm nhất: ${formatResetTime(soonest7d).label}` : "chu kỳ cuốn chiếu 7 ngày";
  const totalOccupancy = seats.reduce((a, s) => a + s.user_count, 0);
  const totalCapacity = seats.reduce((a, s) => a + s.max_users, 0);

  const tokenIssueCount = data?.tokenIssueCount ?? 0;
  const fullSeatCount = data?.fullSeatCount ?? 0;

  // Build seats sub text: slot occupancy + "X full" if any seats are full
  const seatsSub = fullSeatCount > 0
    ? `${totalOccupancy}/${totalCapacity} slot · ${fullSeatCount} full`
    : `${totalOccupancy}/${totalCapacity} slot đã dùng`;

  return (
    <div className="space-y-2">
      {/* Token health warning — admin only */}
      {user?.role === "admin" && tokenIssueCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-xs">
            {tokenIssueCount} seat{tokenIssueCount > 1 ? "s" : ""} có vấn đề token
          </Badge>
          <span className="text-xs text-muted-foreground">Kiểm tra lại OAuth credentials</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tổng quan hiện tại
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/70 italic hidden sm:inline">
            Không chịu ảnh hưởng bởi filter thời gian
          </span>
          <DashboardSeatFilter compact value={filter.effective} onChange={filter.setOverride} isOverride={filter.isOverride} onReset={filter.resetToGlobal} />
        </div>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <MiniStat
        label="Seats"
        value={data?.totalSeats ?? 0}
        sub={seatsSub}
        icon={Monitor}
        accent="bg-info-surface text-info-text"
      />
      <MiniStat
        label="Người dùng"
        value={`${data?.activeUsers ?? 0}/${data?.totalUsers ?? 0}`}
        sub="đang hoạt động"
        icon={Users}
        accent="bg-success-surface text-success-text"
      />
      <MiniStat
        label="TB sử dụng 5h"
        value={`${avg5h}%`}
        sub={sub5h}
        icon={Zap}
        accent={avg5h >= 80 ? "bg-success-surface text-success-text" : avg5h >= 50 ? "bg-info-surface text-info-text" : avg5h >= 20 ? "bg-warning-surface text-warning-text" : "bg-error-surface text-error-text"}
      />
      <MiniStat
        label="TB sử dụng 7 ngày"
        value={`${avg7d}%`}
        sub={sub7d}
        icon={TrendingUp}
        accent={avg7d >= 80 ? "bg-warning-surface text-warning-text" : avg7d >= 50 ? "bg-info-surface text-info-text" : "bg-success-surface text-success-text"}
      />
      <MiniStat
        label="Cảnh báo"
        value={data?.unreadAlerts ?? 0}
        sub="chưa đọc"
        icon={AlertTriangle}
        accent={data?.unreadAlerts ? "bg-error-surface text-error-text" : "bg-muted text-muted-foreground"}
      />
      <MiniStat
        label="Lịch hôm nay"
        value={data?.todaySchedules?.length ?? 0}
        sub="slots đã đặt"
        icon={Calendar}
        accent="bg-info-surface text-info-text"
      />
      </div>
    </div>
  );
}
