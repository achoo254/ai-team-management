import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export interface ScheduleEntry {
  _id: string;
  seat_id: string;
  user_id: string;
  day_of_week: number;
  start_hour: number;
  end_hour: number;
  usage_budget_pct: number | null;
  user_name: string;
  seat_label: string;
}

export interface SeatWithUsers {
  _id: string;
  email: string;
  label: string;
  team_id: string | null;
  team?: { _id: string; name: string; label: string; color: string } | null;
  max_users: number;
  owner_id: string | null;
  users: { _id: string; name: string; email: string }[];
}

export function useSchedules() {
  return useQuery<{ schedules: ScheduleEntry[] }>({
    queryKey: ["schedules"],
    queryFn: () => api.get("/api/schedules"),
  });
}

export function useSeatsWithUsers() {
  return useQuery<{ seats: SeatWithUsers[] }>({
    queryKey: ["seats"],
    queryFn: () => api.get("/api/seats"),
  });
}

export function useCreateScheduleEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      seatId: string;
      userId: string;
      dayOfWeek: number;
      startHour: number;
      endHour: number;
      usageBudgetPct?: number | null;
    }) => api.post("/api/schedules/entry", body),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      if (data?.warnings?.length) {
        toast.warning("Có trùng lịch với entry khác");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateScheduleEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id: string;
      dayOfWeek?: number;
      startHour?: number;
      endHour?: number;
      usageBudgetPct?: number | null;
      userId?: string;
    }) => api.put(`/api/schedules/entry/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/schedules/entry/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSwapSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { fromId: string; toId?: string; dayOfWeek?: number; startHour?: number; endHour?: number; seatId?: string }) =>
      api.patch("/api/schedules/swap", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useClearAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/api/schedules/all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
