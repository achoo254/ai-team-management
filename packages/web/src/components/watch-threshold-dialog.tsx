import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useWatchSeat, useUpdateWatchedSeat } from "@/hooks/use-watched-seats";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seatId: string;
  seatLabel: string;
  /** If provided, dialog edits existing watch; otherwise creates new. */
  current?: {
    threshold_5h_pct: number;
    threshold_7d_pct: number;
    burn_rate_threshold?: number | null;
    eta_warning_hours?: number | null;
    forecast_warning_hours?: number | null;
  };
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 90;
  return Math.max(1, Math.min(100, Math.floor(n)));
}

export function WatchThresholdDialog({ open, onOpenChange, seatId, seatLabel, current }: Props) {
  const watchMut = useWatchSeat();
  const updateMut = useUpdateWatchedSeat();
  const [th5h, setTh5h] = useState(current?.threshold_5h_pct ?? 90);
  const [th7d, setTh7d] = useState(current?.threshold_7d_pct ?? 85);
  const [burnRate, setBurnRate] = useState<number | null>(current?.burn_rate_threshold ?? 15);
  const [etaWarning, setEtaWarning] = useState<number | null>(current?.eta_warning_hours ?? 1.5);
  const [forecastWarning, setForecastWarning] = useState<number | null>(current?.forecast_warning_hours ?? 48);

  // Reset state only when dialog opens — not on `current` ref change (avoids resetting mid-edit)
  useEffect(() => {
    if (open) {
      setTh5h(current?.threshold_5h_pct ?? 90);
      setTh7d(current?.threshold_7d_pct ?? 85);
      setBurnRate(current?.burn_rate_threshold ?? 15);
      setEtaWarning(current?.eta_warning_hours ?? 1.5);
      setForecastWarning(current?.forecast_warning_hours ?? 48);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isEditing = !!current;
  const pending = watchMut.isPending || updateMut.isPending;

  async function handleSave() {
    const body = {
      threshold_5h_pct: clamp(th5h),
      threshold_7d_pct: clamp(th7d),
      burn_rate_threshold: burnRate,
      eta_warning_hours: burnRate !== null ? etaWarning : null,
      forecast_warning_hours: forecastWarning,
    };
    try {
      if (isEditing) {
        await updateMut.mutateAsync({ seatId, ...body });
      } else {
        await watchMut.mutateAsync({ seat_id: seatId, ...body });
      }
      onOpenChange(false);
    } catch {
      // toast shown by hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Sửa ngưỡng" : "Theo dõi seat"}</DialogTitle>
          <DialogDescription className="text-xs">{seatLabel}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Ngưỡng 5 giờ (%)</Label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                value={th5h}
                onChange={(e) => setTh5h(Number(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min={1}
                max={100}
                value={th5h}
                onChange={(e) => setTh5h(Number(e.target.value) || 1)}
                className="w-16 rounded-md border bg-background px-2 py-1 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ngưỡng 7 ngày (%)</Label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                value={th7d}
                onChange={(e) => setTh7d(Number(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min={1}
                max={100}
                value={th7d}
                onChange={(e) => setTh7d(Number(e.target.value) || 1)}
                className="w-16 rounded-md border bg-background px-2 py-1 text-sm"
              />
            </div>
          </div>

          {/* Collapsible predictive alert section */}
          <details className="mt-3">
            <summary className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground">
              Cảnh báo dự đoán (nâng cao)
            </summary>
            <div className="mt-2 space-y-3 pl-1">
              {/* Fast Burn: burn rate + ETA */}
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                    checked={burnRate !== null}
                    onChange={(e) => {
                      setBurnRate(e.target.checked ? 15 : null);
                      setEtaWarning(e.target.checked ? 1.5 : null);
                    }}
                    className="rounded border-muted-foreground"
                  />
                  <span className="text-xs">Cháy nhanh 5h</span>
                </label>
                {burnRate !== null && (
                  <div className="pl-6 space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>Tốc độ ≥</span>
                      <input type="number" min={5} max={50} step={1}
                        value={burnRate} onChange={(e) => setBurnRate(Number(e.target.value) || 15)}
                        className="w-14 rounded border bg-background px-1.5 py-0.5 text-xs" />
                      <span>%/h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>VÀ còn ≤</span>
                      <input type="number" min={0.5} max={4} step={0.5}
                        value={etaWarning ?? 1.5}
                        onChange={(e) => setEtaWarning(Number(e.target.value) || 1.5)}
                        className="w-14 rounded border bg-background px-1.5 py-0.5 text-xs" />
                      <span>giờ</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quota Forecast: warning hours */}
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                    checked={forecastWarning !== null}
                    onChange={(e) => setForecastWarning(e.target.checked ? 48 : null)}
                    className="rounded border-muted-foreground"
                  />
                  <span className="text-xs">Dự đoán chạm ngưỡng 7d</span>
                </label>
                {forecastWarning !== null && (
                  <div className="pl-6 text-xs text-muted-foreground flex items-center gap-2">
                    <span>Cảnh báo trước</span>
                    <input type="number" min={6} max={168} step={6}
                      value={forecastWarning}
                      onChange={(e) => setForecastWarning(Number(e.target.value) || 48)}
                      className="w-14 rounded border bg-background px-1.5 py-0.5 text-xs" />
                    <span>giờ</span>
                  </div>
                )}
              </div>
            </div>
          </details>

          <p className="text-[11px] text-muted-foreground">
            ℹ Ngưỡng kích hoạt cảnh báo khi usage vượt mức. Mở "Cảnh báo dự đoán" để cảnh báo sớm trước khi chạm ngưỡng.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Hủy
          </Button>
          <Button size="sm" onClick={handleSave} disabled={pending}>
            {pending && <Loader2 size={14} className="animate-spin mr-1" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
