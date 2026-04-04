import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Users, Monitor } from "lucide-react";
import { type Team } from "@/hooks/use-teams";

interface Props {
  team: Team;
  currentUserId: string;
  isAdmin: boolean;
  onEdit: (team: Team) => void;
  onDelete: (team: Team) => void;
}

export function TeamCard({ team, currentUserId, isAdmin, onEdit, onDelete }: Props) {
  const isOwner = team.created_by === currentUserId;
  const canManage = isAdmin || isOwner;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
            <div className="min-w-0">
              <CardTitle className="text-base">{team.label}</CardTitle>
              <p className="text-xs text-muted-foreground">{team.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isOwner && <Badge variant="outline" className="text-xs text-primary border-primary">Của tôi</Badge>}
            {canManage && (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(team)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(team)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{team.user_count} người</span>
          <span className="flex items-center gap-1"><Monitor className="h-3.5 w-3.5" />{team.seat_count} seat</span>
        </div>
        {team.creator && !isOwner && (
          <p className="text-xs text-muted-foreground">by {team.creator.name || team.creator.email}</p>
        )}
      </CardContent>
    </Card>
  );
}
