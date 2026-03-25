"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${url}: ${res.statusText}`);
  return res.json();
}

export function useSchedules() {
  return useQuery<{ schedules: ScheduleEntry[] }>({
    queryKey: ["schedules"],
    queryFn: () => fetchJson("/api/schedules"),
  });
}

export function useSeatsWithUsers() {
  return useQuery<{ seats: SeatWithUsers[] }>({
    queryKey: ["seats"],
    queryFn: () => fetchJson("/api/seats"),
  });
}

export function useAssignSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { seatId: string; userId: string; dayOfWeek: number; slot: string }) =>
      fetchJson("/api/schedules/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });
}

export function useSwapSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      from: { seatId: string; dayOfWeek: number; slot: string };
      to: { seatId: string; dayOfWeek: number; slot: string };
    }) =>
      fetchJson("/api/schedules/swap", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { seatId: string; dayOfWeek: number; slot: string }) =>
      fetchJson("/api/schedules/entry", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });
}

export function useClearAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson("/api/schedules/all", { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });
}
