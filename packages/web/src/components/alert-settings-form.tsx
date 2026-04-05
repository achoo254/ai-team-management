import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Info } from "lucide-react";
import { useUserSettings, useUpdateUserSettings, useTestPush } from "@/hooks/use-user-settings";
import { useEnablePush, useUnregisterFcmToken } from "@/hooks/use-fcm";
import type { UserAlertSettings } from "@repo/shared/types";

const DEFAULT_SETTINGS: UserAlertSettings = {
  enabled: false,
  telegram_enabled: true,
  token_failure_enabled: true,
};

export function AlertSettingsForm() {
  const { data: settings, isLoading } = useUserSettings();
  const updateMutation = useUpdateUserSettings();

  const [as, setAs] = useState<UserAlertSettings>(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);

  // Sync from server
  useEffect(() => {
    if (settings?.alert_settings) {
      setAs({
        enabled: !!settings.alert_settings.enabled,
        telegram_enabled: settings.alert_settings.telegram_enabled ?? true,
        token_failure_enabled: settings.alert_settings.token_failure_enabled ?? true,
      });
    }
  }, [settings?.alert_settings]);

  function handleSave() {
    updateMutation.mutate({ alert_settings: as }, { onSuccess: () => setDirty(false) });
  }

  const enablePush = useEnablePush();
  const unregisterFcm = useUnregisterFcmToken();
  const testPush = useTestPush();
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
          Nhận thông báo khi có cảnh báo usage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Master enable toggle */}
        <div className="flex items-center gap-3">
          <Label className="text-xs">Bật thông báo alert</Label>
          <Button
            size="sm"
            variant={as.enabled ? "default" : "outline"}
            onClick={() => {
              setDirty(true);
              setAs((prev) => ({ ...prev, enabled: !prev.enabled }));
            }}
          >
            {as.enabled ? "Đang bật" : "Tắt"}
          </Button>
        </div>

        {/* Channels section */}
        <div className="space-y-3 border-t pt-3">
          <div className="text-xs font-medium text-muted-foreground">Kênh thông báo</div>

          <div className="flex items-center gap-3">
            <Label className="text-xs">Telegram</Label>
            <Button
              size="sm"
              variant={as.telegram_enabled ? "default" : "outline"}
              disabled={!as.enabled || !hasTelegram}
              onClick={() => {
                setDirty(true);
                setAs((prev) => ({ ...prev, telegram_enabled: !prev.telegram_enabled }));
              }}
            >
              {as.telegram_enabled ? "Đang bật" : "Tắt"}
            </Button>
            {!hasTelegram && (
              <span className="text-xs text-muted-foreground">Cần cấu hình bot trước</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-xs">Desktop Push</Label>
            {!pushSupported ? (
              <span className="text-xs text-muted-foreground">Trình duyệt không hỗ trợ</span>
            ) : pushDenied ? (
              <span className="text-xs text-amber-600">
                Đã bị chặn. Vào Settings trình duyệt để bật lại.
              </span>
            ) : (
              <>
                <Button
                  size="sm"
                  variant={pushEnabled ? "default" : "outline"}
                  onClick={handleTogglePush}
                  disabled={enablePush.isPending || unregisterFcm.isPending}
                >
                  {(enablePush.isPending || unregisterFcm.isPending) && <Loader2 size={14} className="animate-spin mr-1" />}
                  {pushEnabled ? "Đang bật" : "Bật"}
                </Button>
                {pushEnabled && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => testPush.mutate()}
                    disabled={testPush.isPending}
                  >
                    {testPush.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
                    Test
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Alert types section */}
        <div className="space-y-3 border-t pt-3">
          <div className="text-xs font-medium text-muted-foreground">Loại cảnh báo</div>
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
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <Info size={14} className="mt-0.5 shrink-0" />
          <div>
            Ngưỡng usage được cấu hình riêng cho từng seat.{" "}
            <Link to="/seats" className="underline text-primary">
              Xem trang Seats →
            </Link>
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
