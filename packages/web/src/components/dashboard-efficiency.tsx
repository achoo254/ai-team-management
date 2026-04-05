import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEfficiency, formatRangeDate, type DashboardRange } from "@/hooks/use-dashboard";
import { useCardSeatOverride } from "@/hooks/use-card-seat-override";
import { DashboardSeatFilter } from "@/components/dashboard-seat-filter";
import { Quota7dForecast } from "@/components/quota-7d-forecast";

function StatBox({ label, value, suffix, warn, tooltip }: { label: string; value: string | number; suffix?: string; warn?: boolean; tooltip?: string }) {
  return (
    <div className="text-center" title={tooltip}>
      <div className={`text-xl font-bold tabular-nums ${warn ? "text-red-500" : ""}`}>
        {value}{suffix}
      </div>
      <div className={`text-[11px] text-muted-foreground mt-0.5 ${tooltip ? "underline decoration-dotted cursor-help" : ""}`}>{label}</div>
    </div>
  );
}

function getUserBadge(util: number): { label: string; variant: "default" | "secondary" | "outline" } {
  if (util >= 60) return { label: "Tốt", variant: "default" };
  if (util >= 30) return { label: "TB", variant: "secondary" };
  return { label: "Thấp", variant: "outline" };
}

/** Qualitative label for stddev of 5h peaks — translates σ into user-friendly text. */
function VolatilityBadge({ stddev }: { stddev: number }) {
  let label: string;
  let color: string;
  if (stddev < 10) { label = "Đều"; color = "text-emerald-500 border-emerald-500/30"; }
  else if (stddev < 25) { label = "Vừa"; color = "text-amber-500 border-amber-500/30"; }
  else { label = "Thất thường"; color = "text-orange-500 border-orange-500/30"; }
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${color}`}>
      {label}
    </span>
  );
}

/** Leaderboard row color by utilization tier. */
function tierColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-sky-500";
  if (pct >= 10) return "bg-amber-500";
  return "bg-red-500";
}
function tierTextColor(pct: number): string {
  if (pct >= 80) return "text-emerald-500";
  if (pct >= 50) return "text-sky-500";
  if (pct >= 10) return "text-amber-500";
  return "text-red-500";
}

const RANGE_LABEL: Record<import("@/hooks/use-dashboard").DashboardRange, string> = {
  day: "hôm nay", week: "7 ngày", month: "30 ngày", "3month": "3 tháng", "6month": "6 tháng",
};

/** Ranked leaderboard of all seats sorted by 5h peak avg — single unified list. */
function SeatLeaderboard({ seats, range }: { seats: import("@/hooks/use-dashboard").EfficiencyPerSeat[]; range: import("@/hooks/use-dashboard").DashboardRange }) {
  const sorted = [...seats].sort((a, b) => b.avg_utilization - a.avg_utilization);
  const maxUtil = Math.max(...sorted.map(s => s.avg_utilization), 1);
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border/30 pb-1.5 mb-2" title="Xếp hạng theo trung bình peak 5h% qua các chu kỳ đã đóng. Nw = số chu kỳ (window) đã đóng.">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Xếp hạng tận dụng 5h TB · {RANGE_LABEL[range]}
      </h3>
      <div className="space-y-1">
        {sorted.map((seat, i) => {
          const barW = Math.max(2, (seat.avg_utilization / maxUtil) * 100);
          return (
            <div key={seat.seat_id} className="flex items-center gap-2 text-[11px] group">
              {/* Rank */}
              <span className={`w-4 text-right tabular-nums font-bold ${i === 0 ? "text-emerald-500" : i >= sorted.length - 1 ? "text-red-500" : "text-muted-foreground"}`}>
                {i + 1}
              </span>
              {/* Label */}
              <span className="truncate min-w-0 w-20 font-medium">{seat.label}</span>
              {/* Progress bar (relative to max seat) */}
              <div className="flex-1 h-3 rounded-sm bg-muted/30 overflow-hidden relative">
                <div
                  className={`h-full rounded-sm ${tierColor(seat.avg_utilization)} transition-all`}
                  style={{ width: `${barW}%` }}
                />
                {/* Inline % label inside bar if wide enough */}
                {barW > 25 && (
                  <span className="absolute inset-y-0 left-1.5 flex items-center text-[9px] font-bold text-white/90 tabular-nums">
                    {Math.round(seat.avg_utilization)}%
                  </span>
                )}
              </div>
              {/* % outside bar if narrow */}
              {barW <= 25 && (
                <span className={`tabular-nums font-bold w-8 text-right ${tierTextColor(seat.avg_utilization)}`}>
                  {Math.round(seat.avg_utilization)}%
                </span>
              )}
              {/* Window count */}
              <span className="text-[9px] text-muted-foreground tabular-nums w-6 text-right">{seat.session_count}w</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Stacked horizontal bar showing cycle distribution by utilization tier. */
function TierBreakdownBar({ full, good, low, waste, total }: { full: number; good: number; low: number; waste: number; total: number }) {
  if (total === 0) return null;
  const pct = (v: number) => Math.round((v / total) * 100);
  const tiers = [
    { label: "Đầy ≥80%", count: full, pct: pct(full), color: "bg-emerald-500" },
    { label: "Khá 50-80%", count: good, pct: pct(good), color: "bg-sky-500" },
    { label: "Thấp 10-50%", count: low, pct: pct(low), color: "bg-amber-500" },
    { label: "Lãng phí <10%", count: waste, pct: pct(waste), color: "bg-red-500" },
  ];
  return (
    <div className="space-y-1">
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/30">
        {tiers.map((t) => t.count > 0 && (
          <div key={t.label} className={`${t.color} transition-all`} style={{ width: `${(t.count / total) * 100}%` }} title={`${t.label}: ${t.count} chu kỳ (${t.pct}%)`} />
        ))}
      </div>
      {/* Legend inline */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-muted-foreground">
        {tiers.filter(t => t.count > 0).map((t) => (
          <span key={t.label} className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${t.color}`} />
            {t.label} <b className="text-foreground tabular-nums">{t.count}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Format window time range: "15:00–20:00" (VN timezone) */
