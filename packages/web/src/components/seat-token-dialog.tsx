import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useSetSeatToken, useRemoveSeatToken } from '@/hooks/use-usage-snapshots'
import type { Seat } from '@repo/shared'

interface Props {
  seat: Seat | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SeatTokenDialog({ seat, open, onOpenChange }: Props) {
  const [token, setToken] = useState('')
  const setMutation = useSetSeatToken()
  const removeMutation = useRemoveSeatToken()

  // Reset token input when switching seat
  useEffect(() => { setToken('') }, [seat?._id])

  if (!seat) return null

  const handleSave = () => {
    if (!token.trim()) return
    setMutation.mutate(
      { seatId: seat._id, access_token: token.trim() },
      { onSuccess: () => { setToken(''); onOpenChange(false) } },
    )
  }

  const handleRemove = () => {
    removeMutation.mutate(seat._id, {
      onSuccess: () => { setToken(''); onOpenChange(false) },
    })
  }

  const isPending = setMutation.isPending || removeMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Token — {seat.label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={seat.has_token ? 'default' : 'secondary'}>
              {seat.has_token ? 'Has token' : 'No token'}
            </Badge>
            {seat.token_active && <Badge variant="default">Active</Badge>}
          </div>

          {seat.last_fetch_error && (
            <p className="text-sm text-destructive">Lỗi: {seat.last_fetch_error}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="access-token">Access Token</Label>
            <Input
              id="access-token"
              type="password"
              placeholder="Paste access token..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {seat.has_token && (
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={isPending}
            >
              Xoá Token
            </Button>
          )}
          <Button onClick={handleSave} disabled={isPending || !token.trim()}>
            {isPending ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
