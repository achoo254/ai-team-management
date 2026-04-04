import { useState } from "react";
import { Plus, Monitor, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SeatCard } from "@/components/seat-card";
import { SeatFormDialog } from "@/components/seat-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { useSeats, useCreateSeat, useUpdateSeat, useDeleteSeat, useAssignUser, useUnassignUser, useTransferOwnership, useAvailableUsers, exportCredentials, exportSeatCredential, type Seat } from "@/hooks/use-seats";
import { useAdminUsers } from "@/hooks/use-admin";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export default function SeatsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading } = useSeats();
  const createSeat = useCreateSeat();
  const updateSeat = useUpdateSeat();
  const deleteSeat = useDeleteSeat();
  const assign = useAssignUser();
  const unassign = useUnassignUser();
  const transfer = useTransferOwnership();
  const { data: adminData } = useAdminUsers();
  const { data: availableUsersData } = useAvailableUsers();
  // Non-admin uses available-users endpoint; admin uses admin endpoint (has more fields)
  const allUsers = (isAdmin ? adminData?.users : availableUsersData?.users) ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Seat | null>(null);
  const [deleting, setDeleting] = useState<Seat | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!window.confirm("Export tất cả credentials (chứa access_token & refresh_token đã giải mã).\nLưu file an toàn. Tiếp tục?")) return;
    setExporting(true);
    try {
      await exportCredentials();
      toast.success("Đã export credentials");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export thất bại");
    } finally {
      setExporting(false);
    }
  };

  const handleExportSingle = async (seat: Seat) => {
    try {
      await exportSeatCredential(seat._id, seat.label);
      toast.success(`Đã export credential cho ${seat.label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export thất bại");
    }
  };

  const handleSubmit = (body: Omit<Seat, "_id" | "users">) => {
    const mut = editing
      ? updateSeat.mutateAsync({ id: editing._id, ...body })
      : createSeat.mutateAsync(body);
    mut.then(() => { setFormOpen(false); setEditing(null); });
  };

  const handleEdit = (seat: Seat) => { setEditing(seat); setFormOpen(true); };
  const handleDelete = () => { if (deleting) deleteSeat.mutate(deleting._id, { onSuccess: () => setDeleting(null) }); };
  const handleTransfer = (seatId: string, newOwnerId: string) => {
    transfer.mutate({ seatId, newOwnerId });
  };

  // Group seats by ownership relationship
  const seats = data?.seats ?? [];
  const mySeats = seats.filter(s => s.owner_id === user?._id);
  const assignedSeats = seats.filter(s =>
    s.owner_id !== user?._id &&
    s.users?.some(u => u.id === user?._id)
  );
  const otherSeats = seats.filter(s =>
    s.owner_id !== user?._id &&
    !s.users?.some(u => u.id === user?._id)
  );

  const canManage = (seat: Seat) => isAdmin || seat.owner_id === user?._id;

  const renderSection = (title: string, sectionSeats: Seat[]) => {
    if (sectionSeats.length === 0) return null;
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-muted-foreground">{title}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sectionSeats.map((seat) => (
            <SeatCard key={seat._id} seat={seat} isAdmin={isAdmin}
              currentUserId={user?._id ?? ""}
              canManage={canManage(seat)}
              allUsers={allUsers}
              onEdit={handleEdit} onDelete={setDeleting}
              onAssign={(seatId, userId) => assign.mutate({ seatId, userId })}
              onUnassign={(seatId, userId) => unassign.mutate({ seatId, userId })}
              onExportCredential={() => handleExportSingle(seat)}
              onTransfer={isAdmin ? handleTransfer : undefined} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Quản lý Seats</h1>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />{exporting ? "Đang export..." : "Export All"}
            </Button>
          )}
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Thêm Seat</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : !seats.length ? (
        <EmptyState icon={Monitor} title="Chưa có seat nào" description="Thêm seat để bắt đầu quản lý" />
      ) : (
        <div className="space-y-6">
          {renderSection("Seats của tôi", mySeats)}
          {renderSection("Seats được gán", assignedSeats)}
          {renderSection("Seats khác", otherSeats)}
        </div>
      )}

      <SeatFormDialog open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={handleSubmit} loading={createSeat.isPending || updateSeat.isPending} initial={editing} />

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete}
        loading={deleteSeat.isPending} title="Xoá Seat"
        description={`Bạn có chắc muốn xoá seat "${deleting?.label}"?`} />
    </div>
  );
}
