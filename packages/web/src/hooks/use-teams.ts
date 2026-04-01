

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export interface Team {
  _id: string; name: string; label: string; color: string;
  user_count: number; seat_count: number;
}

const KEY = ["teams"];

export function useTeams() {
  return useQuery<{ teams: Team[] }>({ queryKey: KEY, queryFn: () => api.get("/api/teams") });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Pick<Team, "name" | "label" | "color">) => api.post("/api/teams", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Tạo team thành công"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; label?: string; color?: string }) =>
      api.put(`/api/teams/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Cập nhật thành công"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/teams/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Đã xoá team"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
