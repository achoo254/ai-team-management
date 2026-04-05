

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export interface SeatUser { id: string; name: string; email: string; }
export interface SeatOwner { _id: string; name: string; email: string; }
export interface Seat {
  _id: string; email: string; label: string;
  max_users: number; users: SeatUser[];
  owner_id: string | null;
  owner?: SeatOwner | null;
  has_token?: boolean; token_active?: boolean;
  /** When true, seat appears in admin overview / BLD metrics tab. */
  include_in_overview?: boolean;
  last_fetched_at?: string | null; last_fetch_error?: string | null;
}

const KEY = ["seats"];
const AVAILABLE_USERS_KEY = ["seats", "available-users"];

export function useSeats() {
  return useQuery<{ seats: Seat[] }>({ queryKey: KEY, queryFn: () => api.get("/api/seats") });
}

export interface CreateSeatPayload {
  credential_json: string;
  max_users: number;
  label?: string;
  manual_mode?: boolean;
  email?: string;
}

export interface PreviewTokenResponse {
  account: { email: string; full_name: string; has_claude_max: boolean; has_claude_pro: boolean };
  organization: { name: string; organization_type: string; rate_limit_tier: string; subscription_status: string };
  duplicate_seat_id: string | null;
}

export function useCreateSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSeatPayload) => api.post("/api/seats", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Tạo seat thành công"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePreviewSeatToken() {
  return useMutation({
    mutationFn: (credential_json: string) =>
      api.post<PreviewTokenResponse>("/api/seats/preview-token", { credential_json }),
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

/** Active users available for seat assignment — works for all authenticated users */
export function useAvailableUsers() {
  return useQuery<{ users: Array<{ id: string; name: string; email: string; active: boolean; seat_labels: string[] }> }>({
    queryKey: AVAILABLE_USERS_KEY,
    queryFn: () => api.get("/api/seats/available-users"),
  });
}

export function useTransferOwnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seatId, newOwnerId }: { seatId: string; newOwnerId: string }) =>
      api.put(`/api/seats/${seatId}/transfer`, { new_owner_id: newOwnerId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Đã chuyển quyền sở hữu"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Export single seat credential as JSON file download */
export async function exportSeatCredential(seatId: string, seatLabel: string) {
  const data = await api.get(`/api/seats/${seatId}/credentials/export`) as { credentials: Array<Record<string, unknown>> };
  try {
    const blob = new Blob([JSON.stringify(data.credentials, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credential-${seatLabel}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    data.credentials.length = 0;
  }
}

