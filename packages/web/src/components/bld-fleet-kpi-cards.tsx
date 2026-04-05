import { TrendingUp, TrendingDown, Minus, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function wwDeltaIcon(delta: number) {
  if (delta > 0.5) return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (delta < -0.5) return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function wwDeltaColor(delta: number): string {
  if (delta > 0.5) return "text-green-600";
  if (delta < -0.5) return "text-red-500";
  return "text-muted-foreground";
}

export function BldFleetKpiCards({ kpis }: Props) {
  const { utilPct, wasteUsd, wwDelta, totalCostUsd, billableCount, worstForecast } = kpis;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {/* Fleet Utilization */}
      <Card>
        <CardHeader className="pb-2 space-y-0.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Mức sử dụng đội seat
          </CardTitle>
          <p className="text-[11px] text-muted-foreground/70 leading-snug">
            TB quota 7 ngày của tất cả seat công ty. Càng cao = seat càng khai
            thác hiệu quả
          </p>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${utilColor(utilPct)}`}>
            {utilPct.toFixed(1)}%
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
            <div
              className={`h-1.5 rounded-full transition-all ${utilBgColor(utilPct)}`}
              style={{ width: `${Math.min(utilPct, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {billableCount} seat công ty · 70%+ khoẻ · dưới 50% là kém
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
            Phần chi phí không dùng tới. = (100% − mức sử dụng) × tổng chi phí
          </p>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">
            ${wasteUsd.toFixed(0)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            trên ${totalCostUsd.toFixed(0)} tổng chi phí
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            có thể thu hồi qua rebalance member
          </p>
        </CardContent>
      </Card>

      {/* W/W Delta */}
      <Card>
        <CardHeader className="pb-2 space-y-0.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Thay đổi tuần
          </CardTitle>
          <p className="text-[11px] text-muted-foreground/70 leading-snug">
            Chênh lệch mức sử dụng so với 7 ngày trước. Dương = tăng, âm = giảm
          </p>
        </CardHeader>
        <CardContent>
          <div
            className={`flex items-center gap-1 text-3xl font-bold ${wwDeltaColor(wwDelta)}`}
          >
            {wwDeltaIcon(wwDelta)}
            <span>
              {wwDelta >= 0 ? "+" : ""}
              {wwDelta.toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {wwDelta > 0.5
              ? "Đội đang dùng nhiều hơn tuần trước"
              : wwDelta < -0.5
                ? "Đội đang dùng ít hơn tuần trước"
                : "Mức sử dụng ổn định"}
          </p>
        </CardContent>
      </Card>

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
          {worstForecast && worstForecast.hours_to_full != null ? (
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
            </>
          ) : (
            <div className="flex items-center gap-1 text-green-600">
              <Clock className="h-5 w-5" />
              <span className="text-sm font-medium">Không có rủi ro</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
