import { AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BldFleetDeltaCards } from "@/components/bld-fleet-delta-cards";
import type { FleetKpis } from "@repo/shared/types";

interface Props {
  kpis: FleetKpis;
}

function utilColor(pct: number): string {
  if (pct >= 70) return "text-green-600";
  if (pct >= 50) return "text-amber-500";
  return "text-red-500";
}

function utilBgColor(pct: number): string {
  if (pct >= 70) return "bg-green-500";
  if (pct >= 50) return "bg-amber-400";
  return "bg-red-500";
}

export function BldFleetKpiCards({ kpis }: Props) {
  const {
    utilPct, cycleUtilPct, lastCycleUtilPct, cyclesConsidered,
    wasteUsd, projectedUtilPct, wwDelta, ddDelta, totalCostUsd,
    billableCount, worstForecast, exhaustedSeatCount,
    staleSeatCount, noDataSeatCount,
  } = kpis;
  const exhaustedBadge = exhaustedSeatCount > 0 ? (
    <p className="mt-1 text-[11px] text-red-500/90">
      {exhaustedSeatCount} seat đã đầy quota
    </p>
  ) : null;
  const missingSeats = staleSeatCount + noDataSeatCount;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {/* Fleet Utilization — completed cycles */}
      <Card>
        <CardHeader className="pb-2 space-y-0.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Mức sử dụng đội seat
          </CardTitle>
          <p className="text-[11px] text-muted-foreground/70 leading-snug">
            TB quota dùng hết trong {cyclesConsidered || "các"} chu kỳ đã kết
            thúc. Càng cao = seat càng khai thác hiệu quả
          </p>
        </CardHeader>
        <CardContent>
          {cycleUtilPct != null ? (
            <>
              <div className={`text-3xl font-bold ${utilColor(cycleUtilPct)}`}>
                {cycleUtilPct.toFixed(1)}%
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                <div
                  className={`h-1.5 rounded-full transition-all ${utilBgColor(cycleUtilPct)}`}
                  style={{ width: `${Math.min(cycleUtilPct, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {lastCycleUtilPct != null
                  ? `Chu kỳ gần nhất ${lastCycleUtilPct.toFixed(0)}% · `
                  : ""}
                {billableCount} seat active
              </p>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-muted-foreground">—</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Chưa đủ một chu kỳ hoàn tất
              </p>
            </>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            Chu kỳ đang chạy: đã dùng {utilPct.toFixed(0)}%
            {projectedUtilPct != null
              ? `, dự kiến đạt ${projectedUtilPct.toFixed(0)}%`
              : ""}
          </p>
        </CardContent>
      </Card>

      {/* Waste $ */}
      <Card>
        <CardHeader className="pb-2 space-y-0.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Lãng phí / tháng
          </CardTitle>
          <p className="text-[11px] text-muted-foreground/70 leading-snug">
            Phần quota đã trả tiền nhưng không dùng hết trong các chu kỳ đã kết
            thúc
          </p>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">
            {wasteUsd != null ? `$${wasteUsd.toFixed(0)}` : "—"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            trên ${totalCostUsd.toFixed(0)} tổng chi phí
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {missingSeats > 0
              ? `${missingSeats} seat thiếu dữ liệu, chưa tính vào`
              : "có thể thu hồi qua rebalance member"}
          </p>
        </CardContent>
      </Card>

      <BldFleetDeltaCards wwDelta={wwDelta} ddDelta={ddDelta} />

      {/* Worst Forecast */}
      <Card>
        <CardHeader className="pb-2 space-y-0.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Nguy cơ hết quota
          </CardTitle>
          <p className="text-[11px] text-muted-foreground/70 leading-snug">
            Seat sẽ đầy quota 7 ngày sớm nhất theo đà dùng hiện tại. Càng ít
            ngày = càng gấp
          </p>
        </CardHeader>
        <CardContent>
          {worstForecast && worstForecast.hours_to_full != null && worstForecast.hours_to_full > 0 ? (
            <>
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span className="text-xl font-bold">
                  {worstForecast.hours_to_full < 24
                    ? `${worstForecast.hours_to_full.toFixed(0)}h`
                    : `${(worstForecast.hours_to_full / 24).toFixed(1)} ngày nữa đầy`}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {worstForecast.seat_label}
              </p>
              {exhaustedBadge}
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 text-green-600">
                <Clock className="h-5 w-5" />
                <span className="text-sm font-medium">Không có rủi ro sắp tới</span>
              </div>
              {exhaustedBadge}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
