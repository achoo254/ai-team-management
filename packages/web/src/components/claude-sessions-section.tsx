// Claude desktop sessions section for /usage page. Handles filters state,
// seat lookup map, and incremental "Load more" via limit bumping.
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClaudeSessionsFilters } from "@/components/claude-sessions-filters";
import { ClaudeSessionsTable } from "@/components/claude-sessions-table";
import { useClaudeSessions, type ClaudeSessionsFilters as Filters } from "@/hooks/use-claude-sessions";
import { useSeats, type Seat } from "@/hooks/use-seats";

const PAGE_SIZE = 100;
const MAX_LIMIT = 500;

interface Props {
  initialSeatId?: string | null;
}

export function ClaudeSessionsSection({ initialSeatId }: Props) {
  const [limit, setLimit] = useState<number>(PAGE_SIZE);
  const [filters, setFilters] = useState<Filters>(() => ({
    seat_id: initialSeatId || undefined,
  }));

  const { data, isLoading, error } = useClaudeSessions({ ...filters, limit });
  const { data: seatsData } = useSeats();

  const seatMap = useMemo(() => {
    const m = new Map<string, Seat>();
    for (const s of seatsData?.seats ?? []) m.set(s._id, s);
    return m;
  }, [seatsData]);

  const sessions = data?.sessions ?? [];
  const total = data?.total ?? 0;
  const canLoadMore = sessions.length < total && limit < MAX_LIMIT;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Desktop Sessions</CardTitle>
        <CardDescription>
          Claude sessions từ desktop telemetry ({total.toLocaleString("vi-VN")} kết quả)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ClaudeSessionsFilters
          filters={filters}
          onChange={(next) => {
            setFilters(next);
            setLimit(PAGE_SIZE); // reset pagination on filter change
          }}
        />
        {error && <div className="text-sm text-destructive">Lỗi: {error.message}</div>}
        <ClaudeSessionsTable
          sessions={sessions}
          seatMap={seatMap}
          isLoading={isLoading && sessions.length === 0}
        />
        {canLoadMore && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLimit((prev) => Math.min(prev + PAGE_SIZE, MAX_LIMIT))}
              disabled={isLoading}
            >
              Tải thêm ({sessions.length}/{total})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
