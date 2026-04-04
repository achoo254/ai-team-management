
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUsageBySeat } from "@/hooks/use-dashboard";

function pctColor(pct: number | null) {
  if (pct === null) return "text-muted-foreground";
  if (pct >= 80) return "text-red-600 font-semibold";
  if (pct >= 50) return "text-yellow-600 font-semibold";
  return "text-green-600";
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtPct(pct: number | null) {
  return pct !== null ? `${pct}%` : "—";
}

export function UsageTable() {
  const { data, isLoading } = useUsageBySeat();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Chi tiết Usage</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seat</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>5h %</TableHead>
                <TableHead>7d %</TableHead>
                <TableHead>Fetched</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.seats ?? []).map((seat) => (
                <TableRow key={seat.seat_id}>
                  <TableCell className="font-medium">{seat.label}</TableCell>
                  <TableCell>
                    <Badge variant={seat.team?.toLowerCase() === "dev" ? "default" : "secondary"}>
                      {seat.team?.toLowerCase() ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className={pctColor(seat.five_hour_pct)}>
                    {fmtPct(seat.five_hour_pct)}
                  </TableCell>
                  <TableCell className={pctColor(seat.seven_day_pct)}>
                    {fmtPct(seat.seven_day_pct)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(seat.last_fetched_at)}
                  </TableCell>
                </TableRow>
              ))}
              {!data?.seats?.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Chưa có dữ liệu
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
