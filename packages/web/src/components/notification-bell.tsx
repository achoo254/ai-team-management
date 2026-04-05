import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router";
import { useAlerts, useUnreadAlertCount, useMarkAlertsRead } from "@/hooks/use-alerts";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Alert } from "@repo/shared/types";

const TYPE_LABELS: Record<string, string> = {
  rate_limit: "Rate Limit",
  extra_credit: "Extra Credit",
  token_failure: "Token Error",
  usage_exceeded: "Vượt Budget",
  session_waste: "Lãng phí",
  "7d_risk": "7d Risk",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins}p trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h trước`;
  return `${Math.floor(hours / 24)}d trước`;
}

function getSeatLabel(alert: Alert): string {
  if (!alert.seat_id || typeof alert.seat_id !== "object") return "";
  return alert.seat_id.label ?? alert.seat_id.email ?? "";
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: unread } = useUnreadAlertCount();
  const { data: recent } = useAlerts();
  const markRead = useMarkAlertsRead();
  const count = unread?.count ?? 0;
  const recentAlerts = (recent?.alerts ?? []).slice(0, 5);
  const isUnread = (alert: Alert) =>
    !!user && !(alert.read_by ?? []).some((id) => String(id) === user._id);

  function handleItemClick(alertId: string) {
    markRead.mutate([alertId]);
    navigate("/alerts");
  }

  function handleViewAll() {
    if (recentAlerts.length > 0) {
      markRead.mutate(recentAlerts.map((a) => a._id));
    }
    navigate("/alerts");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative p-2 rounded-md hover:bg-accent transition-colors">
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Thông báo</span>
            {count > 0 && (
              <Badge variant="secondary" className="text-[10px]">{count}</Badge>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {recentAlerts.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            Không có thông báo mới
          </div>
        ) : (
          <>
            {recentAlerts.map((alert) => {
              const unreadFlag = isUnread(alert);
              return (
                <DropdownMenuItem
                  key={alert._id}
                  onClick={() => handleItemClick(alert._id)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 py-2 pl-3 cursor-pointer border-l-2 transition-colors",
                    unreadFlag
                      ? "border-l-destructive bg-destructive/5 hover:bg-destructive/10"
                      : "border-l-transparent opacity-70",
                  )}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    {unreadFlag && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" aria-label="chưa đọc" />
                    )}
                    <span className="text-[10px] font-semibold uppercase text-destructive">
                      {TYPE_LABELS[alert.type] ?? alert.type}
                    </span>
                    <span className="text-[11px] text-foreground/70">{getSeatLabel(alert)}</span>
                  </div>
                  <p
                    className={cn(
                      "text-xs line-clamp-1",
                      unreadFlag ? "text-foreground font-medium" : "text-muted-foreground",
                    )}
                  >
                    {alert.message}
                  </p>
                  <span className="text-[10px] text-muted-foreground/60">{timeAgo(alert.created_at)}</span>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleViewAll} className="justify-center text-xs">
              Xem tất cả →
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
