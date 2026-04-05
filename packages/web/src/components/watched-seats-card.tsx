import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings";

export function WatchedSeatsCard() {
  const { data: settings, isLoading } = useUserSettings();
  const updateMutation = useUpdateUserSettings();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  // Sync from server
  useEffect(() => {
    if (settings?.watched_seat_ids) {
      setSelectedIds(settings.watched_seat_ids);
    }
  }, [settings?.watched_seat_ids]);

  function toggleSeat(seatId: string) {
    setDirty(true);
    setSelectedIds((prev) =>
      prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId],
    );
  }

  function handleSave() {
    updateMutation.mutate({ watched_seat_ids: selectedIds }, { onSuccess: () => setDirty(false) });
  }

  if (isLoading) return null;

  const availableSeats = settings?.available_seats ?? [];
  if (availableSeats.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Seats theo dõi</CardTitle>
        <CardDescription className="text-xs">
          Chọn seats muốn theo dõi. Áp dụng cho cả Alert và Báo cáo Usage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          {availableSeats.map((seat) => (
            <label key={seat._id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.includes(seat._id)}
                onChange={() => toggleSeat(seat._id)}
                className="rounded border-border"
              />
              <span>{seat.label}</span>
              <span className="text-xs text-muted-foreground">({seat.email})</span>
            </label>
          ))}
        </div>

        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending || !dirty}>
          {updateMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
          Lưu
        </Button>
      </CardContent>
    </Card>
  );
}
