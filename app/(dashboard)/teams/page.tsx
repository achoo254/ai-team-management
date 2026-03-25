"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamCard } from "@/components/teams/team-card";
import { TeamFormDialog } from "@/components/teams/team-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam, type Team } from "@/hooks/use-teams";
import { useAuth } from "@/hooks/use-auth";

export default function TeamsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading } = useTeams();
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
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Thêm Team
          </Button>
        )}
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
            <TeamCard key={team._id} team={team} isAdmin={isAdmin}
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
