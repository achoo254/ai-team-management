import { useState } from 'react'
import { Plus, Users, Pencil, Trash2, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam } from '@/hooks/use-teams'
import { useSeats } from '@/hooks/use-seats'
import { useAvailableUsers } from '@/hooks/use-seats'
import { useAuth } from '@/hooks/use-auth'
import { TeamFormDialog } from '@/components/team-form-dialog'
import type { Team } from '@repo/shared/types'

export default function TeamsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { data, isLoading } = useTeams()
  const { data: seatsData } = useSeats()
  const { data: usersData } = useAvailableUsers()
  const createTeam = useCreateTeam()
  const updateTeam = useUpdateTeam()
  const deleteTeam = useDeleteTeam()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Team | null>(null)
  const [deleting, setDeleting] = useState<Team | null>(null)

  const teams = data?.teams ?? []
  const seats = seatsData?.seats ?? []
  const allUsers = usersData?.users ?? []

  const canManage = (team: Team) =>
    isAdmin || (team.owner_id === user?._id) || (team.owner?._id === user?._id)

  const handleSubmit = (formData: { name: string; description?: string; seat_ids: string[]; member_ids: string[] }) => {
    const mut = editing
      ? updateTeam.mutateAsync({ id: editing._id, ...formData })
      : createTeam.mutateAsync(formData)
    mut.then(() => { setFormOpen(false); setEditing(null) }).catch(() => {})
  }

  const handleDelete = () => {
    if (deleting) deleteTeam.mutate(deleting._id, { onSuccess: () => setDeleting(null) })
  }

  // Split teams: owned by me vs others
  const myTeams = teams.filter(t => t.owner_id === user?._id || t.owner?._id === user?._id)
  const otherTeams = teams.filter(t => t.owner_id !== user?._id && t.owner?._id !== user?._id)

  const renderTeamCard = (team: Team) => (
    <div key={team._id} className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold truncate">{team.name}</h3>
          {team.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{team.description}</p>
          )}
        </div>
        {canManage(team) && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(team); setFormOpen(true) }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(team)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Owner */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Crown className="h-3 w-3" />
        <span>{team.owner?.name ?? team.owner?.email ?? 'Unknown'}</span>
      </div>

      {/* Seats */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Seats ({team.seats?.length ?? 0})</span>
        <div className="flex flex-wrap gap-1">
          {(team.seats ?? []).map(s => (
            <Badge key={s._id} variant="secondary" className="text-xs">{s.label}</Badge>
          ))}
          {(!team.seats || team.seats.length === 0) && (
            <span className="text-xs text-muted-foreground italic">Chưa có seat</span>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Members ({team.members?.length ?? 0})</span>
        <div className="flex flex-wrap gap-1">
          {(team.members ?? []).map(m => (
            <Badge key={m._id} variant="outline" className="text-xs">{m.name}</Badge>
          ))}
          {(!team.members || team.members.length === 0) && (
            <span className="text-xs text-muted-foreground italic">Chưa có member</span>
          )}
        </div>
      </div>
    </div>
  )

  const renderSection = (title: string, sectionTeams: Team[]) => {
    if (sectionTeams.length === 0) return null
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-muted-foreground">{title}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sectionTeams.map(renderTeamCard)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Teams</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" />Tạo Team
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : !teams.length ? (
        <EmptyState icon={Users} title="Chưa có team nào" description="Tạo team để nhóm seats và chia sẻ quyền xem" />
      ) : (
        <div className="space-y-6">
          {renderSection('Teams của tôi', myTeams)}
          {renderSection('Teams khác', otherTeams)}
        </div>
      )}

      <TeamFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSubmit={handleSubmit}
        loading={createTeam.isPending || updateTeam.isPending}
        initial={editing}
        seats={seats}
        users={allUsers}
        isAdmin={isAdmin}
        currentUserId={user?._id ?? ''}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteTeam.isPending}
        title="Xóa Team"
        description={`Bạn có chắc muốn xóa team "${deleting?.name}"? Seats và members sẽ không bị ảnh hưởng.`}
      />
    </div>
  )
}
