import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

interface WatchThresholds {
  threshold_5h_pct?: number;
  threshold_7d_pct?: number;
  burn_rate_threshold?: number | null;
  eta_warning_hours?: number | null;
  forecast_warning_hours?: number | null;
}

export function useWatchSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { seat_id: string } & WatchThresholds) =>
      api.post("/api/user/watched-seats", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-settings"] });
      toast.success("Đã theo dõi seat");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateWatchedSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seatId, ...body }: { seatId: string } & WatchThresholds) =>
      api.put(`/api/user/watched-seats/${seatId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-settings"] });
      toast.success("Đã cập nhật ngưỡng");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnwatchSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (seatId: string) => api.delete(`/api/user/watched-seats/${seatId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-settings"] });
      toast.success("Đã huỷ theo dõi");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
