import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, TrendingUp, KeyRound, Clock, ChevronDown,
} from "lucide-react";
import type { Alert } from "@/hooks/use-alerts";

const TYPE_CONFIG: Record<string, { label: string; variant: "destructive" | "secondary" | "outline"; icon: typeof TrendingUp }> = {
  rate_limit: { label: "Rate Limit", variant: "destructive", icon: TrendingUp },
  token_failure: { label: "Token Error", variant: "outline", icon: KeyRound },
  usage_exceeded: { label: "Vượt Budget", variant: "destructive", icon: AlertTriangle },
  session_waste: { label: "Lãng phí", variant: "secondary", icon: Clock },
  "7d_risk": { label: "7d Risk", variant: "destructive", icon: TrendingUp },
};

function UsageBar({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 80 ? "bg-destructive" : pct >= 50 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="w-10 text-right font-mono">{pct}%</span>
    </div>
  );
}

function ExpandedMetadata({ alert }: { alert: Alert }) {
  const m = alert.metadata;
  if (!m) return null;

  switch (alert.type) {
    case "rate_limit": {
      const label = (m.session as string) ?? (alert.window ?? "");
      const pct = (m.max_pct as number | undefined) ?? m.pct ?? 0;
      return (
        <div className="space-y-1.5 pt-2 border-t border-border/50">
          {label && <UsageBar label={label} pct={pct} />}
          {(m.threshold as number | undefined) != null && (
            <p className="text-[11px] text-muted-foreground">Ngưỡng: {m.threshold as number}%</p>
          )}
          {m.resets_at && (
            <p className="text-[11px] text-muted-foreground">
              Reset: {new Date(m.resets_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      );
    }
    case "token_failure":
      return m.error ? (
        <div className="pt-2 border-t border-border/50">
          <code className="block text-[11px] text-muted-foreground break-all">{m.error}</code>
          <p className="text-[11px] text-amber-600 mt-1">Cần re-import credential</p>
        </div>
      ) : null;
    case "usage_exceeded":
      return (
        <div className="space-y-1.5 pt-2 border-t border-border/50">
          {m.user_name && <p className="text-xs font-medium">{m.user_name}</p>}
          {m.delta != null && m.budget != null && (
            <UsageBar label={m.session ?? "Phiên"} pct={Math.round((m.delta / m.budget) * 100)} />
          )}
        </div>
      );
    case "session_waste":
      return (
        <div className="pt-2 border-t border-border/50">
          {m.duration != null && <p className="text-[11px] text-muted-foreground">Thời gian: {m.duration}h</p>}
          {m.delta != null && <p className="text-[11px] text-muted-foreground">5h: {m.delta}%</p>}
          <p className="text-[11px] text-amber-600 mt-1">Cân nhắc rút ngắn session</p>
        </div>
      );
    case "7d_risk":
      return (
        <div className="space-y-1.5 pt-2 border-t border-border/50">
          {m.current_7d != null && <UsageBar label="7d hiện" pct={Math.round(m.current_7d)} />}
          {m.projected != null && <UsageBar label="Dự kiến" pct={Math.round(m.projected)} />}
          {m.remaining_sessions != null && (
            <p className="text-[11px] text-muted-foreground">Còn {m.remaining_sessions} session hôm nay</p>
          )}
        </div>
      );
    default:
      return null;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export function AlertCard({ alert }: { alert: Alert }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TYPE_CONFIG[alert.type] ?? { label: alert.type, variant: "outline" as const, icon: AlertTriangle };
  const Icon = cfg.icon;
  const seatLabel = alert.seat_id && typeof alert.seat_id === "object"
    ? (alert.seat_id.label ?? alert.seat_id.email ?? "")
    : "";

  return (
    <div
      className="group rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors cursor-pointer px-4 py-3"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="mt-0.5 shrink-0 rounded-full p-1.5 bg-destructive/10 text-destructive">
          <Icon className="h-3.5 w-3.5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={cfg.variant} className="text-[10px] uppercase tracking-wider font-medium">
              {cfg.label}
            </Badge>
            <span className="text-xs font-medium text-foreground/70">{seatLabel}</span>
          </div>
          <p className="text-sm leading-relaxed">{alert.message}</p>
          <span className="text-[11px] text-muted-foreground">{timeAgo(alert.created_at)}</span>

          {/* Expanded metadata */}
          {expanded && <ExpandedMetadata alert={alert} />}
        </div>

        {/* Expand indicator */}
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </div>
    </div>
  );
}
