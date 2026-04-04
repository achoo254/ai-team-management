import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, TrendingUp, CreditCard, KeyRound } from "lucide-react";
import { type Alert } from "@/hooks/use-alerts";

interface Props {
  alert: Alert;
  isAdmin: boolean;
  onResolve: (id: string) => void;
  resolving?: boolean;
}

const TYPE_CONFIG: Record<string, { label: string; variant: "destructive" | "secondary" | "outline"; icon: typeof TrendingUp }> = {
  rate_limit: { label: "Rate Limit", variant: "destructive", icon: TrendingUp },
  extra_credit: { label: "Extra Credit", variant: "secondary", icon: CreditCard },
  token_failure: { label: "Token Error", variant: "outline", icon: KeyRound },
};

function MetadataInfo({ alert }: { alert: Alert }) {
  const m = alert.metadata;
  if (!m) return null;

  switch (alert.type) {
    case 'rate_limit':
      return (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {m.window && <Badge variant="outline" className="text-[10px]">{m.window}</Badge>}
          {m.pct != null && <Badge variant="outline" className="text-[10px]">{m.pct}%</Badge>}
        </div>
      );
    case 'extra_credit':
      return m.credits_used != null ? (
        <div className="text-xs text-muted-foreground mt-1">
          Credits: ${m.credits_used}/{m.credits_limit != null ? `$${m.credits_limit}` : '?'}
        </div>
      ) : null;
    case 'token_failure':
      return m.error ? (
        <code className="block text-[11px] text-muted-foreground mt-1 truncate max-w-xs">{m.error}</code>
      ) : null;
    default:
      return null;
  }
}

export function AlertCard({ alert, isAdmin, onResolve, resolving }: Props) {
  const cfg = TYPE_CONFIG[alert.type] ?? { label: alert.type, variant: "outline" as const, icon: AlertTriangle };
  const Icon = cfg.icon;
  const date = new Date(alert.created_at).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className={`group flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors
      ${alert.resolved
        ? "border-border/50 bg-muted/30 opacity-70"
        : "border-border bg-card hover:bg-accent/5"
      }`}
    >
      {/* Status icon */}
      <div className={`mt-0.5 shrink-0 rounded-full p-1.5 ${
        alert.resolved ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"
      }`}>
        {alert.resolved
          ? <CheckCircle className="h-3.5 w-3.5" />
          : <Icon className="h-3.5 w-3.5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={cfg.variant} className="text-[10px] uppercase tracking-wider font-medium">
            {cfg.label}
          </Badge>
          <span className="text-xs font-medium text-foreground/70">
            {typeof alert.seat_id === 'object' ? alert.seat_id.label ?? alert.seat_id.email : ''}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{alert.message}</p>
        <MetadataInfo alert={alert} />
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span>{date}</span>
          {alert.resolved && alert.resolved_by && (
            <span>Xử lý: <span className="font-medium text-foreground/60">{alert.resolved_by}</span></span>
          )}
        </div>
      </div>

      {/* Action */}
      {isAdmin && !alert.resolved && (
        <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs"
          onClick={() => onResolve(alert._id)} disabled={resolving}>
          <CheckCircle className="h-3 w-3 mr-1" />
          Xử lý
        </Button>
      )}
    </div>
  );
}
