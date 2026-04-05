import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TokenFailureInfo } from "@repo/shared/types";

interface Props {
  failures: TokenFailureInfo[];
}

function formatLastFetched(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Admin-only panel listing seats with token fetch errors.
 * Retry button calls POST /api/seats/:id/refresh-token when available.
 *
 * TODO(phase-2): implement POST /api/seats/:id/refresh-token endpoint in seats.ts
 * then enable the retry button (remove `disabled` + wire up fetch call).
 */
export function TokenFailurePanel({ failures }: Props) {
  if (failures.length === 0) return null;

  // TODO: enable when refresh-token endpoint exists
  const retryEndpointReady = false;

  async function handleRetry(seatId: string) {
    if (!retryEndpointReady) return;
    try {
      await fetch(`/api/seats/${seatId}/refresh-token`, { method: "POST" });
    } catch {
      // Silently fail — user can retry again
    }
  }

  return (
    <Card className="border-orange-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-orange-600 dark:text-orange-400">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Token thất bại ({failures.length} seat{failures.length > 1 ? "s" : ""})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="pb-2 text-left font-medium">Seat</th>
                <th className="pb-2 text-left font-medium">Lỗi</th>
                <th className="pb-2 text-left font-medium whitespace-nowrap">Lần cuối</th>
                <th className="pb-2 text-right font-medium">Thử lại</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((f) => (
                <tr key={f.seat_id} className="border-b border-border/30 last:border-0">
                  <td className="py-2 pr-3 font-medium">{f.label}</td>
                  <td className="py-2 pr-3 text-muted-foreground font-mono">
                    {truncate(f.error_message)}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                    {formatLastFetched(f.last_fetched_at)}
                  </td>
                  <td className="py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px]"
                      disabled={!retryEndpointReady}
                      onClick={() => handleRetry(f.seat_id)}
                      title={retryEndpointReady ? "Thử lại lấy token" : "Chức năng chưa khả dụng"}
                    >
                      Thử lại
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
