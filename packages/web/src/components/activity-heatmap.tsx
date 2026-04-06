import { Fragment } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { HeatmapCell } from "@repo/shared/types";

// Full week: Mon→Sun
const ALL_DAYS = [
  { label: "T2", day: 1 },
  { label: "T3", day: 2 },
  { label: "T4", day: 3 },
  { label: "T5", day: 4 },
  { label: "T6", day: 5 },
  { label: "T7", day: 6 },
  { label: "CN", day: 0 },
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CELL_H = 28;

/** Color by delta intensity (how much 5h% was used in this hour) */
function deltaColor(delta: number, isActive: boolean): string {
  if (!isActive || delta <= 0) return "";
  if (delta <= 2) return "bg-emerald-200/60 dark:bg-emerald-900/40";
  if (delta <= 5) return "bg-emerald-300/70 dark:bg-emerald-700/50";
  if (delta <= 10) return "bg-emerald-400/70 dark:bg-emerald-600/60";
  return "bg-emerald-600/80 dark:bg-emerald-500/70";
}

function deltaLabel(delta: number): string {
  if (delta <= 0) return "Không hoạt động";
  if (delta <= 2) return "Nhẹ";
  if (delta <= 5) return "Trung bình";
  if (delta <= 10) return "Cao";
  return "Rất cao";
}

interface Props {
  data: HeatmapCell[];
  currentDow?: number;
  currentHour?: number;
}

export function ActivityHeatmap({ data, currentDow, currentHour }: Props) {
  const cellMap = new Map<string, HeatmapCell>();
  for (const c of data) cellMap.set(`${c.day_of_week}-${c.hour}`, c);

  return (
    <TooltipProvider delay={200}>
      <div className="overflow-auto">
        <div className="grid gap-0" style={{ gridTemplateColumns: `48px repeat(7, 1fr)` }}>
          {/* Header */}
          <div className="sticky top-0 z-20 bg-background px-1 py-1.5 text-[10px] font-semibold text-muted-foreground border-b" />
          {ALL_DAYS.map((d) => (
            <div key={d.day} className={[
              "sticky top-0 z-20 bg-background px-1 py-1.5 text-center border-b border-l border-border",
              d.day === currentDow ? "font-bold" : "",
              d.day === 0 || d.day === 6 ? "bg-muted/30" : "",
            ].join(" ")}>
              <span className={[
                "text-xs font-semibold",
                d.day === currentDow ? "text-primary" : "text-muted-foreground",
              ].join(" ")}>{d.label}</span>
            </div>
          ))}

          {/* Hour rows */}
          {HOURS.map((hour) => (
            <Fragment key={hour}>
              <div
                className="px-1 text-[10px] text-muted-foreground text-right pr-1.5 border-b border-border flex items-center justify-end"
                style={{ height: `${CELL_H}px` }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
              {ALL_DAYS.map((d) => {
                const key = `${d.day}-${hour}`;
                const cell = cellMap.get(key);
                const isActive = (cell?.activity_rate ?? 0) > 0;
                const delta = cell?.avg_delta ?? 0;
                const isNow = d.day === currentDow && hour === currentHour;
                const isWeekend = d.day === 0 || d.day === 6;
                // Future cells (after current time on current or later days) are dimmed
                const isPast = isCellPast(d.day, hour, currentDow!, currentHour!);

                return (
                  <HeatmapCellEl
                    key={key}
                    cell={cell}
                    delta={delta}
                    isActive={isActive}
                    isNow={isNow}
                    isWeekend={isWeekend}
                    isFuture={!isPast && !isNow}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>

        {/* Legend */}
        <HeatmapLegend />
      </div>
    </TooltipProvider>
  );
}

/** Check if a day+hour is in the past relative to current time */
function isCellPast(day: number, hour: number, currentDow: number, currentHour: number): boolean {
  // Convert to week-linear index (Mon=0 .. Sun=6)
  const toLinear = (d: number) => d === 0 ? 6 : d - 1;
  const cellIdx = toLinear(day) * 24 + hour;
  const nowIdx = toLinear(currentDow) * 24 + currentHour;
  return cellIdx < nowIdx;
}

function HeatmapCellEl({ cell, delta, isActive, isNow, isWeekend, isFuture }: {
  cell?: HeatmapCell;
  delta: number;
  isActive: boolean;
  isNow: boolean;
  isWeekend?: boolean;
  isFuture?: boolean;
}) {
  const bgColor = isActive
    ? deltaColor(delta, true)
    : (isWeekend ? "bg-muted/15" : "");

  const cellDiv = (
    <div
      className={[
        "border-b border-l border-border relative transition-colors",
        bgColor,
        isFuture ? "opacity-40" : "",
        isNow ? "ring-2 ring-inset ring-primary bg-primary/10" : "",
        cell ? "cursor-pointer" : "",
      ].join(" ")}
      style={{ height: `${CELL_H}px` }}
    >
      {isNow && (
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-primary">
          now
        </span>
      )}
    </div>
  );

  if (!cell && !isNow) return cellDiv;

  return (
    <Tooltip>
      <TooltipTrigger>{cellDiv}</TooltipTrigger>
      <TooltipContent side="top" className="!bg-card !text-card-foreground border border-border shadow-xl p-0 overflow-hidden min-w-[200px]">
        {/* Header with day + time range */}
        <div className="px-3 py-1.5 border-b border-border/50 bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-foreground">
              {ALL_DAYS.find((d) => d.day === cell?.day_of_week)?.label ?? ""} · {String(cell?.hour ?? 0).padStart(2, "0")}:00–{String((cell?.hour ?? 0) + 1).padStart(2, "0")}:00
            </span>
            {isNow && (
              <span className="text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">now</span>
            )}
          </div>
        </div>
        <div className="px-3 py-2 space-y-1.5 text-xs">
          {isActive ? (
            <>
              {/* Activity intensity badge */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-block h-2 w-2 rounded-full ${deltaColor(delta, true)}`} />
                <span className="font-medium text-foreground">{deltaLabel(delta)}</span>
              </div>
              {/* Delta avg */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">TB biến động 5h</span>
                <span className="font-semibold tabular-nums text-foreground">{delta.toFixed(1)}%</span>
              </div>
              {/* Delta max */}
              {cell && cell.max_delta > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cao nhất</span>
                  <span className="tabular-nums text-foreground/80">{cell.max_delta.toFixed(1)}%</span>
                </div>
              )}
              {/* Activity rate */}
              {cell && (
                <div className="flex items-center justify-between border-t border-border/40 pt-1.5 mt-1">
                  <span className="text-muted-foreground">Tần suất hoạt động</span>
                  <span className="tabular-nums font-medium text-foreground">{Math.round(cell.activity_rate * 100)}%</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground py-0.5">
              {isFuture ? "Chưa đến giờ này" : "Không ghi nhận hoạt động"}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function HeatmapLegend() {
  const levels = [
    { label: "Không (0%)", color: "bg-muted/30" },
    { label: "Nhẹ (≤2%)", color: "bg-emerald-200/60 dark:bg-emerald-900/40" },
    { label: "TB (2–5%)", color: "bg-emerald-300/70 dark:bg-emerald-700/50" },
    { label: "Cao (5–10%)", color: "bg-emerald-400/70 dark:bg-emerald-600/60" },
    { label: "Rất cao (>10%)", color: "bg-emerald-600/80 dark:bg-emerald-500/70" },
  ];

  return (
    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
      <span>Biến động 5h / 5 phút:</span>
      {levels.map((l) => (
        <div key={l.label} className="flex items-center gap-1">
          <div className={`w-3 h-3 rounded-sm ${l.color} border border-border`} />
          <span>{l.label}</span>
        </div>
      ))}
      <span className="ml-1 text-muted-foreground/50">· Ô mờ = chưa đến</span>
    </div>
  );
}