function formatWindowTime(start: string, end: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" });
  };
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  return `${fmtDate(start)} ${fmt(start)}–${fmt(end)}`;
}

function utilColor(pct: number): string {
  if (pct >= 80) return "text-emerald-500";
  if (pct >= 50) return "text-sky-500";
  if (pct >= 10) return "text-amber-500";
  return "text-red-500";
}

const CLOSED_DEFAULT_VISIBLE = 3;

/**
 * Expandable section: recently closed 5h cycles.
 *
 * HOW CLOSED IS DETECTED:
 * Claude API returns `five_hour_resets_at` — a timestamp marking when the current 5h window
 * expires. Every 5 min, the usage collector fetches snapshots. When `five_hour_resets_at`
 * changes between consecutive snapshots (new cycle boundary), the detector
 * (`usage-window-detector.ts`) closes the old window and opens a new one.
 * A safety cron (`closeStaleUsageWindows`) also closes windows whose `window_end` has passed.
 */
function ClosedCyclesSection({ cycles }: { cycles: import("@/hooks/use-dashboard").SparklinePoint[] }) {
  const [expanded, setExpanded] = useState(false);
  // Reverse: newest first for display
  const reversed = [...cycles].reverse();
  if (reversed.length === 0) return null;

  const visible = expanded ? reversed : reversed.slice(0, CLOSED_DEFAULT_VISIBLE);
  const hiddenCount = reversed.length - CLOSED_DEFAULT_VISIBLE;

  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground mb-1.5" title="Chu kỳ đã đóng: detected khi Claude API đổi five_hour_resets_at (reset cycle boundary), hoặc window_end đã qua.">
        Chu kỳ đã đóng ({reversed.length} gần nhất)
      </p>
      <div className="space-y-0.5">
        {visible.map((c, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 text-xs py-1 border-b border-border/20 last:border-0">
            <span className="font-medium truncate">{c.seat_label}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{formatWindowTime(c.window_start, c.window_end)}</span>
            <span className={`tabular-nums font-semibold w-10 text-right ${utilColor(c.utilization_pct)}`}>
              {c.utilization_pct}%
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums w-14 text-right" title="% quota 7d tiêu tốn trong chu kỳ này">
              7d {c.delta_7d_pct}%
            </span>
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors pt-1"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Thu gọn" : `Xem tất cả (${hiddenCount} chu kỳ khác)`}
        </button>
      )}
    </div>
  );
}

const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 min = idle

