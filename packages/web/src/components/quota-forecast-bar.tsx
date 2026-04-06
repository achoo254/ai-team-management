import type { QuotaForecast, QuotaForecastStatus } from "@repo/shared/types";
import { formatResetTime } from "@/lib/format-reset";

const STATUS_COLOR: Record<QuotaForecastStatus, string> = {
  safe: "bg-green-500",
  safe_decreasing: "bg-green-500",
  watch: "bg-amber-500",
  warning: "bg-orange-500",
  critical: "bg-red-500",
  imminent: "bg-red-600 animate-pulse",
  collecting: "bg-muted-foreground/40",
  reset_first: "bg-green-500/70",
};

const STATUS_EMOJI: Record<QuotaForecastStatus, string> = {
  safe: "✅",
  safe_decreasing: "✅",
  watch: "🟡",
  warning: "🟠",
  critical: "🔴",
  imminent: "🚨",
  collecting: "⏳",
  reset_first: "🔄",
};

const STATUS_LABEL: Record<QuotaForecastStatus, string> = {
  safe: "Ổn định",
  safe_decreasing: "Đang giảm",
  watch: "Theo dõi",
  warning: "Cảnh báo",
  critical: "Nguy cấp",
  imminent: "Sắp full",
  collecting: "Đang thu thập",
  reset_first: "Reset trước",
};

/** Format ISO date to Vietnamese: "Thứ 5 07/04 ~14:30" */
export function formatForecastDate(iso: string): string {
  const d = new Date(iso);
  const dow = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"][d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dow} ${dd}/${mm} ~${hh}:${mi}`;
}

function ProgressBar({ pct, colorClass }: { pct: number; colorClass: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

interface SevenDayProps {
  type: "7d";
  data: QuotaForecast["seven_day"];
}
interface FiveHourProps {
  type: "5h";
  data: QuotaForecast["five_hour"];
}

export function QuotaForecastBar(props: SevenDayProps | FiveHourProps) {
  if (!props.data) {
    return (
      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">
          {props.type === "7d" ? "Quota 7d" : "Quota 5h (chu kỳ hiện tại)"}
        </p>
        <ProgressBar pct={0} colorClass="bg-muted" />
        <p className="text-xs text-muted-foreground">Chưa có dữ liệu</p>
      </div>
    );
  }

  if (props.type === "5h") {
    const d = props.data;
    // Color semantics: HIGH utilization = GREEN (good, maximizing ROI).
    // BUT "critical" signals burndown too fast — affects shared seat users → amber warning.
    const color = d.current_pct >= 80 ? "bg-emerald-500" : d.current_pct >= 50 ? "bg-sky-500" : d.current_pct >= 20 ? "bg-amber-500" : "bg-red-500";
    const label = d.current_pct >= 80 ? "Tận dụng tốt" : d.current_pct >= 50 ? "Khá" : d.current_pct >= 20 ? "Thấp" : "Rất thấp";
    return (
      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">Quota 5h (chu kỳ hiện tại)</p>
        <ProgressBar pct={d.current_pct} colorClass={color} />
        <p className="text-xs text-muted-foreground">
          <b className="text-foreground tabular-nums">{d.current_pct}%</b> · {label}
        </p>
        {d.resets_at && (
          <p className="text-[11px] text-muted-foreground">
            ↻ Reset: {formatResetTime(d.resets_at).label}
          </p>
        )}
      </div>
    );
  }

  const d = props.data;
  const colorClass = STATUS_COLOR[d.status];
  const emoji = STATUS_EMOJI[d.status];
  const showForecast = d.forecast_at && d.hours_to_full != null
    && d.status !== "safe" && d.status !== "safe_decreasing" && d.status !== "collecting"
    && d.status !== "reset_first";

  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground truncate">
        Quota 7d{d.seat_label ? ` (seat ${d.seat_label} sẽ hết sớm nhất)` : ""}
      </p>
      <ProgressBar pct={d.current_pct} colorClass={colorClass} />
      <p className="text-xs text-muted-foreground">
        <b className="text-foreground tabular-nums">{Math.round(d.current_pct)}%</b>
        {d.slope_per_hour > 0 && (
          <> · tăng +{d.slope_per_hour.toFixed(1)}%/h</>
        )}
        {d.status === "collecting" && <> · {emoji} {STATUS_LABEL[d.status]}</>}
        {d.status === "safe_decreasing" && <> · {emoji} {STATUS_LABEL[d.status]}</>}
        {d.status === "reset_first" && <> · {emoji} {STATUS_LABEL[d.status]}</>}
        {d.status === "safe" && !showForecast && <> · {emoji} {STATUS_LABEL[d.status]}</>}
      </p>
      {showForecast && (
        <p className="text-xs">
          {emoji} Dự báo hết: <b>{formatForecastDate(d.forecast_at!)}</b>
          <span className="text-muted-foreground"> (còn ~{Math.round(d.hours_to_full!)}h)</span>
        </p>
      )}
      {d.resets_at && (
        <p className="text-[11px] text-muted-foreground">
          ↻ Reset: {formatResetTime(d.resets_at).label}
        </p>
      )}
    </div>
  );
}
