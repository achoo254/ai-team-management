import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, TrendingDown, Minus, Clock3, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatResetTime } from "@/lib/format-reset";
import type { QuotaForecastResult, QuotaForecastStatus } from "@repo/shared/types";
import { formatForecastDate } from "@/components/quota-forecast-bar";

const BAR_COLOR: Record<QuotaForecastStatus, string> = {
  safe: "bg-emerald-500/80",
  safe_decreasing: "bg-emerald-500/60",
  watch: "bg-amber-500/80",
  warning: "bg-orange-500/80",
  critical: "bg-red-500/90",
  imminent: "bg-red-600 animate-pulse",
  collecting: "bg-muted-foreground/30",
  reset_first: "bg-emerald-500/60",
};

const URGENT_STATUSES = new Set<QuotaForecastStatus>(["warning", "critical", "imminent"]);

const DEFAULT_VISIBLE = 3;

function StatusIcon({ status }: { status: QuotaForecastStatus }) {
  const base = "h-3 w-3 shrink-0";
  if (status === "critical" || status === "imminent" || status === "warning") {
    return <AlertTriangle className={`${base} text-orange-500`} aria-label="Cần theo dõi" />;
  }
  if (status === "safe_decreasing") {
    return <TrendingDown className={`${base} text-emerald-500`} aria-label="Đang giảm" />;
  }
  if (status === "reset_first") {
    return <RotateCcw className={`${base} text-emerald-500`} aria-label="Reset trước" />;
  }
  if (status === "collecting") {
    return <Clock3 className={`${base} text-muted-foreground`} aria-label="Đang thu thập" />;
  }
  return <Minus className={`${base} text-muted-foreground/50`} aria-label="Ổn định" />;
}

function ProgressBar({ pct, colorClass }: { pct: number; colorClass: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
      <div className={`h-full rounded-full ${colorClass} transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** Compact forecast text: "~90h · T5 13:17" or "Đang giảm" etc. */
function forecastLabel(seat: QuotaForecastResult): string {
  if (seat.status === "collecting") return "Đang thu thập";
  if (seat.status === "safe_decreasing") return "Đang giảm";
  if (seat.status === "reset_first") {
    if (seat.resets_at) {
      const short = formatForecastDate(seat.resets_at)
        .replace("Thứ ", "T")
        .replace(" ~", " ");
      const parts = short.split(" ");
      const compact = parts.length >= 3 ? `${parts[0]} ${parts[2]}` : short;
      return `Reset trước · ${compact}`;
    }
    return "Reset trước";
  }
  if (seat.hours_to_full == null) return "Ổn định";
  if (seat.forecast_at) {
    // Compact: "T5 13:17 · ~90h"
    const short = formatForecastDate(seat.forecast_at)
      .replace("Thứ ", "T")
      .replace(" ~", " "); // "T5 07/04 14:30"
    // Drop date portion if urgent (focus on day-of-week + time)
    const parts = short.split(" ");
    const compact = parts.length >= 3 ? `${parts[0]} ${parts[2]}` : short;
    return `${compact} · ~${Math.round(seat.hours_to_full)}h`;
  }
  return `~${Math.round(seat.hours_to_full)}h`;
}

function SeatRow({ seat }: { seat: QuotaForecastResult }) {
  const depleted = seat.current_pct >= 100;
  // Depleted: faded bar, no pulse
  const colorClass = depleted ? "bg-red-600/50" : BAR_COLOR[seat.status];
  const isUrgent = URGENT_STATUSES.has(seat.status);
  const resetLabel = depleted && seat.resets_at ? formatResetTime(seat.resets_at).label : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(120px,1.2fr)_auto_minmax(0,1.6fr)] items-center gap-3 text-xs py-1.5 border-b border-border/30 last:border-0">
      <span className="font-medium truncate">{seat.seat_label}</span>
      <span className="tabular-nums text-foreground font-semibold w-10 text-right">
        {Math.round(seat.current_pct)}%
      </span>
      <ProgressBar pct={seat.current_pct} colorClass={colorClass} />
      {depleted ? (
        <>
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">Đã cạn</Badge>
          <span className="text-[10px] tabular-nums text-muted-foreground truncate text-right">
            {resetLabel ? `Reset ${resetLabel}` : ""}
          </span>
        </>
      ) : (
        <>
          <StatusIcon status={seat.status} />
          <span className={`tabular-nums text-[11px] truncate text-right ${isUrgent ? "text-foreground" : "text-muted-foreground"}`}>
            {forecastLabel(seat)}
          </span>
        </>
      )}
    </div>
  );
}

export function Quota7dForecast({ seats }: { seats: QuotaForecastResult[] }) {
  const [expanded, setExpanded] = useState(false);

  if (seats.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-muted-foreground">Quota 7d — dự báo theo seat</p>
        <p className="text-xs text-muted-foreground">Chưa có dữ liệu</p>
      </div>
    );
  }

  const urgentCount = seats.filter(s => URGENT_STATUSES.has(s.status)).length;
  const visible = expanded ? seats : seats.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = seats.length - DEFAULT_VISIBLE;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground pb-1 border-b border-border/40">
        <span>Quota 7d · {seats.length} seat{seats.length > 1 ? "s" : ""}</span>
        {urgentCount > 0 && (
          <span className="flex items-center gap-1 text-orange-500">
            <AlertTriangle className="h-3 w-3" />
            {urgentCount} cần theo dõi
          </span>
        )}
      </div>
      <div>
        {visible.map((s) => <SeatRow key={s.seat_id} seat={s} />)}
      </div>
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors pt-1"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Thu gọn" : `Xem tất cả (${hiddenCount} seats khác)`}
        </button>
      )}
    </div>
  );
}
