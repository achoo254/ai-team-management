import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCardSeatOverride } from "@/hooks/use-card-seat-override";
import { DashboardSeatFilter } from "@/components/dashboard-seat-filter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDashboardEnhanced, formatRangeDate, type SeatUsageItem, type DashboardRange } from "@/hooks/use-dashboard";
import { formatResetTime } from "@/lib/format-reset";

type SortKey = "label" | "five_hour_pct" | "seven_day_pct" | "seven_day_sonnet_pct" | "seven_day_opus_pct" | "user_count";

function pctCell(pct: number | null, resetsAt?: string | null) {
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  const color = pct >= 80 ? "text-error-text font-semibold" : pct >= 50 ? "text-warning-text font-semibold" : "text-success-text";
  const inner = <span className={color}>{pct}%</span>;
  if (resetsAt === undefined) return inner;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-help">{inner}</span>} />
      <TooltipContent>Reset: {formatResetTime(resetsAt).label}</TooltipContent>
    </Tooltip>
  );
}

function occupancyBadge(count: number, max: number) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  const variant = pct >= 100 ? "destructive" : pct >= 67 ? "default" : "secondary";
  return <Badge variant={variant}>{count}/{max}</Badge>;
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function sortSeats(seats: SeatUsageItem[], key: SortKey, asc: boolean): SeatUsageItem[] {
  return [...seats].sort((a, b) => {
    let va: number | string, vb: number | string;
    if (key === "label") { va = a.label; vb = b.label; }
    else if (key === "user_count") { va = a.user_count; vb = b.user_count; }
    else { va = a[key] ?? -1; vb = b[key] ?? -1; }
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
}

export function DashboardDetailTable({ range, seatIds }: { range: DashboardRange; seatIds?: string[] }) {
  const filter = useCardSeatOverride(seatIds);
  const { data, isLoading } = useDashboardEnhanced(range, filter.effective);
  const [sortKey, setSortKey] = useState<SortKey>("seven_day_pct");
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  const arrow = (key: SortKey) => sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  const seats = sortSeats(data?.usagePerSeat ?? [], sortKey, sortAsc);
  const overBudgetMap = new Map(
    (data?.overBudgetSeats ?? []).map((b) => [b.seat_id, b]),
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">Chi tiết sử dụng — Tất cả Seat</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bảng tổng hợp mức dùng 5 giờ, 7 ngày, và phân tách theo model · <span className="font-medium">{formatRangeDate(range)}</span>
            </p>
          </div>
          <DashboardSeatFilter compact value={filter.effective} onChange={filter.setOverride} isOverride={filter.isOverride} onReset={filter.resetToGlobal} />
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("label")}>
                  Seat{arrow("label")}
                </TableHead>
                <TableHead>Thành viên</TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("five_hour_pct")}>
                  5h %{arrow("five_hour_pct")}
                </TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("seven_day_pct")}>
                  7d %{arrow("seven_day_pct")}
                </TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("seven_day_sonnet_pct")}>
                  Sonnet{arrow("seven_day_sonnet_pct")}
                </TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("seven_day_opus_pct")}>
                  Opus{arrow("seven_day_opus_pct")}
                </TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead>Cập nhật</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seats.map((s) => (
                <TableRow key={s.seat_id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {s.label}
                      {overBudgetMap.has(s.seat_id) && (
                        <Badge variant="destructive" className="text-[10px] px-1 py-0">
                          VƯỢT HẠN MỨC
                        </Badge>
                      )}
                    </div>
                    {/* Owner name shown as subtitle under seat label */}
                    {s.owner_name && (
                      <span className="flex items-center gap-1 mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-normal">
                          chủ
                        </Badge>
                        <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                          {s.owner_name}
                        </span>
                      </span>
                    )}
                    {s.users.length > 0 && (
                      <span className="block text-[11px] text-muted-foreground truncate max-w-[180px] mt-0.5">
                        {s.users.join(", ")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{occupancyBadge(s.user_count, s.max_users)}</TableCell>
                  <TableCell className="text-right">{pctCell(s.five_hour_pct, s.five_hour_resets_at)}</TableCell>
                  <TableCell className="text-right">{pctCell(s.seven_day_pct, s.seven_day_resets_at)}</TableCell>
                  <TableCell className="text-right">{pctCell(s.seven_day_sonnet_pct)}</TableCell>
                  <TableCell className="text-right">{pctCell(s.seven_day_opus_pct)}</TableCell>
                  <TableCell className="text-right text-xs">
                    {s.extra_usage?.is_enabled
                      ? `$${s.extra_usage.used_credits ?? 0}/${s.extra_usage.monthly_limit ?? "∞"}`
                      : <span className="text-muted-foreground">off</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(s.last_fetched_at)}
                  </TableCell>
                </TableRow>
              ))}
              {!seats.length && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
