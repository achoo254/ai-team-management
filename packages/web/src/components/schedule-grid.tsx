import { Fragment } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ScheduleCell, ROW_H } from "./schedule-cell";
import type { ScheduleEntry, SeatWithUsers } from "@/hooks/use-schedules";

const WEEKDAYS = [
  { label: "T2", day: 1 },
  { label: "T3", day: 2 },
  { label: "T4", day: 3 },
  { label: "T5", day: 4 },
  { label: "T6", day: 5 },
];

const WEEKEND = [
  { label: "T7", day: 6 },
  { label: "CN", day: 0 },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Props {
  schedules: ScheduleEntry[];
  seats: SeatWithUsers[];
  activeSeatId: string | null;
  canCreate: boolean;
  canEditEntry: (entry: ScheduleEntry) => boolean;
  onDelete: (id: string) => void;
  onEdit: (entry: ScheduleEntry) => void;
  onResize: (entryId: string, newEndHour: number) => void;
  onClickSlot: (dayOfWeek: number, hour: number) => void;
  showWeekend?: boolean;
}

export { WEEKDAYS, WEEKEND };

/** Droppable hour cell wrapper */
function DroppableHourCell({ dayOfWeek, hour, canCreate, isEmpty, onClickSlot, children }: {
  dayOfWeek: number; hour: number; canCreate: boolean; isEmpty: boolean;
  onClickSlot: (d: number, h: number) => void; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${dayOfWeek}-${hour}`,
    data: { type: "hour-slot", dayOfWeek, hour },
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-b border-l border-border relative cursor-pointer transition-colors ${isOver ? "bg-primary/10" : "hover:bg-muted/30"}`}
      style={{ height: `${ROW_H}px` }}
      onClick={() => { if (canCreate && isEmpty) onClickSlot(dayOfWeek, hour); }}
    >
      {children}
      {canCreate && isEmpty && !isOver && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground opacity-0 hover:opacity-100 transition-opacity">+</span>
      )}
    </div>
  );
}

export function ScheduleGrid({ schedules, seats, activeSeatId, canCreate, canEditEntry, onDelete, onEdit, onResize, onClickSlot, showWeekend }: Props) {
  const DAYS = showWeekend ? WEEKEND : WEEKDAYS;

  const seatSchedules = activeSeatId
    ? schedules.filter((s) => s.seat_id === activeSeatId)
    : schedules;

  const dayEntries = new Map<number, ScheduleEntry[]>();
  for (const s of seatSchedules) {
    const list = dayEntries.get(s.day_of_week) ?? [];
    list.push(s);
    dayEntries.set(s.day_of_week, list);
  }

  return (
    <div className="overflow-auto">
      <div className="grid gap-0" style={{ gridTemplateColumns: `48px repeat(${DAYS.length}, 1fr)` }}>
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background px-1 py-1.5 text-[10px] font-semibold text-muted-foreground border-b" />
        {DAYS.map((d) => (
          <div key={d.day} className="sticky top-0 z-20 bg-background px-1 py-1.5 text-center border-b border-l border-border">
            <span className="text-xs font-semibold text-muted-foreground">{d.label}</span>
          </div>
        ))}

        {/* Hour rows */}
        {HOURS.map((hour) => (
          <Fragment key={hour}>
            <div className="px-1 text-[10px] text-muted-foreground text-right pr-1.5 border-b border-border flex items-start pt-0.5"
              style={{ height: `${ROW_H}px` }}>
              {String(hour).padStart(2, "0")}:00
            </div>
            {DAYS.map((d) => {
              const entries = (dayEntries.get(d.day) ?? []).filter(
                (e) => e.start_hour <= hour && e.end_hour > hour,
              );
              const startingEntries = entries.filter((e) => e.start_hour === hour);
              const isEmpty = entries.length === 0;

              return (
                <DroppableHourCell
                  key={`${d.day}-${hour}`}
                  dayOfWeek={d.day}
                  hour={hour}
                  canCreate={canCreate}
                  isEmpty={isEmpty}
                  onClickSlot={onClickSlot}
                >
                  {startingEntries.map((entry) => (
                    <ScheduleCell
                      key={entry._id}
                      entry={entry}
                      span={entry.end_hour - entry.start_hour}
                      canEdit={canEditEntry(entry)}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onResize={onResize}
                    />
                  ))}
                </DroppableHourCell>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
