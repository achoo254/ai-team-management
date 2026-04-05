import { Skeleton } from '@/components/ui/skeleton'
import { useLatestSnapshots } from '@/hooks/use-usage-snapshots'
import { useSeats } from '@/hooks/use-seats'
import { useAuth } from '@/hooks/use-auth'
import { UsageSnapshotCard } from './usage-snapshot-card'

export function UsageSnapshotList() {
  const { user } = useAuth()
  const { data, isLoading } = useLatestSnapshots()
  const { data: seatsData } = useSeats()
  const isAdmin = user?.role === 'admin'

  // Map seats by ID for lookup
  const seatsById = new Map(
    (seatsData?.seats ?? []).map(s => [s._id, s]),
  )

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    )
  }

  const snapshots = data?.snapshots ?? []

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Usage mới nhất</h2>

      {snapshots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có dữ liệu usage. {isAdmin ? 'Hãy cấu hình token cho seat rồi bấm thu thập.' : ''}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {snapshots.map((s) => (
            <UsageSnapshotCard
              key={s._id}
              snapshot={s}
              seat={seatsById.get(s.seat_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
