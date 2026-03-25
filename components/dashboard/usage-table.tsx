"use client";

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

function pctColor(pct: number) {
  if (pct >= 80) return "text-red-600 font-semibold";
  if (pct >= 50) return "text-yellow-600 font-semibold";
  return "text-green-600";
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN");
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
                <TableHead>Label</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="hidden sm:table-cell">Users</TableHead>
                <TableHead>All %</TableHead>
                <TableHead className="hidden md:table-cell">Sonnet %</TableHead>
                <TableHead className="hidden lg:table-cell">Last Logged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.seats ?? []).map((seat) => (
                <TableRow key={seat.seat_id}>
                  <TableCell className="font-medium">{seat.label}</TableCell>
                  <TableCell>
                    <Badge variant={seat.team?.toLowerCase() === "dev" ? "default" : "secondary"}>
                      {seat.team?.toUpperCase() ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {seat.users?.length ?? 0}
                  </TableCell>
                  <TableCell className={pctColor(seat.weekly_all_pct ?? 0)}>
                    {seat.weekly_all_pct ?? 0}%
                  </TableCell>
                  <TableCell className={`hidden md:table-cell ${pctColor(seat.weekly_sonnet_pct ?? 0)}`}>
                    {seat.weekly_sonnet_pct ?? 0}%
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {formatDate(seat.last_logged)}
                  </TableCell>
                </TableRow>
              ))}
              {!data?.seats?.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
