import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, EyeOff } from "lucide-react";
import { useUserSettings } from "@/hooks/use-user-settings";
import { useUnwatchSeat } from "@/hooks/use-watched-seats";
import { WatchThresholdDialog } from "./watch-threshold-dialog";

export function WatchedSeatsSummary() {
  const { data: settings } = useUserSettings();
  const unwatchMut = useUnwatchSeat();
  const [editing, setEditing] = useState<{
    seatId: string; label: string; th5h: number; th7d: number;
    burn_rate_threshold?: number | null; eta_warning_hours?: number | null; forecast_warning_hours?: number | null;
  } | null>(null);

  const watched = settings?.watched_seats ?? [];

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Seats đang theo dõi ({watched.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {watched.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Chưa theo dõi seat nào. Vào trang Seats và bấm Watch.
            </p>
          ) : (
            <ul className="space-y-2">
              {watched.map((w) => {
                const label = w.seat_label ?? w.seat_email ?? w.seat_id;
                return (
                  <li key={w.seat_id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{label}</div>
                      <div className="text-xs text-muted-foreground">
                        5h {w.threshold_5h_pct}% · 7d {w.threshold_7d_pct}%
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Sửa ngưỡng"
                        onClick={() =>
                          setEditing({
                            seatId: w.seat_id,
                            label: label as string,
                            th5h: w.threshold_5h_pct,
                            th7d: w.threshold_7d_pct,
                            burn_rate_threshold: w.burn_rate_threshold,
                            eta_warning_hours: w.eta_warning_hours,
                            forecast_warning_hours: w.forecast_warning_hours,
                          })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Huỷ theo dõi"
                        onClick={() => unwatchMut.mutate(w.seat_id)}
                        disabled={unwatchMut.isPending}
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      {editing && (
        <WatchThresholdDialog
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          seatId={editing.seatId}
          seatLabel={editing.label}
          current={{
            threshold_5h_pct: editing.th5h,
            threshold_7d_pct: editing.th7d,
            burn_rate_threshold: editing.burn_rate_threshold,
            eta_warning_hours: editing.eta_warning_hours,
            forecast_warning_hours: editing.forecast_warning_hours,
          }}
        />
      )}
    </>
  );
}
