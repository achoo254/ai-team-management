import { useState } from 'react'
import { Key, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UsageSnapshotList } from '@/components/usage-snapshot-list'
import { SeatTokenDialog } from '@/components/seat-token-dialog'
import { useSeats, type Seat } from '@/hooks/use-seats'
import { useCollectSeatUsage, useCollectAllUsage } from '@/hooks/use-usage-snapshots'
import { useAuth } from '@/hooks/use-auth'
import type { Seat as SharedSeat } from '@repo/shared'

export default function UsagePage() {
  const { user } = useAuth()
  const { data: seatsData } = useSeats()
  const isAdmin = user?.role === 'admin'
  const [tokenSeat, setTokenSeat] = useState<SharedSeat | null>(null)
  const collectSeat = useCollectSeatUsage()
  const collectAll = useCollectAllUsage()

  const seats = seatsData?.seats ?? []
  // Admin sees all seats, owner sees own seats
  const manageableSeats = seats.filter(s => isAdmin || s.owner_id === user?._id)
  // Seats with active tokens that user can collect
  const collectableSeats = manageableSeats.filter(s => s.has_token)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usage Metrics</h1>
          <p className="text-muted-foreground">Theo dõi mức sử dụng thời gian thực từ Anthropic API</p>
        </div>
        {/* Collect usage buttons */}
        <div className="flex flex-wrap gap-2">
          {collectableSeats.map((seat) => (
            <Button
              key={seat._id}
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={collectSeat.isPending}
              onClick={() => collectSeat.mutate(seat._id)}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${collectSeat.isPending ? 'animate-spin' : ''}`} />
              {seat.label}
            </Button>
          ))}
          {isAdmin && collectableSeats.length > 1 && (
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              disabled={collectAll.isPending}
              onClick={() => collectAll.mutate()}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${collectAll.isPending ? 'animate-spin' : ''}`} />
              Thu thập tất cả
            </Button>
          )}
        </div>
      </div>

      {/* Token management section — owner or admin */}
      {manageableSeats.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Quản lý Token</h2>
          <div className="flex flex-wrap gap-2">
            {manageableSeats.map((seat) => (
              <Button
                key={seat._id}
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setTokenSeat(seat as unknown as SharedSeat)}
              >
                <Key className="h-3 w-3" />
                {seat.label}
                <Badge
                  variant={seat.has_token ? 'default' : 'secondary'}
                  className="text-[10px] px-1"
                >
                  {seat.has_token ? 'OK' : 'No token'}
                </Badge>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Latest snapshots grid */}
      <UsageSnapshotList />

      {/* Token dialog */}
      <SeatTokenDialog
        seat={tokenSeat}
        open={tokenSeat !== null}
        onOpenChange={(open) => { if (!open) setTokenSeat(null) }}
      />
    </div>
  )
}
