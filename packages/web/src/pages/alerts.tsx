import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell } from "lucide-react";
import { AlertCard } from "@/components/alert-card";
import { AlertFeedFilters } from "@/components/alert-feed-filters";
import { EmptyState } from "@/components/empty-state";
import { useAlerts, useMarkAlertsRead } from "@/hooks/use-alerts";
import { useUserSettings } from "@/hooks/use-user-settings";
import type { Alert } from "@repo/shared/types";

function groupByDate(alerts: Alert[]): { label: string; alerts: Alert[] }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, Alert[]> = {};
  const order: string[] = [];

  for (const a of alerts) {
    const d = new Date(a.created_at);
    d.setHours(0, 0, 0, 0);
    const key =
      d >= today
        ? "Hôm nay"
        : d >= yesterday
          ? "Hôm qua"
          : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(a);
  }
  return order.map((label) => ({ label, alerts: groups[label] }));
}

export default function AlertsPage() {
  const [typeFilter, setTypeFilter] = useState("");
  const [seatFilter, setSeatFilter] = useState("");

  const filters = {
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(seatFilter ? { seat: seatFilter } : {}),
  };
  const { data, isLoading } = useAlerts(Object.keys(filters).length > 0 ? filters : undefined);
  const { data: settings } = useUserSettings();
  const markRead = useMarkAlertsRead();

  // Auto-mark visible alerts as read on mount
  useEffect(() => {
    if (data?.alerts?.length) {
      const unreadIds = data.alerts
        .filter((a) => !a.read_by?.includes("me")) // server handles actual user check
        .map((a) => a._id);
      if (unreadIds.length > 0) {
        markRead.mutate(unreadIds);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.alerts]);

  const groups = data?.alerts ? groupByDate(data.alerts) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Cảnh báo</h1>
        <AlertFeedFilters
          type={typeFilter}
          seat={seatFilter}
          onTypeChange={setTypeFilter}
          onSeatChange={setSeatFilter}
          seats={settings?.available_seats ?? []}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState icon={Bell} title="Không có cảnh báo" description="Hệ thống đang hoạt động bình thường" />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.label}
              </h2>
              <div className="space-y-2">
                {group.alerts.map((alert) => (
                  <AlertCard key={alert._id} alert={alert} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
