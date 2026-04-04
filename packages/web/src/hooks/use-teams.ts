import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export interface TeamCreator {
  _id: string; name: string; email: string;
}

export interface Team {
  _id: string; name: string; label: string; color: string;
  created_by: string; creator?: TeamCreator | null;
  user_count: number; seat_count: number;
  created_at: string;
}

const KEY = ["teams"];

export function useTeams(params?: { owner?: string; mine?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.owner) qs.set("owner", params.owner);
  if (params?.mine) qs.set("mine", "true");
  const suffix = qs.toString() ? `?${qs}` : "";
  return useQuery<{ teams: Team[] }>({
    queryKey: [...KEY, params?.owner ?? "", params?.mine ?? ""],
    queryFn: () => api.get(`/api/teams${suffix}`),
  });
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

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      api.post(`/api/teams/${teamId}/members`, { user_id: userId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Đã thêm thành viên"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      api.delete(`/api/teams/${teamId}/members/${userId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Đã xóa thành viên"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddTeamSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, seatId }: { teamId: string; seatId: string }) =>
      api.post(`/api/teams/${teamId}/seats`, { seat_id: seatId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["seats"] });
      toast.success("Đã thêm seat vào team");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveTeamSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, seatId }: { teamId: string; seatId: string }) =>
      api.delete(`/api/teams/${teamId}/seats/${seatId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["seats"] });
      toast.success("Đã gỡ seat khỏi team");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
