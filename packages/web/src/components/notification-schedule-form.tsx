import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Send } from "lucide-react";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

/** Send a test usage report via Telegram */
function TestReportButton({ disabled }: { disabled: boolean }) {
  const testMutation = useMutation({
    mutationFn: () => api.post("/api/user/settings/test-report"),
  });

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => testMutation.mutate()}
      disabled={disabled || testMutation.isPending}
      title="Gửi báo cáo thử qua Telegram ngay bây giờ"
    >
      {testMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Send size={14} className="mr-1" />}
      {testMutation.isSuccess ? "Đã gửi ✓" : testMutation.isError ? "Lỗi" : "Gửi thử"}
    </Button>
  );
}

export function NotificationScheduleForm() {
  const { data: settings, isLoading } = useUserSettings();
  const updateMutation = useUpdateUserSettings();

  if (isLoading) return null;

  const hasTelegram = settings?.has_telegram_bot;
  const enabled = !!settings?.notification_settings?.report_enabled;

  function handleToggle() {
    updateMutation.mutate({
      notification_settings: { report_enabled: !enabled },
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Báo cáo Usage tự động</CardTitle>
        <CardDescription className="text-xs">
          Báo cáo tự gửi trước khi mỗi seat reset chu kỳ 7 ngày (gom trong cửa sổ 6 giờ trước reset).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasTelegram && (
          <p className="text-xs text-amber-600">
            Cần cấu hình Telegram bot trước khi bật thông báo.
          </p>
        )}

        <div className="flex items-center gap-3">
          <Label className="text-xs">Bật thông báo</Label>
          <Button
            size="sm"
            variant={enabled ? "default" : "outline"}
            disabled={!hasTelegram || updateMutation.isPending}
            onClick={handleToggle}
          >
            {updateMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
            {enabled ? "Đang bật" : "Tắt"}
          </Button>
          <TestReportButton disabled={!hasTelegram} />
        </div>
      </CardContent>
    </Card>
  );
}
