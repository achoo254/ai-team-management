import { RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCollectSeatUsage } from '@/hooks/use-usage-snapshots'
import { useAuth } from '@/hooks/use-auth'
import type { UsageSnapshot } from '@repo/shared'

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
  snapshot: UsageSnapshot
  seat?: { label?: string }
}

export function UsageSnapshotCard({ snapshot, seat }: Props) {
  const { user } = useAuth()
  const collectMutation = useCollectSeatUsage()
  const isAdmin = user?.role === 'admin'

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {seat?.label ?? snapshot.seat_id}
          </CardTitle>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => collectMutation.mutate(snapshot.seat_id)}
                disabled={collectMutation.isPending}
              >
                <RefreshCw className={`h-3 w-3 ${collectMutation.isPending ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ProgressBar label="Session (5h)" pct={snapshot.five_hour_pct} resetsAt={snapshot.five_hour_resets_at} />
        <ProgressBar label="Week (7d)" pct={snapshot.seven_day_pct} resetsAt={snapshot.seven_day_resets_at} />
        <ProgressBar label="Sonnet (7d)" pct={snapshot.seven_day_sonnet_pct} resetsAt={snapshot.seven_day_sonnet_resets_at} />
        {snapshot.seven_day_opus_pct != null && (
          <ProgressBar label="Opus (7d)" pct={snapshot.seven_day_opus_pct} resetsAt={snapshot.seven_day_opus_resets_at} />
        )}
        <p className="text-[10px] text-muted-foreground pt-1">
          Cập nhật: {formatTime(snapshot.fetched_at)}
        </p>
      </CardContent>
    </Card>
  )
}
