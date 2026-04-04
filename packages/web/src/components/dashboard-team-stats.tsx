import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardEnhanced, type TeamUsageItem, type DashboardRange } from "@/hooks/use-dashboard";

function UsageBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function pctColor(pct: number): string {
  if (pct >= 80) return "var(--error)";
  if (pct >= 50) return "var(--warning)";
  return "var(--success)";
}

function TeamCard({ team }: { team: TeamUsageItem }) {
  const name = team.team.toUpperCase();
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{name}</span>
          <span className="text-xs text-muted-foreground">
            {team.seat_count} seats · {team.user_count} users
          </span>
        </div>

        {/* 5h usage */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">5h avg</span>
            <span className="font-medium">{team.avg_5h_pct}%</span>
          </div>
          <UsageBar value={team.avg_5h_pct} color={pctColor(team.avg_5h_pct)} />
        </div>

        {/* 7d usage */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">7d avg</span>
            <span className="font-medium">{team.avg_7d_pct}%</span>
          </div>
          <UsageBar value={team.avg_7d_pct} color={pctColor(team.avg_7d_pct)} />
        </div>

        {/* Occupancy rate */}
        <div className="pt-1 border-t text-xs text-muted-foreground">
          Density: {team.user_count > 0 && team.seat_count > 0
            ? `${(team.user_count / team.seat_count).toFixed(1)} users/seat`
            : "—"}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardTeamStats({ range }: { range: DashboardRange }) {
  const { data, isLoading } = useDashboardEnhanced(range);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Team Comparison</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-[160px]" />
          <Skeleton className="h-[160px]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold px-1">Team Comparison</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {(data?.teamUsage ?? []).map((t) => <TeamCard key={t.team} team={t} />)}
      </div>
    </div>
  );
}
