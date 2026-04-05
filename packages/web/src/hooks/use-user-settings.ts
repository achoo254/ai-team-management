import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { NotificationSettings, UserAlertSettings, WatchedSeat } from "@repo/shared/types";

export interface AvailableSeat {
  _id: string;
  label: string;
  email: string;
}

export interface UserSettings {
  telegram_chat_id: string | null;
  telegram_topic_id: string | null;
  has_telegram_bot: boolean;
  watched_seats: WatchedSeat[];
  notification_settings: NotificationSettings | null;
  alert_settings: UserAlertSettings | null;
  push_enabled: boolean;
  dashboard_filter_seat_ids: string[];
  dashboard_default_range: import("@/hooks/use-dashboard").DashboardRange;
  available_seats: AvailableSeat[];
}

export function useUserSettings() {
  return useQuery<UserSettings>({
    queryKey: ["user-settings"],
    queryFn: () => api.get("/api/user/settings"),
  });
}

export function useUpdateUserSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      telegram_bot_token?: string | null;
      telegram_chat_id?: string | null;
      telegram_topic_id?: string | null;
      notification_settings?: NotificationSettings;
      alert_settings?: UserAlertSettings;
      push_enabled?: boolean;
      dashboard_filter_seat_ids?: string[];
      dashboard_default_range?: import("@/hooks/use-dashboard").DashboardRange;
    }) => api.put("/api/user/settings", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-settings"] });
      toast.success("Đã lưu cài đặt");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTestBot() {
  return useMutation({
    mutationFn: () => api.post("/api/user/settings/test-bot", {}),
    onSuccess: () => toast.success("Đã gửi tin nhắn test!"),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTestPush() {
  return useMutation({
    mutationFn: () => api.post<{ success: boolean; sent: number }>("/api/user/settings/test-push", {}),
    onSuccess: (data) => toast.success(`Đã gửi test push tới ${data.sent} thiết bị!`),
    onError: (e: Error) => toast.error(e.message),
  });
}
