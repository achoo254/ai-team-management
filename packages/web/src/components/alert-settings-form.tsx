import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings";
import { useEnablePush, useUnregisterFcmToken } from "@/hooks/use-fcm";
import type { UserAlertSettings } from "@repo/shared/types";

const DEFAULT_SETTINGS: UserAlertSettings = {
  enabled: false,
  rate_limit_pct: 80,
  extra_credit_pct: 80,
  token_failure_enabled: true,
};

export function AlertSettingsForm() {
  const { data: settings, isLoading } = useUserSettings();
  const updateMutation = useUpdateUserSettings();

  const [as, setAs] = useState<UserAlertSettings>(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);

  // Sync from server (default token_failure_enabled=true for legacy records)
  useEffect(() => {
    if (settings?.alert_settings) {
      setAs({
        ...settings.alert_settings,
        token_failure_enabled: settings.alert_settings.token_failure_enabled ?? true,
      });
    }
  }, [settings?.alert_settings]);

  function handleSave() {
    updateMutation.mutate({ alert_settings: as }, { onSuccess: () => setDirty(false) });
  }

  const enablePush = useEnablePush();
  const unregisterFcm = useUnregisterFcmToken();
  const pushSupported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
  const pushDenied = typeof window !== "undefined" && "Notification" in window && Notification.permission === "denied";
  const pushEnabled = settings?.push_enabled ?? false;

  async function handleTogglePush() {
    if (pushEnabled) {
      const token = localStorage.getItem("fcm_token");
      if (token) await unregisterFcm.mutateAsync(token);
      updateMutation.mutate({ push_enabled: false });
    } else {
      await enablePush.mutateAsync();
      updateMutation.mutate({ push_enabled: true });
    }
  }

  if (isLoading) return null;

  const hasTelegram = settings?.has_telegram_bot;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Cài đặt Alert</CardTitle>
        <CardDescription className="text-xs">
          Nhận thông báo khi usage vượt ngưỡng qua Telegram bot cá nhân.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasTelegram && (
          <p className="text-xs text-amber-600">
            Cần cấu hình Telegram bot trước khi bật alert.
          </p>
        )}

        {/* Enable toggle */}
        <div className="flex items-center gap-3">
          <Label className="text-xs">Bật thông báo alert</Label>
          <Button
            size="sm"
            variant={as.enabled ? "default" : "outline"}
            disabled={!hasTelegram}
            onClick={() => {
              setDirty(true);
              setAs((prev) => ({ ...prev, enabled: !prev.enabled }));
            }}
          >
            {as.enabled ? "Đang bật" : "Tắt"}
          </Button>
        </div>

        {/* Desktop push notification */}
        <div className="flex items-center gap-3">
          <Label className="text-xs">Desktop Push Notification</Label>
          {!pushSupported ? (
            <span className="text-xs text-muted-foreground">Trình duyệt không hỗ trợ</span>
          ) : pushDenied ? (
            <span className="text-xs text-amber-600">
              Đã bị chặn. Vào Settings trình duyệt để bật lại.
            </span>
          ) : (
            <Button
              size="sm"
              variant={pushEnabled ? "default" : "outline"}
              onClick={handleTogglePush}
              disabled={enablePush.isPending || unregisterFcm.isPending}
            >
              {(enablePush.isPending || unregisterFcm.isPending) && <Loader2 size={14} className="animate-spin mr-1" />}
              {pushEnabled ? "Đang bật" : "Bật"}
            </Button>
          )}
        </div>

        {/* Token failure alert toggle */}
        <div className="flex items-center gap-3">
          <Label className="text-xs">Cảnh báo token invalid</Label>
          <Button
            size="sm"
            variant={as.token_failure_enabled ? "default" : "outline"}
            disabled={!as.enabled}
            onClick={() => {
              setDirty(true);
              setAs((prev) => ({ ...prev, token_failure_enabled: !prev.token_failure_enabled }));
            }}
          >
            {as.token_failure_enabled ? "Đang bật" : "Tắt"}
          </Button>
        </div>

        {/* Thresholds */}
        <div>
          <Label className="text-xs">Ngưỡng cảnh báo</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Rate limit (%)</span>
              <input
                type="number"
                min={1}
                max={100}
                value={as.rate_limit_pct}
                disabled={!as.enabled}
                onChange={(e) => {
                  setDirty(true);
                  setAs((prev) => ({ ...prev, rate_limit_pct: Number(e.target.value) || 80 }));
                }}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm disabled:opacity-50"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Extra credit (%)</span>
              <input
                type="number"
                min={1}
                max={100}
                value={as.extra_credit_pct}
                disabled={!as.enabled}
                onChange={(e) => {
                  setDirty(true);
                  setAs((prev) => ({ ...prev, extra_credit_pct: Number(e.target.value) || 80 }));
                }}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm disabled:opacity-50"
              />
            </label>
          </div>
        </div>

        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending || !dirty}>
          {updateMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
          Lưu
        </Button>
      </CardContent>
    </Card>
  );
}
