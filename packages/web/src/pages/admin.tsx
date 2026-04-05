import { useState, useCallback } from "react";
import { Plus, Users, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserTable } from "@/components/user-table";
import { UserFormDialog } from "@/components/user-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import {
  useAdminUsers, useCreateUser, useUpdateUser, useDeleteUser,
  useBulkActive, useCheckAlerts,
  type AdminUser,
} from "@/hooks/use-admin";
import { useAuth } from "@/hooks/use-auth";

export default function AdminPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading } = useAdminUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const bulkActive = useBulkActive();
  const checkAlerts = useCheckAlerts();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  const handleSubmit = useCallback((body: Partial<AdminUser> & { seat_ids?: string[] }) => {
    const mut = editing
      ? updateUser.mutateAsync({ id: editing.id, ...body })
      : createUser.mutateAsync(body as Parameters<typeof createUser.mutateAsync>[0]);
    mut.then(() => { setFormOpen(false); setEditing(null); });
  }, [editing, updateUser, createUser]);

  const handleEdit = (u: AdminUser) => { setEditing(u); setFormOpen(true); };
  const handleDelete = () => {
    if (deleting) deleteUser.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  };
  const handleToggleActive = (u: AdminUser) => {
    // Guard: API blocks deactivating self, skip client-side
    if (u.id === user?._id && u.active) return;
    updateUser.mutate({ id: u.id, active: !u.active });
  };

  if (!isAdmin) return <div className="py-16 text-center text-muted-foreground">Bạn không có quyền truy cập trang này.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Admin</h1>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => checkAlerts.mutate()} disabled={checkAlerts.isPending}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />Kiểm tra alerts
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkActive.mutate(false)} disabled={bulkActive.isPending}>
            <ToggleLeft className="h-3.5 w-3.5 mr-1" />Tắt tất cả
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkActive.mutate(true)} disabled={bulkActive.isPending}>
            <ToggleRight className="h-3.5 w-3.5 mr-1" />Bật tất cả
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" />Thêm User
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !data?.users.length ? (
        <EmptyState icon={Users} title="Chưa có user nào" />
      ) : (
        <UserTable users={data.users} onEdit={handleEdit} onDelete={setDeleting} onToggleActive={handleToggleActive} />
      )}

      <UserFormDialog open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={handleSubmit} loading={createUser.isPending || updateUser.isPending} initial={editing} />

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete}
        loading={deleteUser.isPending} title="Xoá User"
        description={`Bạn có chắc muốn xoá user "${deleting?.name}"?`} />
    </div>
  );
}
