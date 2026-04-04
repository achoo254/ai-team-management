import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced, formatRangeDate, type TeamUsageItem, type DashboardRange } from "@/hooks/use-dashboard";

/* ---------- Color mapping ---------- */

function pctColor(pct: number): string {
  if (pct >= 80) return "var(--error)";
  if (pct >= 50) return "var(--warning)";
  return "var(--success)";
}

/* ---------- Compact usage bar ---------- */

function UsageBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden bg-muted/60">
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

/* ---------- Team row (tabular layout) ---------- */

function TeamRow({ team }: { team: TeamUsageItem }) {
  const name = team.team_name;
  const density = team.user_count > 0 && team.seat_count > 0
    ? (team.user_count / team.seat_count).toFixed(1)
    : "—";

  return (
    <div className="space-y-2.5 py-3 first:pt-0 last:pb-0">
      {/* Header: team name + meta */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-bold tracking-wide">{name}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums truncate">
            {team.seat_count} seat · {team.user_count} người
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          <span className="font-semibold text-foreground/80">{density}</span> người/seat
        </span>
      </div>

      {/* Metrics: 2 column bars */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">TB 5h</span>
            <span className="font-bold tabular-nums" style={{ color: pctColor(team.avg_5h_pct) }}>
              {team.avg_5h_pct}%
            </span>
          </div>
          <UsageBar value={team.avg_5h_pct} color={pctColor(team.avg_5h_pct)} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">TB 7d</span>
            <span className="font-bold tabular-nums" style={{ color: pctColor(team.avg_7d_pct) }}>
              {team.avg_7d_pct}%
            </span>
          </div>
          <UsageBar value={team.avg_7d_pct} color={pctColor(team.avg_7d_pct)} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */

export function DashboardTeamStats({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const { data, isLoading } = useDashboardEnhanced(range, seatIds);

  const teams = data?.teamUsage ?? [];
  const totalSeats = teams.reduce((a, t) => a + t.seat_count, 0);
  const totalUsers = teams.reduce((a, t) => a + t.user_count, 0);

  return (
    <Card className="overflow-hidden h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">So sánh theo Team</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mức dùng trung bình · <span className="font-medium">{formatRangeDate(range)}</span>
            </p>
          </div>
          {!isLoading && teams.length > 0 && (
            <div className="text-[11px] text-muted-foreground text-right shrink-0 tabular-nums">
              <div><span className="font-semibold text-foreground">{totalSeats}</span> seats</div>
              <div><span className="font-semibold text-foreground">{totalUsers}</span> users</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-14 rounded" />
            <Skeleton className="h-14 rounded" />
            <Skeleton className="h-14 rounded" />
          </div>
        ) : teams.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Chưa có dữ liệu</p>
        ) : (
          <div className="divide-y divide-border/40">
            {teams.map((t) => <TeamRow key={t.team_id} team={t} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
