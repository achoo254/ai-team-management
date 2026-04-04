import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings";
import type { UserAlertSettings } from "@repo/shared/types";

const DEFAULT_SETTINGS: UserAlertSettings = {
  enabled: false,
  rate_limit_pct: 80,
  extra_credit_pct: 80,
  subscribed_seat_ids: [],
};

export function AlertSettingsForm() {
  const { data: settings, isLoading } = useUserSettings();
  const updateMutation = useUpdateUserSettings();

  const [as, setAs] = useState<UserAlertSettings>(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);

  // Sync from server
  useEffect(() => {
    if (settings?.alert_settings) {
      setAs(settings.alert_settings);
    }
  }, [settings?.alert_settings]);

  function toggleSeat(seatId: string) {
    setDirty(true);
    setAs((prev) => ({
      ...prev,
      subscribed_seat_ids: prev.subscribed_seat_ids.includes(seatId)
        ? prev.subscribed_seat_ids.filter((id) => id !== seatId)
        : [...prev.subscribed_seat_ids, seatId],
    }));
  }

  function handleSave() {
    updateMutation.mutate({ alert_settings: as }, { onSuccess: () => setDirty(false) });
  }

  if (isLoading) return null;

  const hasTelegram = settings?.has_telegram_bot;
  const availableSeats = settings?.available_seats ?? [];
  const disabled = !as.enabled;

  // Group seats by team
  const seatsByTeam: Record<string, typeof availableSeats> = {};
  for (const seat of availableSeats) {
    if (!seatsByTeam[seat.team]) seatsByTeam[seat.team] = [];
    seatsByTeam[seat.team].push(seat);
  }

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
                disabled={disabled}
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
                disabled={disabled}
                onChange={(e) => {
                  setDirty(true);
                  setAs((prev) => ({ ...prev, extra_credit_pct: Number(e.target.value) || 80 }));
                }}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm disabled:opacity-50"
              />
            </label>
          </div>
        </div>

        {/* Seat subscription */}
        {availableSeats.length > 0 && (
          <div>
            <Label className="text-xs">Seats theo dõi</Label>
            <div className="mt-1 space-y-2">
              {Object.entries(seatsByTeam).map(([team, seats]) => (
                <div key={team}>
                  <span className="text-xs font-medium text-muted-foreground uppercase">{team}</span>
                  <div className="space-y-1 mt-1">
                    {seats.map((seat) => (
                      <label key={seat._id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={as.subscribed_seat_ids.includes(seat._id)}
                          disabled={disabled}
                          onChange={() => toggleSeat(seat._id)}
                          className="rounded border-border"
                        />
                        <span className={disabled ? "opacity-50" : ""}>{seat.label}</span>
                        <span className="text-xs text-muted-foreground">({seat.email})</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
