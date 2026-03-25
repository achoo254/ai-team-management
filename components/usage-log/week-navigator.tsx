"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  weekStart: string;
  onChange: (weekStart: string) => void;
}

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function formatWeek(dateStr: string): string {
  const start = new Date(dateStr);
  const end = new Date(dateStr);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  return `${fmt(start)} – ${fmt(end)} (${start.getFullYear()})`;
}

export function WeekNavigator({ weekStart, onChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <Button size="icon" variant="outline" onClick={() => onChange(addWeeks(weekStart, -1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium min-w-44 text-center">{formatWeek(weekStart)}</span>
      <Button size="icon" variant="outline" onClick={() => onChange(addWeeks(weekStart, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
