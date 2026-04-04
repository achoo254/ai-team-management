import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2, X, UserPlus, Download, ArrowRightLeft } from "lucide-react";
import { type Seat } from "@/hooks/use-seats";

/** Minimal user shape needed for assign/transfer pickers */
interface PickerUser { id: string; name: string; email: string; active: boolean; }

interface Props {
  seat: Seat;
  isAdmin: boolean;
  currentUserId: string;
  canManage: boolean;
  allUsers: PickerUser[];
  onEdit: (seat: Seat) => void;
  onDelete: (seat: Seat) => void;
  onAssign: (seatId: string, userId: string) => void;
  onUnassign: (seatId: string, userId: string) => void;
  onExportCredential: () => void;
  onTransfer?: (seatId: string, newOwnerId: string) => void;
}

export function SeatCard({ seat, isAdmin, currentUserId, canManage, allUsers, onEdit, onDelete, onAssign, onUnassign, onExportCredential, onTransfer }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const isOwner = seat.owner_id === currentUserId;
  const assignedIds = new Set(seat.users.map((u) => u.id));
  const availableUsers = allUsers.filter((u) => u.active && !assignedIds.has(u.id));
  const isFull = seat.users.length >= seat.max_users;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{seat.label}</CardTitle>
            <p className="text-sm text-muted-foreground truncate">{seat.email}</p>
            {/* Owner indicator */}
            {isOwner ? (
              <Badge variant="outline" className="mt-1 text-xs text-primary border-primary">Seat của tôi</Badge>
            ) : seat.owner ? (
              <p className="mt-1 text-xs text-muted-foreground">Owner: {seat.owner.name}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={seat.team === "dev" ? "default" : seat.team === "personal" ? "outline" : "secondary"}>{seat.team.toUpperCase()}</Badge>
            {canManage && (
              <>
                {seat.has_token && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onExportCredential} title="Export credential">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(seat)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(seat)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </>
            )}
            {isAdmin && onTransfer && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowTransfer(!showTransfer)} title="Chuyển quyền sở hữu">
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <p className="text-xs text-muted-foreground">
          {seat.users.length}/{seat.max_users} members
        </p>

        {/* Current members */}
        <div className="flex flex-wrap gap-1">
          {seat.users.map((u) => (
            <Badge key={u.id} variant="outline" className="text-xs gap-1 pr-1">
              {u.name}
              {canManage && (
                <button onClick={() => onUnassign(seat._id, u.id)} className="ml-0.5 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {seat.users.length === 0 && <p className="text-xs text-muted-foreground">Chưa gán người dùng</p>}
        </div>

        {/* Assign member */}
        {canManage && !isFull && (
          showPicker ? (
            <div className="space-y-1">
              <div className="max-h-32 overflow-y-auto rounded border bg-popover p-1">
                {availableUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-1">Không còn user khả dụng</p>
                ) : (
                  availableUsers.map((u) => (
                    <button key={u.id} onClick={() => { onAssign(seat._id, u.id); setShowPicker(false); }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent text-left">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-muted-foreground">{u.email}</span>
                    </button>
                  ))
                )}
              </div>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowPicker(false)}>Huỷ</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowPicker(true)}>
              <UserPlus className="h-3 w-3 mr-1" />Thêm member
            </Button>
          )
        )}

        {/* Transfer ownership (admin only) */}
        {showTransfer && isAdmin && onTransfer && (
          <div className="space-y-1">
            <p className="text-xs font-medium">Chuyển quyền sở hữu cho:</p>
            <div className="max-h-32 overflow-y-auto rounded border bg-popover p-1">
              {allUsers.filter(u => u.active && u.id !== seat.owner_id).map((u) => (
                <button key={u.id} onClick={() => { onTransfer(seat._id, u.id); setShowTransfer(false); }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent text-left">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-muted-foreground">{u.email}</span>
                </button>
              ))}
            </div>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowTransfer(false)}>Huỷ</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
