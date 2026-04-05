/**
 * BLD Alert Settings Form
 * Admin-only: configure weekly BLD digest schedule (day + hour) + delivery toggle.
 * Digest is sent via user's personal Telegram bot at chosen day/hour (Asia/Ho_Chi_Minh).
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings";

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

interface BldSchedule {
  enabled: boolean;
  days: number[];
  hour: number;
}

const DEFAULT: BldSchedule = { enabled: false, days: [5], hour: 17 };

export function BldAlertSettingsForm() {
  const { data: settings, isLoading } = useUserSettings();
  const updateMutation = useUpdateUserSettings();
  const [form, setForm] = useState<BldSchedule>(DEFAULT);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const as = settings?.alert_settings;
    if (as) {
      setForm({
        enabled: as.bld_digest_enabled ?? false,
        days: as.bld_digest_days ?? [5],
        hour: as.bld_digest_hour ?? 17,
      });
    }
  }, [settings?.alert_settings]);

  function handleSave() {
    const current = settings?.alert_settings;
    updateMutation.mutate(
      {
        alert_settings: {
          enabled: current?.enabled ?? false,
          telegram_enabled: current?.telegram_enabled ?? true,
          token_failure_enabled: current?.token_failure_enabled ?? true,
          bld_digest_enabled: form.enabled,
          bld_digest_days: form.days,
          bld_digest_hour: form.hour,
        },
      },
      { onSuccess: () => setDirty(false) },
    );
  }

  function toggleEnabled() {
    setForm((p) => ({ ...p, enabled: !p.enabled }));
    setDirty(true);
  }

  function toggleDay(d: number) {
    setForm((p) => ({
      ...p,
      days: p.days.includes(d)
        ? p.days.filter((x) => x !== d)
        : [...p.days, d].sort(),
    }));
    setDirty(true);
  }

  function setHour(h: number) {
    setForm((p) => ({ ...p, hour: h }));
    setDirty(true);
  }

  if (isLoading) return null;

  const hasBot = !!settings?.has_telegram_bot;
  const disabled = !hasBot || !form.enabled;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Cài đặt cảnh báo BLD</CardTitle>
        <CardDescription className="text-xs">
          Nhận báo cáo BLD định kỳ qua Telegram bot cá nhân. Chọn ngày + giờ
          gửi. Múi giờ Việt Nam.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasBot && (
          <p className="text-xs text-amber-600">
            Cần cấu hình Telegram bot cá nhân trước (card phía trên).
          </p>
        )}

        <div className="flex items-center gap-3">
          <Label className="text-xs">Bật báo cáo BLD</Label>
          <Button
            size="sm"
            variant={form.enabled ? "default" : "outline"}
            disabled={!hasBot}
            onClick={toggleEnabled}
          >
            {form.enabled ? "Đang bật" : "Tắt"}
          </Button>
        </div>

        <div>
          <Label className="text-xs">Ngày gửi</Label>
          <div className="flex gap-1 mt-1">
            {DAY_LABELS.map((label, i) => (
              <Button
                key={i}
                size="sm"
                variant={form.days.includes(i) ? "default" : "outline"}
                className="w-9 h-8 text-xs px-0"
                disabled={disabled}
                onClick={() => toggleDay(i)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs">Giờ gửi</Label>
          <Select
            value={String(form.hour)}
            onValueChange={(v) => setHour(Number(v))}
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

        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateMutation.isPending || !dirty}
        >
          {updateMutation.isPending && (
            <Loader2 size={14} className="animate-spin mr-1" />
          )}
          Lưu
        </Button>
      </CardContent>
    </Card>
  );
}
