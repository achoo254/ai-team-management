import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScheduleGrid } from "@/components/schedule-grid";
import { MemberSidebar } from "@/components/member-sidebar";
import { DayTabView } from "@/components/day-tab-view";
import {
  useSchedules,
  useSeatsWithUsers,
  useAssignSchedule,
  useSwapSchedule,
  useDeleteEntry,
  useClearAll,
} from "@/hooks/use-schedules";
import { useAuth } from "@/hooks/use-auth";

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
  const isAdmin = user?.role === "admin";
  const [confirmClear, setConfirmClear] = useState(false);

  const { data: schedulesData, isLoading: loadingSchedules } = useSchedules();
  const { data: seatsData, isLoading: loadingSeats } = useSeatsWithUsers();

  const assignMutation = useAssignSchedule();
  const swapMutation = useSwapSchedule();
  const deleteMutation = useDeleteEntry();
  const clearMutation = useClearAll();

  const schedules = schedulesData?.schedules ?? [];
  const seats = seatsData?.seats ?? [];
  const isLoading = loadingSchedules || loadingSeats;

  function handleAssign(seatId: string, userId: string, dayOfWeek: number, slot: string) {
    assignMutation.mutate({ seatId, userId, dayOfWeek, slot });
  }

  function handleSwap(
    from: { seatId: string; dayOfWeek: number; slot: string },
    to: { seatId: string; dayOfWeek: number; slot: string },
  ) {
    swapMutation.mutate({ from, to });
  }

  function handleDelete(seatId: string, dayOfWeek: number, slot: string) {
    deleteMutation.mutate({ seatId, dayOfWeek, slot });
  }

  function handleClearAll() {
    clearMutation.mutate(undefined, { onSuccess: () => setConfirmClear(false) });
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lịch phân ca</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kéo thả thành viên vào ô để phân ca (T2–T6)</p>
        </div>
        {isAdmin && (
          <Button variant="destructive" size="sm" onClick={() => setConfirmClear(true)}
            className="gap-1.5" disabled={clearMutation.isPending}>
            <Trash2 size={14} />
            Xoá tất cả
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Desktop grid */}
          <div className="flex-1 overflow-auto hidden lg:block">
            <ScheduleGrid
              schedules={schedules}
              seats={seats}
              isAdmin={isAdmin}
              onAssign={handleAssign}
              onSwap={handleSwap}
              onDelete={handleDelete}
            />
          </div>

          {/* Desktop sidebar */}
          <MemberSidebar seats={seats} isAdmin={isAdmin} />

          {/* Mobile tab view */}
          <div className="flex-1 lg:hidden">
            <DayTabView
              schedules={schedules}
              seats={seats}
              isAdmin={isAdmin}
              onAssign={handleAssign}
              onDelete={handleDelete}
            />
          </div>
        </div>
      )}

      {/* Confirm clear dialog */}
      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xoá toàn bộ lịch?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Hành động này sẽ xoá tất cả phân ca hiện tại. Không thể hoàn tác.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmClear(false)}>Huỷ</Button>
            <Button variant="destructive" onClick={handleClearAll} disabled={clearMutation.isPending}>
              {clearMutation.isPending ? "Đang xoá..." : "Xoá tất cả"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
