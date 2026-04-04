import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TeamCard } from "@/components/team-card";
import { TeamFormDialog } from "@/components/team-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam, type Team } from "@/hooks/use-teams";
import { useAdminUsers } from "@/hooks/use-admin";
import { useAuth } from "@/hooks/use-auth";

export default function TeamsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [mineOnly, setMineOnly] = useState(false);

  const { data, isLoading } = useTeams({
    owner: isAdmin && ownerFilter ? ownerFilter : undefined,
    mine: mineOnly || undefined,
  });
  const { data: adminData } = useAdminUsers();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState<Team | null>(null);

  const handleSubmit = (body: Pick<Team, "name" | "label" | "color">) => {
    const mut = editing
      ? updateTeam.mutateAsync({ id: editing._id, label: body.label, color: body.color })
      : createTeam.mutateAsync(body);
    mut.then(() => { setFormOpen(false); setEditing(null); });
  };

  const handleEdit = (team: Team) => { setEditing(team); setFormOpen(true); };
  const handleDelete = () => {
    if (deleting) deleteTeam.mutate(deleting._id, { onSuccess: () => setDeleting(null) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Quản lý Teams</h1>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && adminData?.users && (
            <Select value={ownerFilter || "__all__"} onValueChange={(v) => { setOwnerFilter(v === "__all__" || !v ? "" : v); setMineOnly(false); }}>
              <SelectTrigger className="w-48 h-9 text-sm"><SelectValue placeholder="Filter by owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tất cả</SelectItem>
                {adminData.users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant={mineOnly ? "default" : "outline"} size="sm"
            onClick={() => { setMineOnly(!mineOnly); setOwnerFilter(""); }}>
            Của tôi
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Thêm Team
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : !data?.teams.length ? (
        <EmptyState icon={Users} title="Chưa có team nào" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.teams.map((team) => (
            <TeamCard key={team._id} team={team}
              currentUserId={user?._id ?? ""} isAdmin={isAdmin}
              onEdit={handleEdit} onDelete={setDeleting} />
          ))}
        </div>
      )}

      <TeamFormDialog open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={handleSubmit} loading={createTeam.isPending || updateTeam.isPending} initial={editing} />

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete}
        loading={deleteTeam.isPending} title="Xoá Team"
        description={`Bạn có chắc muốn xoá team "${deleting?.label}"? Team phải rỗng mới xoá được.`} />
    </div>
  );
}
