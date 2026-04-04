import { useState, useCallback, useEffect } from "react";
import { Plus, Users, RefreshCw, Send, ToggleLeft, ToggleRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserTable } from "@/components/user-table";
import { UserFormDialog } from "@/components/user-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import {
  useAdminUsers, useCreateUser, useUpdateUser, useDeleteUser,
  useBulkActive, useCheckAlerts, useSendReport, useSettings, useUpdateSettings,
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
  const sendReport = useSendReport();
  const { data: settingsData } = useSettings();
  const updateSettings = useUpdateSettings();

  const [formOpen, setFormOpen] = useState(false);
  const [rateLimitPct, setRateLimitPct] = useState(80);
  const [extraCreditPct, setExtraCreditPct] = useState(80);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [reportCooldown, setReportCooldown] = useState(false);

  useEffect(() => {
    if (settingsData?.alerts) {
      setRateLimitPct(settingsData.alerts.rate_limit_pct);
      setExtraCreditPct(settingsData.alerts.extra_credit_pct);
    }
  }, [settingsData]);

  const handleSaveSettings = () => {
    updateSettings.mutate({ alerts: { rate_limit_pct: rateLimitPct, extra_credit_pct: extraCreditPct } });
  };

  const handleSubmit = useCallback((body: Partial<AdminUser> & { seatId?: string }) => {
    const mut = editing
      ? updateUser.mutateAsync({ id: editing.id, ...body })
      : createUser.mutateAsync(body as Parameters<typeof createUser.mutateAsync>[0]);
    mut.then(() => { setFormOpen(false); setEditing(null); });
  }, [editing, updateUser, createUser]);

  const handleEdit = (u: AdminUser) => { setEditing(u); setFormOpen(true); };
  const handleDelete = () => {
    if (deleting) deleteUser.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  };

  const handleSendReport = () => {
    sendReport.mutate(undefined, {
      onSuccess: () => { setReportCooldown(true); setTimeout(() => setReportCooldown(false), 60000); },
    });
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
          <Button size="sm" variant="outline" onClick={handleSendReport} disabled={sendReport.isPending || reportCooldown}>
            <Send className="h-3.5 w-3.5 mr-1" />{reportCooldown ? "Chờ 60s..." : "Gửi báo cáo"}
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
        <UserTable users={data.users} onEdit={handleEdit} onDelete={setDeleting} />
      )}

      {/* Alert Settings */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Settings className="h-4 w-4" />
          Cài đặt Alert
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Rate limit threshold (%)</span>
            <input type="number" min={1} max={100} value={rateLimitPct}
              onChange={(e) => setRateLimitPct(Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Extra credit threshold (%)</span>
            <input type="number" min={1} max={100} value={extraCreditPct}
              onChange={(e) => setExtraCreditPct(Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm" />
          </label>
        </div>
        <Button size="sm" onClick={handleSaveSettings} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? "Đang lưu..." : "Lưu cài đặt"}
        </Button>
      </div>

      <UserFormDialog open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={handleSubmit} loading={createUser.isPending || updateUser.isPending} initial={editing} />

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete}
        loading={deleteUser.isPending} title="Xoá User"
        description={`Bạn có chắc muốn xoá user "${deleting?.name}"?`} />
    </div>
  );
}
