

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export interface SeatUser { id: string; name: string; email: string; }
export interface Seat {
  _id: string; email: string; label: string; team: string;
  max_users: number; users: SeatUser[];
}

const KEY = ["seats"];

export function useSeats() {
  return useQuery<{ seats: Seat[] }>({ queryKey: KEY, queryFn: () => api.get("/api/seats") });
}

export function useCreateSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<Seat, "_id" | "users">) => api.post("/api/seats", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Tạo seat thành công"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Omit<Seat, "users">> & { id: string }) =>
      api.put(`/api/seats/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Cập nhật thành công"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/seats/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Đã xoá seat"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAssignUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seatId, userId }: { seatId: string; userId: string }) =>
      api.post(`/api/seats/${seatId}/assign`, { userId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Đã gán người dùng"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnassignUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seatId, userId }: { seatId: string; userId: string }) =>
      api.delete(`/api/seats/${seatId}/unassign/${userId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Đã huỷ gán"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
