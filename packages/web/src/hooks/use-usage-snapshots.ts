import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'
import type { UsageSnapshot } from '@repo/shared'

const SNAPSHOTS_KEY = ['usage-snapshots']
const LATEST_KEY = ['usage-snapshots', 'latest']

export function useLatestSnapshots() {
  return useQuery<{ snapshots: UsageSnapshot[] }>({
    queryKey: LATEST_KEY,
    queryFn: () => api.get('/api/usage-snapshots/latest'),
  })
}

export function useUsageSnapshots(params: {
  seatId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}) {
  const query = new URLSearchParams()
  if (params.seatId) query.set('seatId', params.seatId)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.limit) query.set('limit', String(params.limit))
  if (params.offset) query.set('offset', String(params.offset))

  return useQuery<{ snapshots: UsageSnapshot[]; total: number }>({
    queryKey: [...SNAPSHOTS_KEY, params],
    queryFn: () => api.get(`/api/usage-snapshots?${query.toString()}`),
  })
}

export function useCollectAllUsage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ success: number; errors: number }>('/api/usage-snapshots/collect'),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: LATEST_KEY })
      qc.invalidateQueries({ queryKey: SNAPSHOTS_KEY })
      const d = data as { success: number; errors: number }
      toast.success(`Thu thập xong: ${d.success} thành công, ${d.errors} lỗi`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useCollectSeatUsage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (seatId: string) => api.post(`/api/usage-snapshots/collect/${seatId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LATEST_KEY })
      toast.success('Thu thập usage thành công')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useSetSeatToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ seatId, access_token }: { seatId: string; access_token: string }) =>
      api.put(`/api/seats/${seatId}/token`, { access_token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seats'] })
      toast.success('Đã cập nhật token')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useRemoveSeatToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (seatId: string) => api.delete(`/api/seats/${seatId}/token`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seats'] })
      toast.success('Đã xoá token')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
