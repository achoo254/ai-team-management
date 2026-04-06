import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UrgentForecastItem, QuotaForecastStatus } from "@repo/shared/types";

interface Props {
  forecasts: UrgentForecastItem[];
}

const STATUS_COLOR: Record<string, string> = {
  warning: "text-orange-500",
  critical: "text-red-500",
  imminent: "text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  warning: "Cảnh báo",
  critical: "Nguy hiểm",
  imminent: "Sắp cạn",
};

const BAR_COLOR: Record<string, string> = {
  warning: "bg-orange-500/80",
  critical: "bg-red-500/90",
  imminent: "bg-red-600 animate-pulse",
};

function etaLabel(item: UrgentForecastItem): string {
  if (item.hours_to_full == null) return "—";
  if (item.hours_to_full < 1) return "<1h";
  return `~${Math.round(item.hours_to_full)}h`;
}

function ProgressBar({ pct, status }: { pct: number; status: QuotaForecastStatus }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const colorClass = BAR_COLOR[status] ?? "bg-muted-foreground/30";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
      <div className={`h-full rounded-full ${colorClass} transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/**
 * Compact card listing up to 3 seats with urgent quota forecast status
 * (warning / critical / imminent). Shown above the trend chart on dashboard.
 */
export function ForecastUrgentCard({ forecasts }: Props) {
  if (forecasts.length === 0) return null;

  return (
    <Card className="border-orange-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-orange-600 dark:text-orange-400">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Seats sắp cạn quota ({forecasts.length})
        </CardTitle>
        <p className="text-[10px] text-muted-foreground mt-0.5">Dự báo dựa trên tốc độ dùng hiện tại — không phụ thuộc bộ lọc thời gian</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {forecasts.map((item) => (
          <div
            key={item.seat_id}
            className="grid grid-cols-[minmax(0,1fr)_auto_minmax(80px,1fr)_auto] items-center gap-3 py-1.5 border-b border-border/30 last:border-0"
          >
            {/* Seat label */}
            <span className="truncate text-xs font-medium">{item.seat_label}</span>

            {/* Usage percentage */}
            <span className="tabular-nums text-xs font-semibold w-10 text-right">
              {Math.round(item.current_pct)}%
            </span>

            {/* Progress bar */}
            <ProgressBar pct={item.current_pct} status={item.status} />

            {/* Status + ETA */}
            <span className={`text-[11px] tabular-nums whitespace-nowrap ${STATUS_COLOR[item.status] ?? "text-muted-foreground"}`}>
              {STATUS_LABEL[item.status] ?? item.status} · {etaLabel(item)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
