"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell } from "lucide-react";
import { AlertCard } from "@/components/alerts/alert-card";
import { EmptyState } from "@/components/shared/empty-state";
import { useAlerts, useResolveAlert } from "@/hooks/use-alerts";
import { useAuth } from "@/hooks/use-auth";

function AlertList({ resolved, isAdmin }: { resolved?: 0 | 1; isAdmin: boolean }) {
  const { data, isLoading } = useAlerts(resolved);
  const resolve = useResolveAlert();

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  if (!data?.alerts.length) return <EmptyState icon={Bell} title="Không có cảnh báo nào" />;

  return (
    <div className="space-y-2">
      {data.alerts.map((alert) => (
        <AlertCard key={alert._id} alert={alert} isAdmin={isAdmin}
          onResolve={(id) => resolve.mutate(id)} resolving={resolve.isPending} />
      ))}
    </div>
  );
}

export default function AlertsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cảnh báo</h1>
      <Tabs defaultValue="unresolved">
        <TabsList>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="unresolved">Chưa xử lý</TabsTrigger>
          <TabsTrigger value="resolved">Đã xử lý</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4"><AlertList isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="unresolved" className="mt-4"><AlertList resolved={0} isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="resolved" className="mt-4"><AlertList resolved={1} isAdmin={isAdmin} /></TabsContent>
      </Tabs>
    </div>
  );
}
