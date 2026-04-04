import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings";
import { useAuth } from "@/hooks/use-auth";
import type { NotificationSettings } from "@repo/shared/types";

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const DEFAULT_SETTINGS: NotificationSettings = {
  report_enabled: false,
  report_days: [5],
  report_hour: 8,
  report_scope: "own",
};

export function NotificationScheduleForm() {
  const { data: settings, isLoading } = useUserSettings();
  const updateMutation = useUpdateUserSettings();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [ns, setNs] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);

  // Sync from server
  useEffect(() => {
    if (settings?.notification_settings) {
      setNs(settings.notification_settings);
    }
  }, [settings?.notification_settings]);

  function toggleDay(day: number) {
    setDirty(true);
    setNs((prev) => ({
      ...prev,
      report_days: prev.report_days.includes(day)
        ? prev.report_days.filter((d) => d !== day)
        : [...prev.report_days, day].sort(),
    }));
  }

  function handleSave() {
    updateMutation.mutate({ notification_settings: ns }, { onSuccess: () => setDirty(false) });
  }

  if (isLoading) return null;

  const hasTelegram = settings?.has_telegram_bot;
  const disabled = !ns.report_enabled;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Báo cáo Usage tự động</CardTitle>
        <CardDescription className="text-xs">
          Nhận báo cáo usage định kỳ qua Telegram bot cá nhân.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasTelegram && (
          <p className="text-xs text-amber-600">
            Cần cấu hình Telegram bot trước khi bật thông báo.
          </p>
        )}

        {/* Enable toggle */}
        <div className="flex items-center gap-3">
          <Label className="text-xs">Bật thông báo</Label>
          <Button
            size="sm"
            variant={ns.report_enabled ? "default" : "outline"}
            disabled={!hasTelegram}
            onClick={() => {
              setDirty(true);
              setNs((prev) => ({ ...prev, report_enabled: !prev.report_enabled }));
            }}
          >
            {ns.report_enabled ? "Đang bật" : "Tắt"}
          </Button>
        </div>

        {/* Day selection */}
        <div>
          <Label className="text-xs">Ngày gửi</Label>
          <div className="flex gap-1 mt-1">
            {DAY_LABELS.map((label, i) => (
              <Button
                key={i}
                size="sm"
                variant={ns.report_days.includes(i) ? "default" : "outline"}
                className="w-9 h-8 text-xs px-0"
                disabled={disabled}
                onClick={() => toggleDay(i)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Hour select */}
        <div>
          <Label className="text-xs">Giờ gửi</Label>
          <Select
            value={String(ns.report_hour)}
            onValueChange={(v) => {
              setDirty(true);
              setNs((prev) => ({ ...prev, report_hour: Number(v) }));
            }}
            disabled={disabled}
          >
            <SelectTrigger className="w-32 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>
                  {String(i).padStart(2, "0")}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Scope — admin only */}
        {isAdmin && (
          <div>
            <Label className="text-xs">Phạm vi</Label>
            <Select
              value={ns.report_scope}
              onValueChange={(v) => {
                setDirty(true);
                setNs((prev) => ({ ...prev, report_scope: v as "own" | "all" }));
              }}
              disabled={disabled}
            >
              <SelectTrigger className="w-48 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="own">Seats của tôi</SelectItem>
                <SelectItem value="all">Tất cả seats</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending || !dirty}>
          {updateMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
          Lưu
        </Button>
      </CardContent>
    </Card>
  );
}
