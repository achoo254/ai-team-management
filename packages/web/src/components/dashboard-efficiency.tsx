import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEfficiency, formatRangeDate, type DashboardRange, type EfficiencyCoverage } from "@/hooks/use-dashboard";
import { useCardSeatOverride } from "@/hooks/use-card-seat-override";
import { DashboardSeatFilter } from "@/components/dashboard-seat-filter";
import { Quota7dForecast } from "@/components/quota-7d-forecast";

const COVERAGE_SHOW_MAX = 5;

/** Banner showing data collection status — truncates long seat lists */
function CoverageBanner({ coverage }: { coverage: EfficiencyCoverage }) {
  const [expanded, setExpanded] = useState(false);
  const labels = coverage.missing_seat_labels ?? [];
  const missingCount = coverage.seats_total - coverage.seats_with_data;
  const showLabels = expanded ? labels : labels.slice(0, COVERAGE_SHOW_MAX);
  const hiddenCount = labels.length - COVERAGE_SHOW_MAX;

  return (
    <div className="text-xs bg-blue-500/10 border border-blue-500/30 rounded px-2 py-1.5 text-blue-700 dark:text-blue-400">
      Đang thu thập dữ liệu: {coverage.seats_with_data}/{coverage.seats_total} seats có ít nhất 1 chu kỳ 5h đã đóng.
      {labels.length > 0 ? (
        <>
          {" "}Chưa có dữ liệu ({missingCount}): <b>{showLabels.join(", ")}</b>
          {!expanded && hiddenCount > 0 && (
            <button onClick={() => setExpanded(true)} className="ml-1 underline hover:text-blue-500 dark:hover:text-blue-300">
              +{hiddenCount} seat khác
            </button>
          )}
          {" "}— cần chờ chu kỳ 5h đầu tiên hoàn tất.
        </>
      ) : (
        <> {missingCount} seat chưa có dữ liệu — cần chờ chu kỳ 5h đầu tiên hoàn tất.</>
      )}
    </div>
  );
}

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

/** Qualitative label for stddev of 5h peaks — translates σ into user-friendly text. */
function VolatilityBadge({ stddev }: { stddev: number }) {
  let label: string;
  let color: string;
  let hint: string;
  if (stddev < 10) {
    label = "Ổn định"; color = "text-emerald-500 border-emerald-500/30";
    hint = "Mức dùng giữa các chu kỳ khá đều nhau — scheduling tốt.";
  } else if (stddev < 25) {
    label = "Dao động vừa"; color = "text-amber-500 border-amber-500/30";
    hint = "Có sự chênh lệch giữa các chu kỳ — một số chu kỳ dùng nhiều, một số ít.";
  } else {
    label = "Thất thường"; color = "text-orange-500 border-orange-500/30";
    hint = "Mức dùng rất không đều — có chu kỳ gần 0% và chu kỳ gần 100%. Cần cải thiện scheduling.";
  }
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border cursor-help ${color}`} title={hint}>
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


export function DashboardEfficiency({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const filter = useCardSeatOverride(seatIds);
  const { data, isLoading } = useEfficiency(range, filter.effective);
  const filterBtn = <DashboardSeatFilter compact value={filter.effective} onChange={filter.setOverride} isOverride={filter.isOverride} onReset={filter.resetToGlobal} />;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Hiệu suất tận dụng</CardTitle>
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
            <CardTitle className="text-base">Hiệu suất tận dụng</CardTitle>
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
          <div>
            <CardTitle className="text-base">Hiệu suất tận dụng</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tổng hợp từ {s.total_sessions} chu kỳ đã đóng · {formatRangeDate(range)}</p>
          </div>
          {filterBtn}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {coverage && coverage.has_data && coverage.seats_with_data < coverage.seats_total && (
          <CoverageBanner coverage={coverage} />
        )}

        {/* ═══ Stats + Tier bar ═══ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
            <span title="Tổng số chu kỳ 5h đã đóng (mỗi chu kỳ = 1 lần Claude reset quota) và tổng giờ sử dụng tương ứng">
              {s.total_sessions} chu kỳ đã đóng · tổng {Math.round(s.total_hours)}h
            </span>
            <div className="flex items-center gap-1" title={`Biên độ sử dụng: thấp nhất ${Math.round(s.peak_min)}%, cao nhất ${Math.round(s.peak_max)}%. Độ lệch chuẩn σ = ${s.stddev_util.toFixed(1)}% — càng cao = càng thất thường.`}>
              <span>Biên độ {Math.round(s.peak_min)}% ↔ {Math.round(s.peak_max)}%</span>
              <VolatilityBadge stddev={s.stddev_util} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="TB tận dụng 5h" value={Math.round(s.avg_utilization)} suffix="%" tooltip="Trung bình % quota 5h đã dùng mỗi chu kỳ. VD: 53% = trung bình mỗi chu kỳ 5h chỉ dùng hết 53% quota. Càng gần 100% = tận dụng subscription tốt hơn." />
            <StatBox label="Peak cao nhất" value={Math.round(s.peak_max)} suffix="%" tooltip="Chu kỳ 5h có % sử dụng cao nhất. Cho thấy tiềm năng tối đa mà team có thể đạt được." />
            <StatBox label="Chu kỳ đầy (≥80%)" value={`${s.tier_full}/${s.total_sessions}`} tooltip={`${s.tier_full} trong ${s.total_sessions} chu kỳ đạt ≥80% quota 5h. Chu kỳ "đầy" = tận dụng gần hết quota, subscription không bị lãng phí.`} />
            <StatBox label="TB phí lãng phí" value={wastedPct} suffix="%" warn={wastedPct >= 50} tooltip={`Trung bình ${wastedPct}% quota 5h không được sử dụng mỗi chu kỳ. VD: 47% = gần nửa subscription đang bị bỏ phí. Quota 5h không dùng sẽ mất khi chu kỳ reset.`} />
          </div>
          <TierBreakdownBar full={s.tier_full} good={s.tier_good} low={s.tier_low} waste={s.tier_waste} total={s.total_sessions} />
        </div>

        {/* ═══ Dự báo 7d ═══ */}
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

        {/* ═══ Xếp hạng tận dụng 5h ═══ */}
        {data?.perSeat && data.perSeat.length > 0 && (
          <SeatLeaderboard seats={data.perSeat} range={range} />
        )}

      </CardContent>
    </Card>
  );
}
