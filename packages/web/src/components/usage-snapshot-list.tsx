import { useEffect, useRef } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useLatestSnapshots } from '@/hooks/use-usage-snapshots'
import { useSeats } from '@/hooks/use-seats'
import { useAuth } from '@/hooks/use-auth'
import { UsageSnapshotCard } from './usage-snapshot-card'

export function UsageSnapshotList({ highlightSeatId }: { highlightSeatId?: string | null }) {
  const highlightRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const { data, isLoading } = useLatestSnapshots()
  const { data: seatsData } = useSeats()
  const isAdmin = user?.role === 'admin'

  const seats = seatsData?.seats ?? []

  // Scroll to highlighted seat card when data loads
  useEffect(() => {
    if (highlightSeatId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightSeatId, seats.length])

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
  // Latest snapshot per seat_id (snapshots assumed sorted newest-first)
  const snapshotBySeatId = new Map<string, typeof snapshots[number]>()
  for (const s of snapshots) {
    if (!snapshotBySeatId.has(s.seat_id)) snapshotBySeatId.set(s.seat_id, s)
  }

  if (seats.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Usage mới nhất</h2>
        <p className="text-sm text-muted-foreground">
          Chưa có seat nào. {isAdmin ? 'Hãy tạo seat để bắt đầu.' : ''}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Usage mới nhất</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {seats.map((seat) => {
          const snap = snapshotBySeatId.get(seat._id)
          const isHighlighted = seat._id === highlightSeatId
          return (
            <div key={seat._id} ref={isHighlighted ? highlightRef : undefined}
              className={isHighlighted ? 'rounded-lg ring-2 ring-primary' : ''}>
              <UsageSnapshotCard
                seatId={seat._id}
                snapshot={snap}
                seat={seat}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
