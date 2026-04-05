import { Fragment } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { HeatmapCell } from "@repo/shared/types";
import type { SchedulePattern } from "@/hooks/use-activity-schedule";

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

function activityColor(rate: number): string {
  if (rate <= 0) return "bg-transparent";
  if (rate <= 0.25) return "bg-emerald-100 dark:bg-emerald-900/40";
  if (rate <= 0.5) return "bg-emerald-300 dark:bg-emerald-700/60";
  if (rate <= 0.75) return "bg-emerald-500 dark:bg-emerald-500/70";
  return "bg-emerald-700 dark:bg-emerald-400";
}

function activityLabel(rate: number): string {
  if (rate <= 0) return "Không có dữ liệu";
  if (rate <= 0.25) return "Ít hoạt động";
  if (rate <= 0.5) return "Trung bình";
  if (rate <= 0.75) return "Hoạt động nhiều";
  return "Rất tích cực";
}

interface Props {
  data: HeatmapCell[];
  patterns: SchedulePattern[];
  currentDow?: number;
  currentHour?: number;
  isCurrentlyActive?: boolean;
}

export function ActivityHeatmap({ data, patterns, currentDow, currentHour, isCurrentlyActive }: Props) {
  const cellMap = new Map<string, HeatmapCell>();
  for (const c of data) cellMap.set(`${c.day_of_week}-${c.hour}`, c);

  // Build pattern set for dotted-border overlay
  const patternSet = new Set<string>();
  for (const p of patterns) {
    for (let h = p.start_hour; h < p.end_hour; h++) {
      patternSet.add(`${p.day_of_week}-${h}`);
    }
  }

  return (
    <TooltipProvider delay={200}>
      <div className="overflow-auto">
        <div className="grid gap-0" style={{ gridTemplateColumns: `48px repeat(7, 1fr)` }}>
          {/* Header */}
          <div className="sticky top-0 z-20 bg-background px-1 py-1.5 text-[10px] font-semibold text-muted-foreground border-b" />
          {ALL_DAYS.map((d) => (
            <div key={d.day} className={[
              "sticky top-0 z-20 bg-background px-1 py-1.5 text-center border-b border-l border-border",
              d.day === 0 || d.day === 6 ? "bg-muted/30" : "",
            ].join(" ")}>
              <span className="text-xs font-semibold text-muted-foreground">{d.label}</span>
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
                const rate = cell?.activity_rate ?? 0;
                const isPattern = patternSet.has(key);
                const isNow = d.day === currentDow && hour === currentHour;
                const isWeekend = d.day === 0 || d.day === 6;

                return (
                  <HeatmapCellEl
                    key={key}
                    cell={cell}
                    rate={rate}
                    isPattern={isPattern}
                    isNow={isNow}
                    isCurrentlyActive={isNow && isCurrentlyActive}
                    isWeekend={isWeekend}
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

function HeatmapCellEl({ cell, rate, isPattern, isNow, isCurrentlyActive, isWeekend }: {
  cell?: HeatmapCell;
  rate: number;
  isPattern: boolean;
  isNow: boolean;
  isCurrentlyActive?: boolean;
  isWeekend?: boolean;
}) {
  const cellDiv = (
    <div
      className={[
        "border-b border-l border-border relative cursor-pointer transition-colors",
        rate > 0 ? activityColor(rate) : (isWeekend ? "bg-muted/20" : "bg-transparent"),
        isPattern ? "ring-1 ring-inset ring-dashed ring-emerald-600/50" : "",
        isNow ? "ring-2 ring-inset ring-primary" : "",
      ].join(" ")}
      style={{ height: `${CELL_H}px` }}
    >
      {isCurrentlyActive && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      )}
    </div>
  );

  if (!cell) return cellDiv;

  return (
    <Tooltip>
      <TooltipTrigger>{cellDiv}</TooltipTrigger>
      <TooltipContent className="text-xs space-y-0.5" side="top">
        <p className="font-medium">{activityLabel(rate)}</p>
        <p>Tỷ lệ: <strong>{(rate * 100).toFixed(0)}%</strong> · TB: {cell.avg_delta.toFixed(1)}% · Max: {cell.max_delta.toFixed(1)}%</p>
        {isPattern && <p className="text-emerald-400">Pattern dự đoán</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function HeatmapLegend() {
  const levels = [
    { label: "Không", color: "bg-muted" },
    { label: "Ít", color: "bg-emerald-100 dark:bg-emerald-900/40" },
    { label: "TB", color: "bg-emerald-300 dark:bg-emerald-700/60" },
    { label: "Nhiều", color: "bg-emerald-500 dark:bg-emerald-500/70" },
    { label: "Cao", color: "bg-emerald-700 dark:bg-emerald-400" },
  ];

  return (
    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
      <span>Mức hoạt động:</span>
      {levels.map((l) => (
        <div key={l.label} className="flex items-center gap-1">
          <div className={`w-3 h-3 rounded-sm ${l.color} border border-border`} />
          <span>{l.label}</span>
        </div>
      ))}
      <span className="ml-2">┊</span>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded-sm border border-dashed border-emerald-600/50" />
        <span>Pattern</span>
      </div>
    </div>
  );
}
