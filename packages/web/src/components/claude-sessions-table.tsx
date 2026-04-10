// Renders Claude desktop sessions with seat lookup.
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClaudeSession } from "@/hooks/use-claude-sessions";
import type { Seat } from "@/hooks/use-seats";

function formatNumber(n: number): string {
  return n.toLocaleString("vi-VN");
}

function formatDuration(startedAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remain = mins % 60;
  return `${hours}h${remain > 0 ? ` ${remain}m` : ""}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function modelBadgeClass(model: string): string {
  if (model.includes("opus")) return "bg-purple-600 hover:bg-purple-600";
  if (model.includes("sonnet")) return "bg-blue-600 hover:bg-blue-600";
  if (model.includes("haiku")) return "bg-emerald-600 hover:bg-emerald-600";
  return "bg-slate-600 hover:bg-slate-600";
}

interface Props {
  sessions: ClaudeSession[];
  seatMap: Map<string, Seat>;
  isLoading?: boolean;
}

export function ClaudeSessionsTable({ sessions, seatMap, isLoading }: Props) {
  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Đang tải...</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Chưa có session nào. Cài Desktop App và kết nối device để bắt đầu tracking.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bắt đầu</TableHead>
            <TableHead>Seat</TableHead>
            <TableHead>Profile</TableHead>
            <TableHead>Model</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead className="text-right">Input</TableHead>
            <TableHead className="text-right">Output</TableHead>
            <TableHead className="text-right">Cache R/W</TableHead>
            <TableHead className="text-right">Msgs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((s) => {
            const seat = s.seat_id ? seatMap.get(s.seat_id) : undefined;
            const seatLabel = seat ? seat.label || seat.email : s.seat_id ? "Unknown seat" : "—";
            const profileMismatch = seat && seat.email !== s.profile_email;
            return (
              <TableRow key={s._id || s.session_id}>
                <TableCell
                  className="text-xs whitespace-nowrap"
                  title={new Date(s.started_at).toLocaleString("vi-VN")}
                >
                  {formatDateTime(s.started_at)}
                </TableCell>
                <TableCell className="text-sm">{seatLabel}</TableCell>
                <TableCell className="text-xs font-mono">
                  {profileMismatch ? (
                    <span className="text-amber-600" title="Profile email khác seat email">
                      {s.profile_email}
                    </span>
                  ) : (
                    s.profile_email
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={modelBadgeClass(s.model)}>{s.model}</Badge>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatDuration(s.started_at, s.ended_at)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatNumber(s.total_input_tokens)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatNumber(s.total_output_tokens)}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                  {formatNumber(s.total_cache_read)} / {formatNumber(s.total_cache_write)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{s.message_count}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
