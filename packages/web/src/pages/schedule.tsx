import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { WeekNavigator } from "@/components/week-navigator";
import {
  useActivityHeatmap,
  useRealtimeStatus,
  useSeatsWithUsers,
} from "@/hooks/use-activity-schedule";
import { useAuth } from "@/hooks/use-auth";

/** Get Monday of the current week as ISO date string */
function getCurrentWeekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 mt-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-md" />
      ))}
    </div>
  );
}

export default function SchedulePage() {
  const { user } = useAuth();
  const [activeSeatId, setActiveSeatId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart);

  const { data: seatsData, isLoading: loadingSeats } = useSeatsWithUsers();
  const isCurrentWeek = weekStart === getCurrentWeekStart();
  const { data: heatmapData, isLoading: loadingHeatmap } = useActivityHeatmap(
    activeSeatId,
    1,
    weekStart,
  );
  const { data: realtimeData } = useRealtimeStatus();

  const seats = seatsData?.seats ?? [];

  // Filter seats to only those the user can view
  const visibleSeats = user?.role === "admin"
    ? seats
    : seats.filter(s => s.users.some(u => u._id === user?._id) || s.owner_id === user?._id);

  if (!activeSeatId && visibleSeats.length > 0) setActiveSeatId(visibleSeats[0]._id);

  const heatmapCells = heatmapData?.data ?? [];
  const seatStatus = realtimeData?.seats?.find(s => s.seat_id === activeSeatId);

  // Only show "now" indicator when viewing current week
  const now = new Date();
  const currentDow = isCurrentWeek ? now.getDay() : undefined;
  const currentHour = isCurrentWeek ? now.getHours() : undefined;

  const isLoading = loadingSeats || loadingHeatmap;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Hoạt động Seat</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isCurrentWeek
              ? "Theo dõi hoạt động seat tuần này · cập nhật mỗi 5 phút"
              : "Xem lại hoạt động seat tuần trước"}
          </p>
        </div>
        <WeekNavigator weekStart={weekStart} onChange={setWeekStart} />
      </div>

      {/* Staleness warning */}
      {seatStatus?.is_stale && isCurrentWeek && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
          <AlertTriangle size={14} className="shrink-0" />
          <span>Dữ liệu cũ {seatStatus.stale_minutes} phút — có thể do API bị rate limit hoặc token lỗi</span>
        </div>
      )}

      {/* Seat tabs */}
      {visibleSeats.length > 0 && (
        <Tabs value={activeSeatId ?? visibleSeats[0]?._id ?? ""} onValueChange={setActiveSeatId}>
          <TabsList className="flex-wrap h-auto">
            {visibleSeats.map((seat) => (
              <TabsTrigger key={seat._id} value={seat._id} className="text-xs">{seat.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : heatmapCells.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">
              {isCurrentWeek ? "Đang thu thập dữ liệu..." : "Không có dữ liệu tuần này"}
            </p>
            <p>
              {isCurrentWeek
                ? "Hệ thống sẽ tự động ghi nhận hoạt động seat từ dữ liệu sử dụng mỗi 5 phút."
                : "Có thể tuần này chưa có dữ liệu hoạt động được ghi nhận."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <ActivityHeatmap
            data={heatmapCells}
            currentDow={currentDow}
            currentHour={currentHour}
          />
        </div>
      )}
    </div>
  );
}
