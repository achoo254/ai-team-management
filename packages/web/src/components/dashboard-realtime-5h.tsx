import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEfficiency, type DashboardRange, type SparklinePoint, type ActiveSessionLive } from "@/hooks/use-dashboard";
import { useCardSeatOverride } from "@/hooks/use-card-seat-override";
import { DashboardSeatFilter } from "@/components/dashboard-seat-filter";

const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 min = idle
const CLOSED_DEFAULT_VISIBLE = 3;

/** Format idle duration: "45m" / "2h 10m". Returns null if under threshold. */
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

/** Format window time range: "dd/MM HH:mm–HH:mm" (VN timezone) */
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

/** Active sessions: who is using right now */
function ActiveSessionsList({ sessions }: { sessions: ActiveSessionLive[] }) {
  if (sessions.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground mb-1">Đang mở ({sessions.length})</p>
      <div className="space-y-1">
        {sessions.map((a, i) => {
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
  );
}

/**
 * Recently closed 5h cycles with expand/collapse.
 *
 * Closed = when Claude API's `five_hour_resets_at` changes between snapshots
 * (usage-window-detector.ts) or window_end has passed (safety cron).
 */
function ClosedCyclesSection({ cycles }: { cycles: SparklinePoint[] }) {
  const [expanded, setExpanded] = useState(false);
  const reversed = [...cycles].reverse(); // newest first
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

/** Card showing realtime 5h cycle: active sessions + recently closed cycles */
export function DashboardRealtime5h({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const filter = useCardSeatOverride(seatIds);
  const { data, isLoading, dataUpdatedAt } = useEfficiency(range, filter.effective);
  const filterBtn = <DashboardSeatFilter compact value={filter.effective} onChange={filter.setOverride} isOverride={filter.isOverride} onReset={filter.resetToGlobal} />;

  /** Format dataUpdatedAt to HH:MM (VN timezone) */
  const updatedAtLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })
    : null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Chu kỳ 5h đang diễn ra</CardTitle>
            {filterBtn}
          </div>
        </CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  const activeSessions = data?.activeSessions ?? [];
  const sparkline = data?.sparkline ?? [];
  const hasContent = activeSessions.length > 0 || sparkline.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
              Chu kỳ 5h đang diễn ra
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Sessions active và các chu kỳ vừa đóng ·{" "}
              <span className="font-medium">Realtime{updatedAtLabel ? ` (cập nhật ${updatedAtLabel})` : ""}</span>
            </p>
          </div>
          {filterBtn}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasContent ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Chưa có session nào đang hoạt động
          </p>
        ) : (
          <>
            <ActiveSessionsList sessions={activeSessions} />
            <ClosedCyclesSection cycles={sparkline} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