/** Format idle duration: "45m" / "2h 10m" / "4h". Returns null if under threshold. */
function formatIdleDuration(lastActivityAt: string | null): string | null {
  if (!lastActivityAt) return null;
  const idleMs = Date.now() - new Date(lastActivityAt).getTime();
  if (idleMs < IDLE_THRESHOLD_MS) return null;
  const mins = Math.floor(idleMs / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function DashboardEfficiency({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const filter = useCardSeatOverride(seatIds);
  const { data, isLoading } = useEfficiency(range, filter.effective);
  const filterBtn = <DashboardSeatFilter compact value={filter.effective} onChange={filter.setOverride} isOverride={filter.isOverride} onReset={filter.resetToGlobal} />;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Hiệu suất sử dụng</CardTitle>
            {filterBtn}
          </div>
        </CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    );
  }

  const s = data?.summary;
  const coverage = data?.coverage;
  if (!s || s.total_sessions === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Hiệu suất sử dụng</CardTitle>
            {filterBtn}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            {filter.isOverride ? "Không có dữ liệu cho filter hiện tại" : "Dữ liệu đang thu thập (chu kỳ 5h đầu tiên)"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const wastedPct = Math.round(100 - s.avg_utilization);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Hiệu suất sử dụng</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatRangeDate(range)}</span>
            {filterBtn}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {coverage && coverage.has_data && coverage.seats_with_data < coverage.seats_total && (
          <div className="text-xs bg-blue-500/10 border border-blue-500/30 rounded px-2 py-1.5 text-blue-700 dark:text-blue-400">
            Đang thu thập dữ liệu: {coverage.seats_with_data}/{coverage.seats_total} seats có session đã đóng.
          </div>
        )}

        {/* ═══ TOP: Stats + Tier bar (full width summary) ═══ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>{s.total_sessions} chu kỳ · tổng {Math.round(s.total_hours)}h</span>
            <div className="flex items-center gap-1" title={`σ = ${s.stddev_util.toFixed(1)}%`}>
              <span>{Math.round(s.peak_min)}% ↔ {Math.round(s.peak_max)}%</span>
              <VolatilityBadge stddev={s.stddev_util} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Tận dụng" value={Math.round(s.avg_utilization)} suffix="%" tooltip="Trung bình % quota 5h peak mỗi chu kỳ. Càng cao = càng tận dụng tốt subscription." />
            <StatBox label="Đỉnh cao nhất" value={Math.round(s.peak_max)} suffix="%" tooltip="Chu kỳ tận dụng tốt nhất. Cho thấy tiềm năng tối đa." />
            <StatBox label="Chu kỳ đầy" value={`${s.tier_full}/${s.total_sessions}`} tooltip="Chu kỳ đạt ≥80% quota 5h. Mục tiêu: tận dụng tối đa mỗi chu kỳ." />
            <StatBox label="Phí bỏ qua" value={wastedPct} suffix="%" warn={wastedPct >= 50} tooltip={`TB ${wastedPct}% quota 5h chưa dùng mỗi chu kỳ = subscription lãng phí.`} />
          </div>
          <TierBreakdownBar full={s.tier_full} good={s.tier_good} low={s.tier_low} waste={s.tier_waste} total={s.total_sessions} />
        </div>

        {/* ═══ MIDDLE: 2-column grid (mobile stacks) ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ── LEFT: Realtime 5h ── */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border/30 pb-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              Thời gian thực 5h
            </h3>

            {data?.activeSessions && data.activeSessions.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-1">Đang mở ({data.activeSessions.length})</p>
                <div className="space-y-1">
                  {data.activeSessions.map((a, i) => {
                    const idle = formatIdleDuration(a.last_activity_at);
                    return (
                      <div key={i} className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1">
                        <div className="flex items-center gap-1.5 min-w-0 max-w-[55%]">
                          <span className="font-medium truncate">{a.user_name}</span>
                          {idle && <Badge variant="outline" className="text-[8px] h-3.5 px-1 text-muted-foreground shrink-0">Nghỉ {idle}</Badge>}
                        </div>
                        <span className="text-muted-foreground tabular-nums"><b className="text-foreground">{a.delta_5h}%</b> · 7d {a.delta_7d}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <ClosedCyclesSection cycles={data?.sparkline ?? []} />
          </div>

          {/* ── RIGHT: Dự báo 7d + Ranking ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/30 pb-1.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                Dự báo 7d
              </h3>
              <span className="text-[9px] text-muted-foreground tabular-nums">
                S <b className="text-foreground">{s.avg_sonnet_7d.toFixed(1)}%</b>
                <span className="mx-0.5">/</span>
                O <b className={s.avg_opus_7d > s.avg_sonnet_7d ? "text-red-500" : "text-foreground"}>{s.avg_opus_7d.toFixed(1)}%</b>
              </span>
            </div>

            {data?.quota_forecast && (
              <Quota7dForecast seats={data.quota_forecast.seven_day_seats ?? []} />
            )}
          </div>
        </div>

        {/* ═══ BOTTOM: Xếp hạng tận dụng 5h (separate section) ═══ */}
        {data?.perSeat && data.perSeat.length > 0 && (
          <SeatLeaderboard seats={data.perSeat} range={range} />
        )}

      </CardContent>
    </Card>
  );
}
