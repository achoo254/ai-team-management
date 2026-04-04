import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Alert, AlertType } from "@repo/shared/types";

export type { Alert, AlertType };

// Main feed query with optional filters
export function useAlerts(filters?: { type?: string; seat?: string }) {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.seat) params.set("seat", filters.seat);
  const qs = params.toString() ? `?${params}` : "";

  return useQuery<{ alerts: Alert[]; has_more: boolean }>({
    queryKey: ["alerts", filters],
    queryFn: () => api.get(`/api/alerts${qs}`),
  });
}

// Unread count for bell badge
export function useUnreadAlertCount() {
  return useQuery<{ count: number }>({
    queryKey: ["alerts", "unread-count"],
    queryFn: () => api.get("/api/alerts/unread-count"),
    refetchInterval: 60_000,
  });
}

// Mark alerts as read
export function useMarkAlertsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertIds: string[]) =>
      api.post("/api/alerts/mark-read", { alert_ids: alertIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}
