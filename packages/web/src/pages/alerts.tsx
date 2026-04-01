import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell } from "lucide-react";
import { AlertCard } from "@/components/alert-card";
import { EmptyState } from "@/components/empty-state";
import { useAlerts, useResolveAlert } from "@/hooks/use-alerts";
import { useAuth } from "@/hooks/use-auth";

function AlertList({ resolved, isAdmin }: { resolved?: 0 | 1; isAdmin: boolean }) {
  const { data, isLoading } = useAlerts(resolved);
  const resolve = useResolveAlert();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  if (!data?.alerts.length) {
    return <EmptyState icon={Bell} title="Không có cảnh báo" description="Hệ thống đang hoạt động bình thường" />;
  }

  return (
    <div className="space-y-2">
      {data.alerts.map((alert) => (
        <AlertCard key={alert._id} alert={alert} isAdmin={isAdmin}
          onResolve={(id) => resolve.mutate(id)} resolving={resolve.isPending} />
      ))}
    </div>
  );
}

function TabLabel({ label, count }: { label: string; count?: number }) {
  return (
    <span className="flex items-center gap-1.5">
      {label}
      {count !== undefined && count > 0 && (
        <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] font-medium rounded-full">
          {count}
        </Badge>
      )}
    </span>
  );
}

export default function AlertsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Fetch counts for tab badges
  const { data: allData } = useAlerts();
  const { data: unresolvedData } = useAlerts(0);
  const unresolvedCount = unresolvedData?.alerts.length ?? 0;
  const totalCount = allData?.alerts.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Cảnh báo</h1>
      </div>

      <Tabs defaultValue="unresolved">
        <TabsList variant="line" className="border-b border-border pb-0">
          <TabsTrigger value="all"><TabLabel label="Tất cả" count={totalCount} /></TabsTrigger>
          <TabsTrigger value="unresolved"><TabLabel label="Chưa xử lý" count={unresolvedCount} /></TabsTrigger>
          <TabsTrigger value="resolved">Đã xử lý</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4"><AlertList isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="unresolved" className="mt-4"><AlertList resolved={0} isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="resolved" className="mt-4"><AlertList resolved={1} isAdmin={isAdmin} /></TabsContent>
      </Tabs>
    </div>
  );
}
