import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCollectSeatUsage } from '@/hooks/use-usage-snapshots'
import { useAuth } from '@/hooks/use-auth'
import type { UsageSnapshot } from '@repo/shared'

/** Min gap (seconds) between manual reloads for the same seat */
const MIN_RELOAD_INTERVAL_SEC = 120
/** Cron collector interval (minutes) — keep in sync with api/src/index.ts */
const CRON_INTERVAL_MIN = 5
/** If next cron run is within this window (seconds), ask user to wait */
const CRON_WARN_WINDOW_SEC = 60

/** Return a guard message if manual reload should be blocked, else null. */
function getReloadBlockMessage(fetchedAt: string | null): string | null {
  const now = new Date()
  if (fetchedAt) {
    const diffSec = Math.floor((now.getTime() - new Date(fetchedAt).getTime()) / 1000)
    if (diffSec < MIN_RELOAD_INTERVAL_SEC) {
      const wait = MIN_RELOAD_INTERVAL_SEC - diffSec
      return `Vừa cập nhật ${diffSec}s trước. Vui lòng chờ thêm ${wait}s rồi thử lại.`
    }
  }
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()
  const nextCronMin = Math.ceil((minutes + seconds / 60) / CRON_INTERVAL_MIN) * CRON_INTERVAL_MIN
  const secUntilCron = (nextCronMin - minutes) * 60 - seconds
  if (secUntilCron > 0 && secUntilCron <= CRON_WARN_WINDOW_SEC) {
    return `Hệ thống sẽ tự động cập nhật trong ${secUntilCron}s. Vui lòng chờ để tránh spam Claude API.`
  }
  return null
}

/** Color based on percentage threshold */
function pctColor(pct: number | null): string {
  if (pct == null) return 'bg-muted'
  if (pct > 80) return 'bg-red-500'
  if (pct > 50) return 'bg-yellow-500'
  return 'bg-green-500'
}

function formatPct(pct: number | null): string {
  if (pct == null) return 'N/A'
  return `${Math.round(pct)}%`
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}

function ProgressBar({ label, pct, resetsAt }: { label: string; pct: number | null; resetsAt: string | null }) {
  const width = pct != null ? Math.min(pct, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{formatPct(pct)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pctColor(pct)}`}
          style={{ width: `${width}%` }}
        />
      </div>
      {resetsAt && (
        <p className="text-[10px] text-muted-foreground">Reset: {formatTime(resetsAt)}</p>
      )}
    </div>
  )
}

interface Props {
  snapshot?: UsageSnapshot
  seatId: string
  seat?: { label?: string; has_token?: boolean; last_fetch_error?: string | null }
}

export function UsageSnapshotCard({ snapshot, seatId, seat }: Props) {
  const { user } = useAuth()
  const collectMutation = useCollectSeatUsage()
  const isAdmin = user?.role === 'admin'
  const hasSnapshot = !!snapshot

  function handleCollect() {
    const block = getReloadBlockMessage(snapshot?.fetched_at ?? null)
    if (block) {
      toast.info(block)
      return
    }
    collectMutation.mutate(seatId)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {seat?.label ?? seatId}
          </CardTitle>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCollect}
                disabled={collectMutation.isPending}
                title={hasSnapshot ? 'Cập nhật usage' : 'Thu thập lần đầu'}
              >
                <RefreshCw className={`h-3 w-3 ${collectMutation.isPending ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasSnapshot ? (
          <>
            <ProgressBar label="Phiên 5h" pct={snapshot.five_hour_pct} resetsAt={snapshot.five_hour_resets_at} />
            <ProgressBar label="Tuần 7d" pct={snapshot.seven_day_pct} resetsAt={snapshot.seven_day_resets_at} />
            <ProgressBar label="Sonnet (7d)" pct={snapshot.seven_day_sonnet_pct} resetsAt={snapshot.seven_day_sonnet_resets_at} />
            {snapshot.seven_day_opus_pct != null && (
              <ProgressBar label="Opus (7d)" pct={snapshot.seven_day_opus_pct} resetsAt={snapshot.seven_day_opus_resets_at} />
            )}
            <p className="text-[10px] text-muted-foreground pt-1">
              Cập nhật: {formatTime(snapshot.fetched_at)}
            </p>
          </>
        ) : (
          <div className="flex flex-col items-start gap-2 py-4">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
              Chưa có dữ liệu usage
            </span>
            {seat?.last_fetch_error ? (
              <p className="text-[11px] text-error-text">Lỗi fetch: {seat.last_fetch_error}</p>
            ) : seat?.has_token === false ? (
              <p className="text-[11px] text-muted-foreground">Seat chưa có OAuth token.</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {isAdmin ? 'Bấm ↻ để thu thập lần đầu, hoặc đợi cron 5 phút tới.' : 'Đợi cron 5 phút tới để fetch lần đầu.'}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
