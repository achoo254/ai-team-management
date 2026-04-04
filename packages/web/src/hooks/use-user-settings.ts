import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { NotificationSettings, UserAlertSettings } from "@repo/shared/types";

export interface AvailableSeat {
  _id: string;
  label: string;
  email: string;
  team: string;
}

export interface UserSettings {
  telegram_chat_id: string | null;
  has_telegram_bot: boolean;
  notification_settings: NotificationSettings | null;
  alert_settings: UserAlertSettings | null;
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
      notification_settings?: NotificationSettings;
      alert_settings?: UserAlertSettings;
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
