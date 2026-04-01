
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";
import { type AdminUser } from "@/hooks/use-admin";

interface Props {
  users: AdminUser[];
  onEdit: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
}

export function UserTable({ users, onEdit, onDelete }: Props) {
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
              <TableCell>{u.team}</TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{u.seat_label ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={u.active ? "default" : "outline"}>{u.active ? "Active" : "Inactive"}</Badge>
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
