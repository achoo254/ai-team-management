import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { HeatmapCell, RealtimeStatus } from "@repo/shared/types";

export interface SchedulePattern {
  _id: string;
  seat_id: string;
  seat_label: string;
  day_of_week: number;
  start_hour: number;
  end_hour: number;
  source: "auto" | "legacy";
}

export interface SeatWithUsers {
  _id: string;
  email: string;
  label: string;
  max_users: number;
  owner_id: string | null;
  users: { _id: string; name: string; email: string }[];
}

export function useSchedulePatterns(seatId?: string | null) {
  return useQuery<{ schedules: SchedulePattern[] }>({
    queryKey: ["schedules", seatId],
    queryFn: () => api.get(seatId ? `/api/schedules?seatId=${seatId}` : "/api/schedules"),
  });
}

export function useActivityHeatmap(seatId: string | null, weeks = 4) {
  return useQuery<{ data: HeatmapCell[] }>({
    queryKey: ["activity-heatmap", seatId, weeks],
    queryFn: () => api.get(`/api/schedules/heatmap/${seatId}?weeks=${weeks}`),
    enabled: !!seatId,
  });
}

export function useRealtimeStatus() {
  return useQuery<{ seats: RealtimeStatus[] }>({
    queryKey: ["realtime-status"],
    queryFn: () => api.get("/api/schedules/realtime"),
    refetchInterval: 60_000, // poll every 60s
  });
}

export function useSeatsWithUsers() {
  return useQuery<{ seats: SeatWithUsers[] }>({
    queryKey: ["seats"],
    queryFn: () => api.get("/api/seats"),
  });
}
