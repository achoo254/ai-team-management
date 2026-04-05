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
    mutationFn: ({ seatId, credential_json }: { seatId: string; credential_json: string }) =>
      api.put(`/api/seats/${seatId}/token`, { credential_json }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seats'] })
      toast.success('Đã cập nhật credential')
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
