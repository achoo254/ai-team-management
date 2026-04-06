import { useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserSettings } from "@/hooks/use-user-settings";

const DISMISS_KEY = "dismissed_watch_empty_banner_v1";

export function WatchEmptyStateBanner() {
  const { data: settings } = useUserSettings();
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1",
  );

  const alertsEnabled = settings?.alert_settings?.enabled ?? false;
  const noneWatched = (settings?.watched_seats?.length ?? 0) === 0;

  if (dismissed || !alertsEnabled || !noneWatched) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-400/50 bg-amber-500/5 px-4 py-3">
      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <span className="text-foreground">
          Bạn chưa theo dõi seat nào — sẽ không nhận cảnh báo khi usage vượt ngưỡng.
        </span>{" "}
        <Link to="/seats" className="underline text-primary">
          Watch seats →
        </Link>
      </div>
      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={dismiss}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
