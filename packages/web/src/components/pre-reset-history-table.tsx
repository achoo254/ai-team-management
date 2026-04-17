import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePreResetHistory } from '@/hooks/use-usage-snapshots'
import { useSeats } from '@/hooks/use-seats'
import type { PreResetEntry } from '@repo/shared'

type MetricKey = 'seven_day_pct' | 'seven_day_sonnet_pct' | 'seven_day_opus_pct'

const METRIC_OPTIONS: { value: MetricKey; label: string }[] = [
  { value: 'seven_day_pct', label: '7d Tổng' },
  { value: 'seven_day_sonnet_pct', label: 'Sonnet (7d)' },
  { value: 'seven_day_opus_pct', label: 'Opus (7d)' },
]

function pctBg(pct: number | null): string {
  if (pct == null) return 'bg-muted/40 text-muted-foreground'
  if (pct >= 80) return 'bg-red-500/15 text-red-400 font-semibold'
  if (pct >= 50) return 'bg-yellow-500/15 text-yellow-400'
  if (pct >= 20) return 'bg-green-500/15 text-green-400'
  return 'bg-muted/40 text-muted-foreground'
}

function formatPct(pct: number | null): string {
  if (pct == null) return '—'
  return `${Math.round(pct)}%`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
  })
}

/** Cluster entries by time proximity — entries within 4 days go in same bucket */
const BUCKET_GAP_MS = 4 * 24 * 60 * 60 * 1000

interface Bucket {
  label: string       // display label e.g. "16/04"
  rangeLabel: string  // e.g. "14/04 – 16/04"
  entries: Map<string, PreResetEntry> // seat_id → most recent entry
}

function clusterIntoBuckets(history: PreResetEntry[]): Bucket[] {
  if (!history.length) return []

  // Sort by fetched_at descending (newest first)
  const sorted = [...history].sort((a, b) =>
    new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
  )

  const buckets: Bucket[] = []
  let currentBucket: { times: number[]; entries: Map<string, PreResetEntry> } = {
    times: [], entries: new Map(),
  }

  for (const entry of sorted) {
    const t = new Date(entry.fetched_at).getTime()

    if (currentBucket.times.length === 0) {
      currentBucket.times.push(t)
      currentBucket.entries.set(entry.seat_id, entry)
    } else {
      const newest = Math.max(...currentBucket.times)
      if (newest - t <= BUCKET_GAP_MS) {
        // Same bucket — keep first (most recent) entry per seat
        currentBucket.times.push(t)
        if (!currentBucket.entries.has(entry.seat_id)) {
          currentBucket.entries.set(entry.seat_id, entry)
        }
      } else {
        // Finalize current bucket, start new one
        buckets.push(finalizeBucket(currentBucket))
        currentBucket = { times: [t], entries: new Map([[entry.seat_id, entry]]) }
      }
    }
  }
  if (currentBucket.times.length > 0) buckets.push(finalizeBucket(currentBucket))

  return buckets
}

function finalizeBucket(raw: { times: number[]; entries: Map<string, PreResetEntry> }): Bucket {
  const min = Math.min(...raw.times)
  const max = Math.max(...raw.times)
  const minDate = formatDate(new Date(min).toISOString())
  const maxDate = formatDate(new Date(max).toISOString())
  return {
    label: maxDate,
    rangeLabel: minDate === maxDate ? maxDate : `${minDate} – ${maxDate}`,
    entries: raw.entries,
  }
}

export function PreResetHistoryTable() {
  const [metric, setMetric] = useState<MetricKey>('seven_day_pct')
  const { data, isLoading } = usePreResetHistory(12)
  const { data: seatsData } = useSeats()

  const { seatRows, buckets } = useMemo(() => {
    const history = data?.history ?? []
    const seats = seatsData?.seats ?? []

    const seatIdsInHistory = new Set(history.map((h) => h.seat_id))
    const filteredSeats = seats.filter((s) => seatIdsInHistory.has(s._id))
    const labelMap = new Map(seats.map((s) => [s._id, s.label]))

    const bkts = clusterIntoBuckets(history)

    const rows = filteredSeats.map((seat) => {
      const cells = bkts.map((b) => {
        const entry = b.entries.get(seat._id)
        return {
          pct: entry ? entry[metric] : null,
          fetchedAt: entry?.fetched_at ?? '',
        }
      })
      return { seatId: seat._id, label: labelMap.get(seat._id) ?? seat._id, cells }
    })

    return { seatRows: rows, buckets: bkts }
  }, [data, seatsData, metric])

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Lịch sử trước reset 7d</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-48 w-full rounded-lg" /></CardContent>
      </Card>
    )
  }

  if (buckets.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Lịch sử trước reset 7d</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chưa có dữ liệu lịch sử reset.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base font-semibold">Lịch sử trước reset 7d</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mức sử dụng cuối cùng trước khi quota 7d bị reset về 0%
            </p>
          </div>
          <div className="flex gap-1 rounded-lg bg-muted/50 p-0.5">
            {METRIC_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMetric(opt.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  metric === opt.value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 pr-3 text-muted-foreground font-medium sticky left-0 bg-card z-10 min-w-[100px]">
                  Seat
                </th>
                {buckets.map((b, i) => (
                  <th key={i} className="text-center py-2 px-2 text-muted-foreground font-medium whitespace-nowrap min-w-[80px]">
                    <div className="leading-tight">
                      <div>{b.label}</div>
                      {b.rangeLabel !== b.label && (
                        <div className="text-[10px] opacity-60">{b.rangeLabel}</div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seatRows.map((row) => (
                <tr key={row.seatId} className="border-t border-border/40">
                  <td className="py-2 pr-3 font-medium text-foreground sticky left-0 bg-card z-10">
                    {row.label}
                  </td>
                  {row.cells.map((cell, i) => (
                    <td key={i} className="py-2 px-2 text-center">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[11px] tabular-nums ${pctBg(cell.pct)}`}
                        title={cell.fetchedAt ? `Snapshot: ${formatDateTime(cell.fetchedAt)}` : ''}
                      >
                        {formatPct(cell.pct)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
