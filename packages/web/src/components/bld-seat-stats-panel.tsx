/**
 * BLD Seat Stats Panel
 * 3 actionable seat-level panels: Top Waste, Burndown Risk, Degradation Watch.
 * Top Util removed — redundant (inverse of waste) and not actionable.
 */

import { TrendingDown, Flame, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  SeatWasteEntry,
  BurndownSeat,
  DegradationSeat,
  SeatStatsResponse,
} from "@repo/shared/types";

// ── Sub-cards ─────────────────────────────────────────────────────────────────

function TopWasteCard({ seats }: { seats: SeatWasteEntry[] }) {
  return (
    <Card>
      <CardHeader className="pb-2 space-y-0.5">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <DollarSign className="h-4 w-4 text-red-500" />
          Top 5 lãng phí
        </CardTitle>
        <p className="text-[11px] text-muted-foreground/70 leading-snug">
          Seat dùng ít nhất → mất nhiều tiền nhất. Ứng viên hàng đầu để
          rebalance member. % là chu kỳ quota 7 ngày, $ là chi phí billing
          tháng ước tính lãng phí
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {seats.length === 0 ? (
          <p className="text-xs text-muted-foreground">Chưa có dữ liệu</p>
        ) : (
          seats.map((s) => (
            <div key={s.seatId} className="flex items-center justify-between text-xs">
              <span className="truncate font-medium max-w-[55%]">{s.seatLabel}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-muted-foreground">tuần này: {s.utilPct.toFixed(0)}%</span>
                <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                  ${s.wasteUsd.toFixed(0)}/tháng
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function BurndownCard({ seats }: { seats: BurndownSeat[] }) {
  return (
    <Card>
      <CardHeader className="pb-2 space-y-0.5">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Flame className="h-4 w-4 text-orange-500" />
          Nguy cơ quá tải
        </CardTitle>
        <p className="text-[11px] text-muted-foreground/70 leading-snug">
          Seat liên tục ≥80% quota trong 3 ngày trở lên. Sắp cháy → cần san bớt
          member sang seat khác
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {seats.length === 0 ? (
          <p className="text-xs text-muted-foreground">Không có seat quá tải</p>
        ) : (
          seats.map((s) => (
            <div key={s.seatId} className="flex items-center justify-between text-xs">
              <span className="truncate font-medium max-w-[55%]">{s.seatLabel}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-muted-foreground">{s.latestUtilPct.toFixed(0)}%</span>
                <Badge className="text-xs bg-orange-100 text-orange-700 hover:bg-orange-100">
                  {s.consecutiveDays} ngày
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function DegradationCard({ seats }: { seats: DegradationSeat[] }) {
  return (
    <Card>
      <CardHeader className="pb-2 space-y-0.5">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <TrendingDown className="h-4 w-4 text-amber-500" />
          Theo dõi suy giảm tuần
        </CardTitle>
        <p className="text-[11px] text-muted-foreground/70 leading-snug">
          Seat giảm ≥10pp mức sử dụng so với tuần trước. Member có thể đã rời
          dự án hoặc chuyển sang seat khác
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {seats.length === 0 ? (
          <p className="text-xs text-muted-foreground">Không có seat suy giảm</p>
        ) : (
          seats.map((s) => (
            <div key={s.seatId} className="flex items-center justify-between text-xs">
              <span className="truncate font-medium max-w-[55%]">{s.seatLabel}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground">
                  {s.lastWeekUtilPct.toFixed(0)}% → {s.currentUtilPct.toFixed(0)}%
                </span>
                <Badge variant="outline" className="text-xs text-amber-700 border-amber-200 gap-0.5">
                  ↓{s.dropPp.toFixed(0)}pp
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  data: SeatStatsResponse;
}

export function BldSeatStatsPanel({ data }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <TopWasteCard seats={data.topWaste} />
      <BurndownCard seats={data.burndownRisk} />
      <DegradationCard seats={data.degradationWatch} />
    </div>
  );
}
