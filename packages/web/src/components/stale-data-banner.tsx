import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { StaleSeatInfo } from "@repo/shared/types";

const SESSION_KEY = "stale_data_banner_dismissed";

interface Props {
  staleSeats: StaleSeatInfo[];
}

/**
 * Red dismissible banner shown when any seat has data older than 6 hours.
 * Dismissed state is stored in sessionStorage — reappears on new browser session.
 */
export function StaleDataBanner({ staleSeats }: Props) {
  const [dismissed, setDismissed] = useState<boolean>(false);

  // Read dismissal state from sessionStorage on mount
  useEffect(() => {
    setDismissed(sessionStorage.getItem(SESSION_KEY) === "1");
  }, []);

  if (staleSeats.length === 0 || dismissed) return null;

  function handleDismiss() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setDismissed(true);
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p className="font-medium">
          ⚠ {staleSeats.length} seat{staleSeats.length > 1 ? "s" : ""} có dữ liệu cũ hơn 6h — có thể không phản ánh thực tế
        </p>
        <ul className="list-inside list-disc space-y-0.5 text-xs text-red-600/80 dark:text-red-400/80">
          {staleSeats.map((s) => (
            <li key={s.seat_id}>
              <span className="font-medium">{s.label}</span>
              {" — "}
              {s.hours_since_fetch}h trước
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Đóng thông báo"
        className="ml-auto shrink-0 rounded p-0.5 text-red-500 hover:bg-red-500/20 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
