import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export interface UserSettings {
  telegram_chat_id: string | null;
  has_telegram_bot: boolean;
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
    mutationFn: (body: { telegram_bot_token?: string | null; telegram_chat_id?: string | null }) =>
      api.put("/api/user/settings", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-settings"] });
      toast.success("Đã lưu cài đặt bot");
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
