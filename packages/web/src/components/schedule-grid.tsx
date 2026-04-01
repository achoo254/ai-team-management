
import { Fragment } from "react";
import { ScheduleCell } from "./schedule-cell";
import type { ScheduleEntry, SeatWithUsers } from "@/hooks/use-schedules";

const DAYS = [
  { label: "T2 Sáng", day: 1, slot: "morning" },
  { label: "T2 Chiều", day: 1, slot: "afternoon" },
  { label: "T3 Sáng", day: 2, slot: "morning" },
  { label: "T3 Chiều", day: 2, slot: "afternoon" },
  { label: "T4 Sáng", day: 3, slot: "morning" },
  { label: "T4 Chiều", day: 3, slot: "afternoon" },
  { label: "T5 Sáng", day: 4, slot: "morning" },
  { label: "T5 Chiều", day: 4, slot: "afternoon" },
  { label: "T6 Sáng", day: 5, slot: "morning" },
  { label: "T6 Chiều", day: 5, slot: "afternoon" },
] as const;

interface Props {
  schedules: ScheduleEntry[];
  seats: SeatWithUsers[];
  isAdmin: boolean;
  onDelete: (seatId: string, dayOfWeek: number, slot: string) => void;
}

export function ScheduleGrid({ schedules, seats, isAdmin, onDelete }: Props) {
  // Build lookup map
  const lookup = new Map<string, ScheduleEntry>();
  for (const s of schedules) {
    lookup.set(`${s.seat_id}-${s.day_of_week}-${s.slot}`, s);
  }

  return (
    <div>
      <div className="grid" style={{ gridTemplateColumns: `120px repeat(${DAYS.length}, 1fr)` }}>
        {/* Header row */}
        <div className="px-2 py-2 text-xs font-semibold text-muted-foreground">Seat</div>
        {DAYS.map((d) => (
          <div key={`${d.day}-${d.slot}`} className="px-1 py-2 text-xs font-semibold text-center text-muted-foreground border-l border-border">
            {d.label}
          </div>
        ))}
        {/* Seat rows */}
        {seats.map((seat) => (
          <Fragment key={seat._id}>
            <div className="flex items-center px-2 py-1 text-sm font-medium border-t border-border truncate">
              {seat.label}
            </div>
            {DAYS.map((d) => {
              const entry = lookup.get(`${seat._id}-${d.day}-${d.slot}`);
              return (
                <div key={`${seat._id}-${d.day}-${d.slot}`} className="p-1 border-t border-l border-border">
                  <ScheduleCell
                    seatId={seat._id}
                    dayOfWeek={d.day}
                    slot={d.slot}
                    entry={entry ? { userId: entry.user_id, userName: entry.user_name, seatId: entry.seat_id } : undefined}
                    isAdmin={isAdmin}
                    onDelete={onDelete}
                  />
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
