

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export interface Alert {
  _id: string;
  seat_id: { _id: string; email: string; label: string } | string;
  type: 'rate_limit' | 'extra_credit' | 'token_failure';
  message: string;
  metadata?: {
    window?: string;
    pct?: number;
    credits_used?: number;
    credits_limit?: number;
    error?: string;
  };
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
}

const KEY = ["alerts"];

export function useAlerts(resolved?: 0 | 1) {
  const param = resolved !== undefined ? `?resolved=${resolved}` : "";
  return useQuery<{ alerts: Alert[] }>({
    queryKey: [...KEY, resolved],
    queryFn: () => api.get(`/api/alerts${param}`),
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/api/alerts/${id}/resolve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Đã đánh dấu xử lý");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
