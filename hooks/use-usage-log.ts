"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export interface UsageLogEntry {
  seatId: string;
  seatEmail: string;
  seatLabel: string;
  team: string;
  weeklyAllPct: number | null;
  weeklySonnetPct: number | null;
  loggedAt?: string | null;
}

export interface WeekLogResponse {
  weekStart: string;
  seats: UsageLogEntry[];
}

// Returns Monday of the given date's week (ISO)
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export function useWeekLog(weekStart: string) {
  return useQuery<WeekLogResponse>({
    queryKey: ["usage-log", weekStart],
    queryFn: () => api.get(`/api/usage-log/week?weekStart=${weekStart}`),
  });
}

export function useBulkLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { weekStart: string; entries: { seatEmail: string; weeklyAllPct: number; weeklySonnetPct: number }[] }) =>
      api.post("/api/usage-log/bulk", body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["usage-log", vars.weekStart] });
      toast.success("Đã lưu usage log");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
