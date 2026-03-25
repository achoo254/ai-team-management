"use client";

import { Monitor, Users, BarChart3, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced } from "@/hooks/use-dashboard";

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-32 mt-1" />
      </CardContent>
    </Card>
  );
}

export function StatCards() {
  const { data, isLoading } = useDashboardEnhanced();

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
    );
  }

  const avgUsage = data?.usagePerSeat?.length
    ? Math.round(data.usagePerSeat.reduce((s, x) => s + x.all_pct, 0) / data.usagePerSeat.length)
    : 0;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Seats"
        value={data?.totalSeats ?? 0}
        icon={Monitor}
        iconColor="text-blue-500"
      />
      <StatCard
        title="Active Users"
        value={`${data?.activeUsers ?? 0} / ${data?.totalUsers ?? 0}`}
        subtitle="đang hoạt động"
        icon={Users}
        iconColor="text-green-500"
      />
      <StatCard
        title="Avg Usage"
        value={`${avgUsage}%`}
        subtitle="trung bình tất cả seat"
        icon={BarChart3}
        iconColor="text-teal-500"
      />
      <StatCard
        title="Alerts"
        value={data?.unresolvedAlerts ?? 0}
        subtitle="chưa xử lý"
        icon={AlertTriangle}
        iconColor={data?.unresolvedAlerts ? "text-red-500" : "text-muted-foreground"}
      />
    </div>
  );
}
