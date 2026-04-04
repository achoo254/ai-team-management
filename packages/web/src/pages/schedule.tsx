import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScheduleGrid } from "@/components/schedule-grid";
import { DayTabView } from "@/components/day-tab-view";
import {
  useSchedules,
  useSeatsWithUsers,
  useCreateScheduleEntry,
  useUpdateScheduleEntry,
  useDeleteEntry,
  useClearAll,
  type ScheduleEntry,
} from "@/hooks/use-schedules";
import { useAuth } from "@/hooks/use-auth";

interface EntryForm {
  dayOfWeek: number;
  startHour: number;
  endHour: number;
  userId: string;
  usageBudgetPct: string;
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
  const isAdmin = user?.role === "admin";
  const [activeSeatId, setActiveSeatId] = useState<string | null>(null);
  const [showWeekend, setShowWeekend] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [draggedEntry, setDraggedEntry] = useState<ScheduleEntry | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<EntryForm>({
    dayOfWeek: 1, startHour: 8, endHour: 12, userId: "", usageBudgetPct: "",
  });

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EntryForm>({
    dayOfWeek: 1, startHour: 8, endHour: 12, userId: "", usageBudgetPct: "",
  });

  const { data: schedulesData, isLoading: loadingSchedules } = useSchedules();
  const { data: seatsData, isLoading: loadingSeats } = useSeatsWithUsers();

  const createMutation = useCreateScheduleEntry();
  const updateMutation = useUpdateScheduleEntry();
  const deleteMutation = useDeleteEntry();
  const clearMutation = useClearAll();

  const schedules = schedulesData?.schedules ?? [];
  const seats = seatsData?.seats ?? [];
  const isLoading = loadingSchedules || loadingSeats;

  if (!activeSeatId && seats.length > 0) setActiveSeatId(seats[0]._id);

