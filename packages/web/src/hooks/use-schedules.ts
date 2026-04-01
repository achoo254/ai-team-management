import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export interface ScheduleEntry {
  _id: string;
  seat_id: string;
  user_id: string;
  day_of_week: number;
  slot: "morning" | "afternoon";
  user_name: string;
  seat_label: string;
}

export interface SeatWithUsers {
  _id: string;
  email: string;
  label: string;
  team: string;
  max_users: number;
  users: { _id: string; name: string; email: string; team: string }[];
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

export function useAssignSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { seatId: string; userId: string; dayOfWeek: number; slot: string }) =>
      api.post("/api/schedules/assign", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSwapSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      from: { seatId: string; dayOfWeek: number; slot: string };
      to: { seatId: string; dayOfWeek: number; slot: string };
    }) => api.patch("/api/schedules/swap", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { seatId: string; dayOfWeek: number; slot: string }) =>
      api.delete("/api/schedules/entry", body),
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
