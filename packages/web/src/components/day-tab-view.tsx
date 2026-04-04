import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { ScheduleEntry, SeatWithUsers } from "@/hooks/use-schedules";

const WEEKDAYS = [
  { label: "Thứ 2", day: 1 },
  { label: "Thứ 3", day: 2 },
  { label: "Thứ 4", day: 3 },
  { label: "Thứ 5", day: 4 },
  { label: "Thứ 6", day: 5 },
];

const WEEKEND_DAYS = [
  { label: "Thứ 7", day: 6 },
  { label: "CN", day: 0 },
];

interface Props {
  schedules: ScheduleEntry[];
  seats: SeatWithUsers[];
  canCreate: boolean;
  canDeleteEntry: (entry: { user_id: string }) => boolean;
  onDelete: (id: string) => void;
  onClickSlot: (dayOfWeek: number, hour: number) => void;
  showWeekend?: boolean;
}

export function DayTabView({ schedules, seats, canCreate, canDeleteEntry, onDelete, onClickSlot, showWeekend }: Props) {
  const DAYS = showWeekend ? WEEKEND_DAYS : WEEKDAYS;
  const defaultTab = showWeekend ? "6" : "1";

  return (
    <div className="lg:hidden">
      <Tabs defaultValue={defaultTab}>
        <TabsList className={`w-full grid mb-4 ${showWeekend ? "grid-cols-2" : "grid-cols-5"}`}>
          {DAYS.map((d) => (
            <TabsTrigger key={d.day} value={String(d.day)} className="text-xs">
              {d.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {DAYS.map((d) => {
          const daySchedules = schedules
            .filter((s) => s.day_of_week === d.day)
            .sort((a, b) => a.start_hour - b.start_hour);

          return (
            <TabsContent key={d.day} value={String(d.day)} className="space-y-3">
              {daySchedules.length === 0 ? (
                <Card>
                  <CardContent className="pt-3 pb-3 px-4">
                    <p className="text-sm text-muted-foreground italic text-center">
                      Chưa có lịch
                      {canCreate && (
                        <button
                          className="ml-2 text-primary underline"
                          onClick={() => onClickSlot(d.day, 8)}
                        >
                          + Tạo mới
                        </button>
                      )}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                daySchedules.map((entry) => (
                  <Card key={entry._id}>
                    <CardContent className="pt-3 pb-3 px-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-xs shrink-0">
                            {String(entry.start_hour).padStart(2, "0")}:00–
                            {String(entry.end_hour).padStart(2, "0")}:00
                          </Badge>
                          <span className="text-sm font-medium truncate">{entry.user_name}</span>
                          {entry.usage_budget_pct != null && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              Limit: {entry.usage_budget_pct}%
                            </span>
                          )}
                        </div>
                        {canDeleteEntry({ user_id: entry.user_id }) && (
                          <button
                            onClick={() => onDelete(entry._id)}
                            className="p-1 rounded hover:bg-red-100 text-red-500 shrink-0"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}

              {/* Quick add button at bottom */}
              {canCreate && daySchedules.length > 0 && (
                <button
                  className="w-full py-2 text-xs text-muted-foreground hover:text-primary border border-dashed border-border rounded-md"
                  onClick={() => onClickSlot(d.day, 8)}
                >
                  + Thêm lịch
                </button>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
