
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2, X } from "lucide-react";
import { type Seat } from "@/hooks/use-seats";

interface Props {
  seat: Seat;
  isAdmin: boolean;
  onEdit: (seat: Seat) => void;
  onDelete: (seat: Seat) => void;
  onUnassign: (seatId: string, userId: string) => void;
}

export function SeatCard({ seat, isAdmin, onEdit, onDelete, onUnassign }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{seat.label}</CardTitle>
            <p className="text-sm text-muted-foreground truncate">{seat.email}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={seat.team === "dev" ? "default" : "secondary"}>{seat.team.toUpperCase()}</Badge>
            {isAdmin && (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(seat)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(seat)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground mb-2">
          {seat.users.length}/{seat.max_users} người dùng
        </p>
        <div className="flex flex-wrap gap-1">
          {seat.users.map((u) => (
            <Badge key={u.id} variant="outline" className="text-xs gap-1 pr-1">
              {u.name}
              {isAdmin && (
                <button onClick={() => onUnassign(seat._id, u.id)} className="ml-0.5 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {seat.users.length === 0 && <p className="text-xs text-muted-foreground">Chưa gán người dùng</p>}
        </div>
      </CardContent>
    </Card>
  );
}
