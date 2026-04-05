import { useState } from 'react'
import { Key, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UsageSnapshotList } from '@/components/usage-snapshot-list'
import { SeatTokenDialog } from '@/components/seat-token-dialog'
import { useSeats } from '@/hooks/use-seats'
import { useAuth } from '@/hooks/use-auth'
import type { Seat as SharedSeat } from '@repo/shared'

export default function UsagePage() {
  const { user } = useAuth()
  const { data: seatsData } = useSeats()
  const isAdmin = user?.role === 'admin'
  const [tokenSeat, setTokenSeat] = useState<SharedSeat | null>(null)

  const seats = seatsData?.seats ?? []
  // Admin sees all seats, owner sees own seats
  const manageableSeats = seats.filter(s => isAdmin || s.owner_id === user?._id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usage Metrics</h1>
        <p className="text-muted-foreground">Theo dõi mức sử dụng thời gian thực từ Anthropic API</p>
      </div>

      {/* Token management section — owner or admin */}
      {manageableSeats.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Quản lý Token</h2>
          <div className="flex flex-wrap gap-2">
            {manageableSeats.map((seat) => {
              const hasError = !!seat.last_fetch_error
              return (
                <Button
                  key={seat._id}
                  variant="outline"
                  size="sm"
                  className={`gap-2 ${hasError ? 'border-destructive/60 bg-destructive/5 hover:bg-destructive/10' : ''}`}
                  onClick={() => setTokenSeat(seat as unknown as SharedSeat)}
                  title={hasError ? `Token lỗi: ${seat.last_fetch_error}` : undefined}
                >
                  <Key className="h-3 w-3" />
                  {seat.label}
                  {hasError ? (
                    <Badge variant="destructive" className="gap-1 text-[10px] px-1">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Token invalid
                    </Badge>
                  ) : (
                    <Badge
                      variant={seat.has_token ? 'default' : 'secondary'}
                      className="text-[10px] px-1"
                    >
                      {seat.has_token ? 'OK' : 'No token'}
                    </Badge>
                  )}
                </Button>
              )
            })}
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
