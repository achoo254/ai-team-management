import { TrendingUp, TrendingDown, Minus, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  /** Completed cycle vs the one before it, in percentage points. */
  wwDelta: number | null;
  /** Today's avg peak 5h vs yesterday's, in percentage points. */
  ddDelta: number | null;
}

function deltaIcon(delta: number) {
  if (delta > 0.5) return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (delta < -0.5) return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function deltaColor(delta: number): string {
  if (delta > 0.5) return "text-green-600";
  if (delta < -0.5) return "text-red-500";
  return "text-muted-foreground";
}

/** Both values are differences between two percentages, so the unit is
 *  percentage points — labelling them "%" would read as a relative change. */
export function BldFleetDeltaCards({ wwDelta, ddDelta }: Props) {
  return (
    <>
      <Card>
        <CardHeader className="pb-2 space-y-0.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Thay đổi chu kỳ
          </CardTitle>
          <p className="text-[11px] text-muted-foreground/70 leading-snug">
            Chu kỳ vừa kết thúc so với chu kỳ trước đó. Dương = tăng, âm = giảm
          </p>
        </CardHeader>
        <CardContent>
          {wwDelta != null ? (
            <>
              <div className={`flex items-center gap-1 text-3xl font-bold ${deltaColor(wwDelta)}`}>
                {deltaIcon(wwDelta)}
                <span>
                  {wwDelta >= 0 ? "+" : ""}
                  {wwDelta.toFixed(1)} điểm %
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {wwDelta > 0.5
                  ? "Đội dùng nhiều hơn chu kỳ trước"
                  : wwDelta < -0.5
                    ? "Đội dùng ít hơn chu kỳ trước"
                    : "Mức sử dụng ổn định"}
              </p>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-muted-foreground">—</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Cần 2 chu kỳ hoàn tất để so sánh
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 space-y-0.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Thay đổi ngày
          </CardTitle>
          <p className="text-[11px] text-muted-foreground/70 leading-snug">
            So sánh peak 5h trung bình hôm nay với hôm qua. Phản ứng nhanh trong ngày
          </p>
        </CardHeader>
        <CardContent>
          {ddDelta != null ? (
            <>
              <div className={`flex items-center gap-1 text-3xl font-bold ${deltaColor(ddDelta)}`}>
                <CalendarClock className="h-4 w-4" />
                <span>
                  {ddDelta >= 0 ? "+" : ""}
                  {ddDelta.toFixed(1)} điểm %
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {ddDelta > 5
                  ? "Hôm nay dùng nhiều hơn hẳn"
                  : ddDelta < -5
                    ? "Hôm nay nhẹ hơn hôm qua"
                    : "Tương đương hôm qua"}
              </p>
            </>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground">
              <CalendarClock className="h-5 w-5" />
              <span className="text-sm font-medium">Chưa đủ dữ liệu</span>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
