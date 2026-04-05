import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Pencil } from "lucide-react";
import { useUserSettings } from "@/hooks/use-user-settings";
import { useUnwatchSeat } from "@/hooks/use-watched-seats";
import { WatchThresholdDialog } from "./watch-threshold-dialog";

interface Props {
  seatId: string;
  seatLabel: string;
}

export function WatchSeatButton({ seatId, seatLabel }: Props) {
  const { data: settings } = useUserSettings();
  const unwatchMut = useUnwatchSeat();
  const [dialogOpen, setDialogOpen] = useState(false);

  const current = settings?.watched_seats?.find((w) => w.seat_id === seatId);

  if (current) {
    return (
      <>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Eye className="h-3 w-3" />
            5h {current.threshold_5h_pct}% · 7d {current.threshold_7d_pct}%
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setDialogOpen(true)}
            title="Sửa ngưỡng"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => unwatchMut.mutate(seatId)}
            disabled={unwatchMut.isPending}
            title="Huỷ theo dõi"
          >
            <EyeOff className="h-3 w-3" />
          </Button>
        </div>
        <WatchThresholdDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          seatId={seatId}
          seatLabel={seatLabel}
          current={{ threshold_5h_pct: current.threshold_5h_pct, threshold_7d_pct: current.threshold_7d_pct }}
        />
      </>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={() => setDialogOpen(true)}
      >
        <Eye className="h-3 w-3 mr-1" />
        Watch
      </Button>
      <WatchThresholdDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        seatId={seatId}
        seatLabel={seatLabel}
      />
    </>
  );
}
