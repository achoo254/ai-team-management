import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import type { Team } from '@repo/shared/types'
import type { Seat } from '@/hooks/use-seats'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; description?: string; seat_ids: string[]; member_ids: string[] }) => void
  loading?: boolean
  initial: Team | null
  seats: Seat[]
  users: Array<{ id: string; name: string; email: string }>
  isAdmin: boolean
  currentUserId: string
}

export function TeamFormDialog({ open, onClose, onSubmit, loading, initial, seats, users, isAdmin, currentUserId }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setDescription(initial?.description ?? '')
      setSelectedSeatIds(initial?.seats?.map(s => s._id) ?? initial?.seat_ids ?? [])
      setSelectedMemberIds(initial?.members?.map(m => m._id) ?? initial?.member_ids ?? [])
    }
  }, [open, initial])

  // Non-admin can only add seats they own
  const availableSeats = isAdmin ? seats : seats.filter(s => s.owner_id === currentUserId)

  const toggleSeat = (id: string) => {
    setSelectedSeatIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleMember = (id: string) => {
    setSelectedMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({ name: name.trim(), description: description.trim() || undefined, seat_ids: selectedSeatIds, member_ids: selectedMemberIds })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Chỉnh sửa Team' : 'Tạo Team mới'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tên team *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="VD: Team Backend" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mô tả</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả ngắn về team" />
          </div>

          {/* Seat picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Seats ({selectedSeatIds.length})</label>
            <div className="flex flex-wrap gap-1.5 rounded-md border p-2 min-h-[40px]">
              {availableSeats.map(seat => {
                const selected = selectedSeatIds.includes(seat._id)
                return (
                  <Badge
                    key={seat._id}
                    variant={selected ? 'default' : 'outline'}
                    className="cursor-pointer select-none gap-1"
                    onClick={() => toggleSeat(seat._id)}
                  >
                    {seat.label}
                    {selected && <X className="h-3 w-3" />}
                  </Badge>
                )
              })}
              {availableSeats.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Không có seat khả dụng</span>
              )}
            </div>
          </div>

          {/* Member picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Members ({selectedMemberIds.length})</label>
            <div className="flex flex-wrap gap-1.5 rounded-md border p-2 min-h-[40px]">
              {users.map(u => {
                const selected = selectedMemberIds.includes(u.id)
                return (
                  <Badge
                    key={u.id}
                    variant={selected ? 'default' : 'outline'}
                    className="cursor-pointer select-none gap-1"
                    onClick={() => toggleMember(u.id)}
                  >
                    {u.name}
                    {selected && <X className="h-3 w-3" />}
                  </Badge>
                )
              })}
              {users.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Không có user khả dụng</span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Huỷ</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? 'Đang xử lý...' : initial ? 'Cập nhật' : 'Tạo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
