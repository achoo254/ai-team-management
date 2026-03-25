"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { type Alert } from "@/hooks/use-alerts";

interface Props {
  alert: Alert;
  isAdmin: boolean;
  onResolve: (id: string) => void;
  resolving?: boolean;
}

const TYPE_COLORS: Record<string, "destructive" | "secondary" | "outline"> = {
  high_usage: "destructive",
  inactivity: "secondary",
};

export function AlertCard({ alert, isAdmin, onResolve, resolving }: Props) {
  const color = TYPE_COLORS[alert.type] ?? "outline";
  const date = new Date(alert.created_at).toLocaleDateString("vi-VN");

  return (
    <Card className={alert.resolved ? "opacity-60" : ""}>
      <CardContent className="py-3 flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {alert.resolved
            ? <CheckCircle className="h-4 w-4 text-green-500" />
            : <AlertTriangle className="h-4 w-4 text-destructive" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant={color} className="text-xs">{alert.type.replace("_", " ")}</Badge>
            <span className="text-xs text-muted-foreground truncate">{alert.seat_email}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
              <Clock className="h-3 w-3" />{date}
            </span>
          </div>
          <p className="text-sm">{alert.message}</p>
          {alert.resolved && alert.resolved_by && (
            <p className="text-xs text-muted-foreground mt-1">Xử lý bởi: {alert.resolved_by}</p>
          )}
        </div>
        {isAdmin && !alert.resolved && (
          <Button size="sm" variant="outline" className="shrink-0"
            onClick={() => onResolve(alert._id)} disabled={resolving}>
            Xử lý
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
