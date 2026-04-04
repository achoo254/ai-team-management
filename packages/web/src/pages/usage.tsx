import { useState } from 'react'
import { Key } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UsageSnapshotList } from '@/components/usage-snapshot-list'
import { SeatTokenDialog } from '@/components/seat-token-dialog'
import { useSeats, type Seat } from '@/hooks/use-seats'
import { useAuth } from '@/hooks/use-auth'
import type { Seat as SharedSeat } from '@repo/shared'

export default function UsagePage() {
  const { user } = useAuth()
  const { data: seatsData } = useSeats()
  const isAdmin = user?.role === 'admin'
  const [tokenSeat, setTokenSeat] = useState<SharedSeat | null>(null)

  const seats = seatsData?.seats ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usage Metrics</h1>
        <p className="text-muted-foreground">Theo dõi mức sử dụng thời gian thực từ Anthropic API</p>
      </div>

      {/* Token management section — admin only */}
      {isAdmin && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Quản lý Token</h2>
          <div className="flex flex-wrap gap-2">
            {seats.map((seat) => (
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
