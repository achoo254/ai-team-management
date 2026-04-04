import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";
import { type AdminUser } from "@/hooks/use-admin";
import { useTeams, type Team } from "@/hooks/use-teams";

interface Props {
  users: AdminUser[];
  onEdit: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  onToggleActive?: (user: AdminUser) => void;
}

export function UserTable({ users, onEdit, onDelete, onToggleActive }: Props) {
  const { data: teamsData } = useTeams();
  const teamMap = new Map<string, Team>();
  for (const t of teamsData?.teams ?? []) teamMap.set(t._id, t);

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tên</TableHead>
            <TableHead className="hidden sm:table-cell">Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="hidden md:table-cell">Seat</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{u.email}</TableCell>
              <TableCell>
                <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(u.team_ids ?? []).map((tid) => {
                    const t = teamMap.get(tid);
                    return t ? (
                      <Badge key={tid} variant="outline" className="text-xs" style={{ borderLeftColor: t.color, borderLeftWidth: 3 }}>
                        {t.label}
                      </Badge>
                    ) : null;
                  })}
                  {(!u.team_ids || u.team_ids.length === 0) && <span className="text-xs text-muted-foreground">—</span>}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{u.seat_labels?.join(", ") || "—"}</TableCell>
              <TableCell>
                {onToggleActive ? (
                  <button
                    type="button"
                    onClick={() => onToggleActive(u)}
                    className="cursor-pointer"
                    title={u.active ? "Nhấn để vô hiệu hoá" : "Nhấn để kích hoạt"}
                  >
                    <Badge variant={u.active ? "default" : "outline"}>{u.active ? "Active" : "Inactive"}</Badge>
                  </button>
                ) : (
                  <Badge variant={u.active ? "default" : "outline"}>{u.active ? "Active" : "Inactive"}</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(u)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(u)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
