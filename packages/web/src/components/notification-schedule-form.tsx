import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

const DAY_LABELS: Record<number, string> = {
  0: "CN", 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7",
};
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon→Sun display order

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
  const ns = settings?.notification_settings;
  const enabled = !!ns?.report_enabled;
  const reportDays: number[] = ns?.report_days ?? [5];
  const reportHour: number = ns?.report_hour ?? 9;

  function handleToggle() {
    updateMutation.mutate({
      notification_settings: { report_enabled: !enabled, report_days: reportDays, report_hour: reportHour },
    });
  }

  function toggleDay(day: number) {
    const next = reportDays.includes(day)
      ? reportDays.filter((d) => d !== day)
      : [...reportDays, day];
    updateMutation.mutate({
      notification_settings: { report_enabled: enabled, report_days: next, report_hour: reportHour },
    });
  }

  function handleHourChange(value: string | null) {
    if (!value) return;
    updateMutation.mutate({
      notification_settings: { report_enabled: enabled, report_days: reportDays, report_hour: Number(value) },
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Báo cáo Usage tự động</CardTitle>
        <CardDescription className="text-xs">
          Tự động gửi báo cáo usage qua Telegram theo lịch bạn chọn.
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

        {enabled && (
          <div className="space-y-3 pt-1">
            {/* Day picker */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ngày gửi</Label>
              <div className="flex gap-1.5">
                {ALL_DAYS.map((day) => (
                  <Button
                    key={day}
                    size="sm"
                    variant={reportDays.includes(day) ? "default" : "outline"}
                    className="h-7 w-9 px-0 text-xs"
                    disabled={updateMutation.isPending}
                    onClick={() => toggleDay(day)}
                  >
                    {DAY_LABELS[day]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Hour picker */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Giờ gửi</Label>
              <Select
                value={String(reportHour)}
                onValueChange={handleHourChange}
                disabled={updateMutation.isPending}
              >
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, h) => (
                    <SelectItem key={h} value={String(h)} className="text-xs">
                      {String(h).padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
