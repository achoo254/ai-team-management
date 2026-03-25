"use client";

import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  seatId: string;
  dayOfWeek: number;
  slot: "morning" | "afternoon";
  entry?: { userId: string; userName: string; seatId: string };
  isAdmin: boolean;
  onDelete: (seatId: string, dayOfWeek: number, slot: string) => void;
}

function teamColor(name: string) {
  // Deterministic color from name first char
  const colors = ["bg-blue-100 text-blue-800", "bg-green-100 text-green-800",
    "bg-purple-100 text-purple-800", "bg-orange-100 text-orange-800"];
  return colors[(name.charCodeAt(0) ?? 0) % colors.length];
}

function DraggableEntry({ entry, seatId, dayOfWeek, slot, isAdmin, onDelete }: Props & { entry: NonNullable<Props["entry"]> }) {
  const id = `cell-${seatId}-${dayOfWeek}-${slot}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: !isAdmin,
    data: { type: "cell", seatId, dayOfWeek, slot, userId: entry.userId, userName: entry.userName },
  });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className="group relative flex items-center gap-1 rounded px-1.5 py-1 cursor-grab active:cursor-grabbing select-none">
      <Badge className={`text-xs font-medium truncate max-w-[80px] ${teamColor(entry.userName)}`} variant="outline">
        {entry.userName}
      </Badge>
      {isAdmin && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(seatId, dayOfWeek, slot); }}
          className="hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-red-100 hover:bg-red-200 text-red-600 shrink-0">
          <X size={10} />
        </button>
      )}
    </div>
  );
}

export function ScheduleCell({ seatId, dayOfWeek, slot, entry, isAdmin, onDelete }: Props) {
  const droppableId = `drop-${seatId}-${dayOfWeek}-${slot}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { seatId, dayOfWeek, slot },
  });

  const base = "min-h-[52px] border border-border rounded transition-colors flex items-center justify-center";
  const overCls = isOver ? "bg-primary/10 border-primary" : "bg-muted/30 hover:bg-muted/60";

  return (
    <div ref={setNodeRef} className={`${base} ${overCls}`}>
      {entry ? (
        <DraggableEntry
          seatId={seatId} dayOfWeek={dayOfWeek} slot={slot}
          entry={entry} isAdmin={isAdmin} onDelete={onDelete}
        />
      ) : (
        isAdmin && (
          <span className="text-xs text-muted-foreground opacity-0 hover:opacity-100 transition-opacity">+</span>
        )
      )}
    </div>
  );
}
