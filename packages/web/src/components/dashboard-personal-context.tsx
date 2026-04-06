import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersonalDashboard, type MyScheduleItem, type MySeatItem } from "@/hooks/use-dashboard.js";

// Format hour as HH:00 string
function fmtHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

// Determine if a schedule slot is current, upcoming (next), or past
function slotStatus(startHour: number, endHour: number): "current" | "next" | "past" | "future" {
  const now = new Date();
  const currentHour = now.getHours();
  if (currentHour >= startHour && currentHour < endHour) return "current";
  if (startHour === currentHour + 1 || (currentHour < startHour && startHour <= currentHour + 2)) return "next";
  if (startHour < currentHour) return "past";
  return "future";
}

function ScheduleList({ items }: { items: MyScheduleItem[] }) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Hôm nay không có lịch</p>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => {
        const status = slotStatus(item.start_hour, item.end_hour);
        return (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className={`text-xs font-mono shrink-0 ${status === "past" ? "text-muted-foreground" : ""}`}>
              {fmtHour(item.start_hour)}–{fmtHour(item.end_hour)}
            </span>
            <span className={`truncate ${status === "past" ? "text-muted-foreground line-through" : ""}`}>
              {item.seat_label}
            </span>
            {status === "current" && (
              <Badge className="text-[10px] px-1 py-0 h-4 shrink-0 bg-success-surface text-success-text border-0">
                Đang chạy
              </Badge>
            )}
            {status === "next" && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">
                Tiếp theo
              </Badge>
            )}
            {item.usage_budget_pct !== null && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {item.usage_budget_pct}%
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SeatList({ items }: { items: MySeatItem[] }) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Chưa tham gia seat nào</p>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((seat) => (
        <li key={seat.seat_id} className="flex items-center gap-2 text-sm">
          <span className="truncate">{seat.label}</span>
          <Badge
            variant={seat.role === "owner" ? "default" : "secondary"}
            className="text-[10px] px-1.5 py-0 h-4 shrink-0"
          >
            {seat.role === "owner" ? "Chủ sở hữu" : "Thành viên"}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function DashboardPersonalContext() {
  const { data, isLoading } = usePersonalDashboard();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Của bạn hôm nay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const rank = data?.myUsageRank;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Của bạn hôm nay</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Lịch, seat và hiệu quả sử dụng cá nhân — <span className="font-medium">chỉ hiển thị dữ liệu hôm nay</span>
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* My Schedule Today */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Lịch hôm nay
            </p>
            <ScheduleList items={data?.mySchedulesToday ?? []} />
          </div>

          {/* My Seats */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Seat của tôi
            </p>
            <SeatList items={data?.mySeats ?? []} />
          </div>

          {/* My Usage Rank */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Hiệu quả sử dụng
            </p>
            {rank ? (
              <div className="space-y-1.5">
                <p className="text-sm">
                  <span className="font-semibold text-base">{rank.rank}</span>
                  <span className="text-muted-foreground">/{rank.total}</span>
                  <span className="text-xs text-muted-foreground ml-1">xếp hạng</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  TB delta 5h:{" "}
                  <span className={`font-medium ${rank.avgDelta5h >= 80 ? "text-error-text" : rank.avgDelta5h >= 50 ? "text-warning-text" : "text-success-text"}`}>
                    {rank.avgDelta5h}%
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