  const activeSeat = seats.find((s) => s._id === activeSeatId);
  const seatUsers = activeSeat?.users ?? [];

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
  );

  // --- Handlers ---

  function handleClickSlot(dayOfWeek: number, hour: number) {
    setCreateForm({ dayOfWeek, startHour: hour, endHour: Math.min(hour + 4, 24), userId: "", usageBudgetPct: "" });
    setCreateOpen(true);
  }

  function handleCreate() {
    if (!activeSeatId || !createForm.userId) return;
    createMutation.mutate({
      seatId: activeSeatId,
      userId: createForm.userId,
      dayOfWeek: createForm.dayOfWeek,
      startHour: Number(createForm.startHour),
      endHour: Number(createForm.endHour),
      usageBudgetPct: createForm.usageBudgetPct ? Number(createForm.usageBudgetPct) : null,
    }, { onSuccess: () => setCreateOpen(false) });
  }

  function handleEdit(entry: ScheduleEntry) {
    setEditingId(entry._id);
    setEditForm({
      dayOfWeek: entry.day_of_week,
      startHour: entry.start_hour,
      endHour: entry.end_hour,
      userId: entry.user_id,
      usageBudgetPct: entry.usage_budget_pct != null ? String(entry.usage_budget_pct) : "",
    });
    setEditOpen(true);
  }

  function handleEditSave() {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      dayOfWeek: Number(editForm.dayOfWeek),
      startHour: Number(editForm.startHour),
      endHour: Number(editForm.endHour),
      usageBudgetPct: editForm.usageBudgetPct ? Number(editForm.usageBudgetPct) : null,
    }, { onSuccess: () => setEditOpen(false) });
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id);
  }

  function handleResize(entryId: string, newEndHour: number) {
    updateMutation.mutate({ id: entryId, endHour: newEndHour });
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedEntry(null);
    const { active, over } = event;
    if (!over) return;

    const entryData = active.data.current as { type: string; entry: ScheduleEntry } | undefined;
    const slotData = over.data.current as { type: string; dayOfWeek: number; hour: number } | undefined;
    if (!entryData || entryData.type !== "schedule-entry" || !slotData || slotData.type !== "hour-slot") return;

    const entry = entryData.entry;
    const span = entry.end_hour - entry.start_hour;
    const newStart = slotData.hour;
    const newEnd = Math.min(newStart + span, 24);

    // Skip if same position
    if (newStart === entry.start_hour && slotData.dayOfWeek === entry.day_of_week) return;

    updateMutation.mutate({
      id: entry._id,
      dayOfWeek: slotData.dayOfWeek,
      startHour: newStart,
      endHour: newEnd,
    });
  }

  function handleClearAll() {
    clearMutation.mutate(undefined, { onSuccess: () => setConfirmClear(false) });
  }

  const DAY_LABELS: Record<number, string> = { 0: "CN", 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7" };
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  // Shared form renderer
  function renderEntryForm(form: EntryForm, setForm: (f: EntryForm) => void, showUser: boolean) {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Ngày</Label>
          <Select value={String(form.dayOfWeek)} onValueChange={(v) => setForm({ ...form, dayOfWeek: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(DAY_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Giờ bắt đầu</Label>
            <Select value={String(form.startHour)} onValueChange={(v) => setForm({ ...form, startHour: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Giờ kết thúc</Label>
            <Select value={String(form.endHour)} onValueChange={(v) => setForm({ ...form, endHour: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOURS.filter((h) => h > form.startHour).map((h) => (
                  <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {showUser && (
          <div>
            <Label className="text-xs">Thành viên</Label>
            <Select value={form.userId} onValueChange={(v) => setForm({ ...form, userId: v ?? "" })}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn thành viên">
                  {form.userId
                    ? seatUsers.find((u) => u._id === form.userId)?.email
                      || seatUsers.find((u) => u._id === form.userId)?.name
                      || form.userId
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {seatUsers.map((u) => (
                  <SelectItem key={u._id} value={u._id}>{u.name} ({u.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label className="text-xs">Session Limit % (tuỳ chọn)</Label>
          <Input
            type="number" min={1} max={100} placeholder="Giới hạn % cửa sổ 5h"
            value={form.usageBudgetPct}
            onChange={(e) => setForm({ ...form, usageBudgetPct: e.target.value })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Lịch phân ca</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kéo thả để di chuyển · kéo cạnh dưới để co giãn · click ô trống để tạo mới
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button size="sm" onClick={() => {
                setCreateForm({ dayOfWeek: 1, startHour: 8, endHour: 12, userId: "", usageBudgetPct: "" });
                setCreateOpen(true);
              }}>
                + Tạo lịch
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirmClear(true)}
                className="gap-1.5" disabled={clearMutation.isPending}>
                <Trash2 size={14} />
                Xoá tất cả
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Seat tabs */}
      {seats.length > 0 && (
        <Tabs value={activeSeatId ?? seats[0]?._id ?? ""} onValueChange={setActiveSeatId}>
          <TabsList className="flex-wrap h-auto">
            {seats.map((seat) => (
              <TabsTrigger key={seat._id} value={seat._id} className="text-xs">{seat.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Weekday/Weekend toggle */}
      <div className="flex items-center gap-2">
        <Button variant={showWeekend ? "outline" : "default"} size="sm" onClick={() => setShowWeekend(false)}>T2–T6</Button>
        <Button variant={showWeekend ? "default" : "outline"} size="sm" onClick={() => setShowWeekend(true)}>T7–CN</Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e: { active: { data: { current: Record<string, unknown> | undefined } } }) => {
            const data = e.active.data.current as { entry?: ScheduleEntry } | undefined;
            setDraggedEntry(data?.entry ?? null);
          }}
          onDragEnd={handleDragEnd}
        >
          {/* Desktop grid */}
          <div className="flex-1 overflow-auto hidden lg:block">
            <ScheduleGrid
              schedules={schedules}
              seats={seats}
              activeSeatId={activeSeatId}
              isAdmin={isAdmin}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onResize={handleResize}
              onClickSlot={handleClickSlot}
              showWeekend={showWeekend}
            />
          </div>

          {/* Mobile tab view */}
          <div className="flex-1 lg:hidden">
            <DayTabView
              schedules={schedules.filter((s) => s.seat_id === activeSeatId)}
              seats={seats}
              isAdmin={isAdmin}
              onDelete={handleDelete}
              onClickSlot={handleClickSlot}
              showWeekend={showWeekend}
            />
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {draggedEntry && (
              <Badge className="shadow-lg text-sm px-3 py-1 bg-primary text-primary-foreground">
                {draggedEntry.user_name} · {String(draggedEntry.start_hour).padStart(2, "0")}–{String(draggedEntry.end_hour).padStart(2, "0")}h
              </Badge>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create entry dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Tạo lịch phân ca</DialogTitle></DialogHeader>
          {renderEntryForm(createForm, setCreateForm, true)}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Huỷ</Button>
            <Button onClick={handleCreate} disabled={!createForm.userId || createMutation.isPending}>
              {createMutation.isPending ? "Đang tạo..." : "Tạo lịch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit entry dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Chỉnh sửa lịch</DialogTitle></DialogHeader>
          {renderEntryForm(editForm, setEditForm, false)}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Huỷ</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm clear dialog */}
      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Xoá toàn bộ lịch?</DialogTitle></DialogHeader>
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
