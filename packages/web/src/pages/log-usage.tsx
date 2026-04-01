import { useState, useCallback } from "react";
import { Save, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WeekNavigator } from "@/components/week-navigator";
import { WeekTable } from "@/components/week-table";
import { EmptyState } from "@/components/empty-state";
import { useWeekLog, useBulkLog, getWeekStart, type UsageLogEntry } from "@/hooks/use-usage-log";
import { useAuth } from "@/hooks/use-auth";

export default function LogUsagePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const { data, isLoading } = useWeekLog(weekStart);
  const bulkLog = useBulkLog();

  // Local editable state — reset when week or server data changes
  const [local, setLocal] = useState<UsageLogEntry[]>([]);
  const entries: UsageLogEntry[] = local.length > 0 ? local : (data?.seats ?? []);

  const handleWeekChange = (w: string) => { setWeekStart(w); setLocal([]); };

  const handleChange = useCallback((seatId: string, field: "weeklyAllPct", value: number) => {
    const base = local.length > 0 ? local : (data?.seats ?? []);
    setLocal(base.map((r) => r.seatId === seatId ? { ...r, [field]: value } : r));
  }, [local, data]);

  const handleSave = () => {
    if (!entries.length) return;
    bulkLog.mutate({
      weekStart,
      entries: entries.map((r) => ({
        seatId: r.seatId,
        weeklyAllPct: r.weeklyAllPct ?? 0,
      })),
    }, { onSuccess: () => setLocal([]) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Log Usage</h1>
        {isAdmin && (
          <Button size="sm" onClick={handleSave} disabled={bulkLog.isPending || !entries.length}>
            <Save className="h-3.5 w-3.5 mr-1" />{bulkLog.isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        )}
      </div>

      <WeekNavigator weekStart={weekStart} onChange={handleWeekChange} />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !entries.length ? (
        <EmptyState icon={BarChart2} title="Không có dữ liệu" description="Chưa có seat nào trong tuần này" />
      ) : (
        <WeekTable entries={entries} isAdmin={isAdmin} onChange={handleChange} />
      )}
    </div>
  );
}
