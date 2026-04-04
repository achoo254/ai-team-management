import { useRef, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { X, Pencil, GripVertical } from "lucide-react";
import type { ScheduleEntry } from "@/hooks/use-schedules";

// Row height constant — must match schedule-grid.tsx
export const ROW_H = 32;

interface Props {
  entry: ScheduleEntry;
  span: number;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onEdit: (entry: ScheduleEntry) => void;
  onResize?: (entryId: string, newEndHour: number) => void;
}

const COLORS = [
  "bg-blue-100/80 text-blue-900 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700",
  "bg-emerald-100/80 text-emerald-900 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700",
  "bg-violet-100/80 text-violet-900 border-violet-300 dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-700",
  "bg-amber-100/80 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700",
  "bg-rose-100/80 text-rose-900 border-rose-300 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-700",
  "bg-cyan-100/80 text-cyan-900 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-200 dark:border-cyan-700",
];

function userColor(name: string) {
  return COLORS[(name.charCodeAt(0) ?? 0) % COLORS.length];
}

export function ScheduleCell({ entry, span, isAdmin, onDelete, onEdit, onResize }: Props) {
  const heightPx = span * ROW_H;
  const isCompact = span <= 2;
  const resizeRef = useRef<HTMLDivElement>(null);

  // Draggable (admin only)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `entry-${entry._id}`,
    disabled: !isAdmin,
    data: { type: "schedule-entry", entry },
  });

  const style = {
    height: `${heightPx - 3}px`,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  // Resize via mouse drag on bottom handle
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (!isAdmin || !onResize) return;
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    const startEndHour = entry.end_hour;

    function onMove(ev: MouseEvent) {
      const dy = ev.clientY - startY;
      const hourDelta = Math.round(dy / ROW_H);
      const newEnd = Math.max(entry.start_hour + 1, Math.min(24, startEndHour + hourDelta));
      // Visual feedback: update height in real-time via DOM
      const el = resizeRef.current?.parentElement;
      if (el) el.style.height = `${(newEnd - entry.start_hour) * ROW_H - 3}px`;
    }
    function onUp(ev: MouseEvent) {
      const dy = ev.clientY - startY;
      const hourDelta = Math.round(dy / ROW_H);
      const newEnd = Math.max(entry.start_hour + 1, Math.min(24, startEndHour + hourDelta));
      if (newEnd !== startEndHour) onResize?.(entry._id, newEnd);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [entry, isAdmin, onResize]);

  return (
    <div
      ref={setNodeRef}
      className={`absolute inset-x-0.5 top-0.5 z-10 group rounded border px-1.5 py-0.5 overflow-hidden select-none ${userColor(entry.user_name)} ${isAdmin ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
      style={style}
      title={`${entry.user_name} · ${String(entry.start_hour).padStart(2, "0")}:00–${String(entry.end_hour).padStart(2, "0")}:00${entry.usage_budget_pct != null ? ` · Limit ${entry.usage_budget_pct}%` : ""}`}
      {...(isAdmin ? { ...listeners, ...attributes } : {})}
    >
      {isCompact ? (
        <div className="flex items-center justify-between gap-0.5 h-full">
          {isAdmin && <GripVertical size={10} className="shrink-0 opacity-30 group-hover:opacity-70" />}
          <span className="text-[11px] font-semibold truncate flex-1">{entry.user_name}</span>
          <span className="text-[9px] opacity-60 shrink-0">
            {String(entry.start_hour).padStart(2, "0")}–{String(entry.end_hour).padStart(2, "0")}h
            {entry.usage_budget_pct != null && ` · ${entry.usage_budget_pct}%`}
          </span>
          {isAdmin && (
            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
              <button onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
                className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-200 hover:bg-blue-300 text-blue-700">
                <Pencil size={7} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(entry._id); }}
                className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-200 hover:bg-red-300 text-red-700">
                <X size={8} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-0.5">
          <div className="min-w-0 flex-1 flex items-start gap-0.5">
            {isAdmin && <GripVertical size={10} className="shrink-0 opacity-30 group-hover:opacity-70 mt-0.5" />}
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate leading-tight">{entry.user_name}</div>
              <div className="text-[10px] opacity-60 mt-0.5">
                {String(entry.start_hour).padStart(2, "0")}:00–{String(entry.end_hour).padStart(2, "0")}:00
                {entry.usage_budget_pct != null && <span className="ml-1">· Limit {entry.usage_budget_pct}%</span>}
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
              <button onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
                className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-200 hover:bg-blue-300 text-blue-700">
                <Pencil size={8} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(entry._id); }}
                className="flex items-center justify-center w-4 h-4 rounded-full bg-red-200 hover:bg-red-300 text-red-700">
                <X size={9} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Resize handle at bottom edge */}
      {isAdmin && onResize && (
        <div
          ref={resizeRef}
          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-s-resize opacity-0 group-hover:opacity-100 bg-current/20 rounded-b"
          onMouseDown={handleResizeStart}
        />
      )}
    </div>
  );
}
