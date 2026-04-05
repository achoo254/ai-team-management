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
  current?: { threshold_5h_pct: number; threshold_7d_pct: number };
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

  useEffect(() => {
    if (open) {
      setTh5h(current?.threshold_5h_pct ?? 90);
      setTh7d(current?.threshold_7d_pct ?? 85);
    }
  }, [open, current]);

  const isEditing = !!current;
  const pending = watchMut.isPending || updateMut.isPending;

  async function handleSave() {
    const body = { threshold_5h_pct: clamp(th5h), threshold_7d_pct: clamp(th7d) };
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
          <p className="text-[11px] text-muted-foreground">
            ℹ Theo dõi seat cũng bao gồm báo cáo usage hàng tuần.
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
