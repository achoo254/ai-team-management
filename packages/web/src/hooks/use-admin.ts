import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export interface AdminUser {
  id: string; name: string; email: string; role: "admin" | "user";
  team_ids: string[]; seat_ids?: string[]; active: boolean;
  seat_labels?: string[];
}

const KEY = ["admin", "users"];

export function useAdminUsers() {
  return useQuery<{ users: AdminUser[] }>({ queryKey: KEY, queryFn: () => api.get("/api/admin/users") });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Pick<AdminUser, "name" | "email" | "role" | "team_ids"> & { seat_ids?: string[] }) =>
      api.post("/api/admin/users", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Tạo user thành công"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<AdminUser> & { id: string; seat_ids?: string[] }) =>
      api.put(`/api/admin/users/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Cập nhật thành công"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Đã xoá user"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBulkActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (active: boolean) => api.patch("/api/admin/users/bulk-active", { active }),
    onSuccess: (_, active) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(active ? "Đã kích hoạt tất cả" : "Đã vô hiệu hoá tất cả");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCheckAlerts() {
  return useMutation({
    mutationFn: () => api.post("/api/admin/check-alerts"),
    onSuccess: () => toast.success("Đã kiểm tra alerts"),
    onError: (e: Error) => toast.error(e.message),
  });
}
