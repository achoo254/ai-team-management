import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { Plus, Monitor, Key, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SeatCard } from "@/components/seat-card";
import { SeatFormDialog, type SeatFormSubmit } from "@/components/seat-form-dialog";
import { SeatTokenDialog } from "@/components/seat-token-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ExportCredentialDialog } from "@/components/export-credential-dialog";
import { EmptyState } from "@/components/empty-state";
import { useSeats, useCreateSeat, useUpdateSeat, useDeleteSeat, useAssignUser, useUnassignUser, useTransferOwnership, useAvailableUsers, exportSeatCredential, type Seat } from "@/hooks/use-seats";
import { useAdminUsers } from "@/hooks/use-admin";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Seat as SharedSeat } from "@repo/shared";

export default function SeatsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightSeatId = searchParams.get("seat");
  const highlightRef = useRef<HTMLDivElement>(null);
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
  const [tokenSeat, setTokenSeat] = useState<SharedSeat | null>(null);
  const [exportingSeat, setExportingSeat] = useState<Seat | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const handleExportConfirm = async () => {
    if (!exportingSeat) return;
    setExportLoading(true);
    try {
      await exportSeatCredential(exportingSeat._id, exportingSeat.label);
      toast.success(`Đã export credential cho ${exportingSeat.label}`);
      setExportingSeat(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export thất bại");
    } finally {
      setExportLoading(false);
    }
  };

  const handleSubmit = (p: SeatFormSubmit) => {
    const mut = p.mode === "edit" && editing
      ? updateSeat.mutateAsync({ id: editing._id, ...p.data })
      : createSeat.mutateAsync(p.data as Parameters<typeof createSeat.mutateAsync>[0]);
    mut.then(() => { setFormOpen(false); setEditing(null); }).catch(() => {});
  };

  const handleEdit = (seat: Seat) => { setEditing(seat); setFormOpen(true); };
  const handleDelete = () => { if (deleting) deleteSeat.mutate(deleting._id, { onSuccess: () => setDeleting(null) }); };
  const handleTransfer = (seatId: string, newOwnerId: string) => {
    transfer.mutate({ seatId, newOwnerId });
  };

  // Group seats by ownership relationship
  const seats = data?.seats ?? [];
  const manageableSeats = seats.filter(s => isAdmin || s.owner_id === user?._id);
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

  // Scroll to highlighted seat on mount
  useEffect(() => {
    if (highlightSeatId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightSeatId, data]);

  const renderSection = (title: string, sectionSeats: Seat[]) => {
    if (sectionSeats.length === 0) return null;
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-muted-foreground">{title}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sectionSeats.map((seat) => {
            const isHighlighted = seat._id === highlightSeatId;
            return (
              <div key={seat._id} ref={isHighlighted ? highlightRef : undefined}
                className={isHighlighted ? 'rounded-lg ring-2 ring-primary' : ''}>
                <SeatCard seat={seat} isAdmin={isAdmin}
                  currentUserId={user?._id ?? ""}
                  canManage={canManage(seat)}
                  allUsers={allUsers}
                  onEdit={handleEdit} onDelete={setDeleting}
                  onAssign={(seatId, userId) => assign.mutate({ seatId, userId })}
                  onUnassign={(seatId, userId) => unassign.mutate({ seatId, userId })}
                  onExportCredential={() => setExportingSeat(seat)}
                  onTransfer={isAdmin ? handleTransfer : undefined} />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Quản lý Seats</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Thêm Seat</Button>
      </div>

      {/* Token management — quick access for owner/admin */}
      {manageableSeats.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Quản lý Token</h2>
          <div className="flex flex-wrap gap-2">
            {manageableSeats.map((seat) => {
              const hasError = !!seat.last_fetch_error;
              return (
                <Button
                  key={seat._id}
                  variant="outline"
                  size="sm"
                  className={`gap-2 ${hasError ? "border-destructive/60 bg-destructive/5 hover:bg-destructive/10" : ""}`}
                  onClick={() => setTokenSeat(seat as unknown as SharedSeat)}
                  title={hasError ? `Token lỗi: ${seat.last_fetch_error}` : undefined}
                >
                  <Key className="h-3 w-3" />
                  {seat.label}
                  {hasError ? (
                    <Badge variant="destructive" className="gap-1 text-[10px] px-1">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Token invalid
                    </Badge>
                  ) : (
                    <Badge
                      variant={seat.has_token ? "default" : "secondary"}
                      className="text-[10px] px-1"
                    >
                      {seat.has_token ? "OK" : "No token"}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      )}

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

      <SeatTokenDialog
        seat={tokenSeat}
        open={tokenSeat !== null}
        onOpenChange={(open) => { if (!open) setTokenSeat(null); }}
      />

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete}
        loading={deleteSeat.isPending} title="Xoá Seat"
        description={`Bạn có chắc muốn xoá seat "${deleting?.label}"?`} />

      <ExportCredentialDialog
        open={!!exportingSeat}
        seatLabel={exportingSeat?.label ?? ""}
        loading={exportLoading}
        onClose={() => setExportingSeat(null)}
        onConfirm={handleExportConfirm}
      />
    </div>
  );
}
