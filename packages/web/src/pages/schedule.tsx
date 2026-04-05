import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import {
  useActivityHeatmap,
  useSchedulePatterns,
  useRealtimeStatus,
  useSeatsWithUsers,
} from "@/hooks/use-activity-schedule";
import { useAuth } from "@/hooks/use-auth";

const WEEKS_OPTIONS = [
  { value: "2", label: "2 tuần" },
  { value: "4", label: "4 tuần" },
  { value: "8", label: "8 tuần" },
  { value: "12", label: "12 tuần" },
];

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
  const [weeks, setWeeks] = useState("4");

  const { data: seatsData, isLoading: loadingSeats } = useSeatsWithUsers();
  const { data: heatmapData, isLoading: loadingHeatmap } = useActivityHeatmap(activeSeatId, Number(weeks));
  const { data: patternsData } = useSchedulePatterns(activeSeatId);
  const { data: realtimeData } = useRealtimeStatus();

  const seats = seatsData?.seats ?? [];

  // Filter seats to only those the user can view
  const visibleSeats = user?.role === "admin"
    ? seats
    : seats.filter(s => s.users.some(u => u._id === user?._id) || s.owner_id === user?._id);

  if (!activeSeatId && visibleSeats.length > 0) setActiveSeatId(visibleSeats[0]._id);

  const heatmapCells = heatmapData?.data ?? [];
  const patterns = (patternsData?.schedules ?? []).filter(s => s.source === "auto");

  // Realtime status for active seat
  const seatStatus = realtimeData?.seats?.find(s => s.seat_id === activeSeatId);

  const now = new Date();
  const currentDow = now.getDay();
  const currentHour = now.getHours();

  const isLoading = loadingSeats || loadingHeatmap;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Hoạt động Seat</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Heatmap hoạt động tự động từ dữ liệu sử dụng · click ô để xem chi tiết
          </p>
        </div>
        <div className="flex items-center gap-2">
          {seatStatus && (
            <Badge variant={seatStatus.is_active ? "default" : "secondary"} className="gap-1.5">
              {seatStatus.is_active && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
              {seatStatus.is_active ? "Đang hoạt động" : "Rảnh"}
            </Badge>
          )}
          <Select value={weeks} onValueChange={(v) => setWeeks(v ?? "4")}>
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
            <p className="text-lg font-medium">Đang thu thập dữ liệu...</p>
            <p>Hệ thống sẽ tự động ghi nhận hoạt động seat từ dữ liệu sử dụng mỗi 5 phút.</p>
            <p>Heatmap sẽ hiển thị sau khi có đủ dữ liệu.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <ActivityHeatmap
            data={heatmapCells}
            patterns={patterns}
            currentDow={currentDow}
            currentHour={currentHour}
            isCurrentlyActive={seatStatus?.is_active}
          />
        </div>
      )}

      {/* Pattern summary */}
      {patterns.length > 0 && (
        <div className="text-xs text-muted-foreground border-t pt-2">
          <span className="font-medium">Pattern dự đoán:</span>{" "}
          {patterns.length} khung giờ hoạt động thường xuyên được phát hiện
        </div>
      )}
    </div>
  );
}
