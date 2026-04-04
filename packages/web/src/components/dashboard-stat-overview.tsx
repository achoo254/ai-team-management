import { Monitor, Users, Zap, TrendingUp, AlertTriangle, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced, type DashboardRange } from "@/hooks/use-dashboard";

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

export function DashboardStatOverview({ range }: { range: DashboardRange }) {
  const { data, isLoading } = useDashboardEnhanced(range);

  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)}
      </div>
    );
  }

  const seats = data?.usagePerSeat ?? [];
  const valid7d = seats.filter((s) => s.seven_day_pct !== null);
  const valid5h = seats.filter((s) => s.five_hour_pct !== null);
  const avg7d = valid7d.length ? Math.round(valid7d.reduce((a, s) => a + (s.seven_day_pct ?? 0), 0) / valid7d.length) : 0;
  const avg5h = valid5h.length ? Math.round(valid5h.reduce((a, s) => a + (s.five_hour_pct ?? 0), 0) / valid5h.length) : 0;
  const totalOccupancy = seats.reduce((a, s) => a + s.user_count, 0);
  const totalCapacity = seats.reduce((a, s) => a + s.max_users, 0);

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <MiniStat
        label="Seats"
        value={data?.totalSeats ?? 0}
        sub={`${totalOccupancy}/${totalCapacity} slots used`}
        icon={Monitor}
        accent="bg-info-surface text-info-text"
      />
      <MiniStat
        label="Active Users"
        value={`${data?.activeUsers ?? 0}/${data?.totalUsers ?? 0}`}
        sub="đang hoạt động"
        icon={Users}
        accent="bg-success-surface text-success-text"
      />
      <MiniStat
        label="Avg 5h Usage"
        value={`${avg5h}%`}
        sub="rolling 5-hour window"
        icon={Zap}
        accent={avg5h >= 80 ? "bg-error-surface text-error-text" : avg5h >= 50 ? "bg-warning-surface text-warning-text" : "bg-success-surface text-success-text"}
      />
      <MiniStat
        label="Avg 7d Usage"
        value={`${avg7d}%`}
        sub="rolling 7-day window"
        icon={TrendingUp}
        accent={avg7d >= 80 ? "bg-error-surface text-error-text" : avg7d >= 50 ? "bg-warning-surface text-warning-text" : "bg-success-surface text-success-text"}
      />
      <MiniStat
        label="Alerts"
        value={data?.unresolvedAlerts ?? 0}
        sub="chưa xử lý"
        icon={AlertTriangle}
        accent={data?.unresolvedAlerts ? "bg-error-surface text-error-text" : "bg-muted text-muted-foreground"}
      />
      <MiniStat
        label="Lịch hôm nay"
        value={data?.todaySchedules?.length ?? 0}
        sub="slots đã đặt"
        icon={Calendar}
        accent="bg-info-surface text-info-text"
      />
    </div>
  );
}
