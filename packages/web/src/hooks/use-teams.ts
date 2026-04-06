import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Team } from '@repo/shared/types'
import { toast } from 'sonner'

const KEY = ['teams']

export function useTeams() {
  return useQuery<{ teams: Team[] }>({
    queryKey: KEY,
    queryFn: () => api.get('/api/teams'),
  })
}

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; description?: string; seat_ids?: string[]; member_ids?: string[] }) =>
      api.post('/api/teams', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success('Tạo team thành công') },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUpdateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; description?: string; seat_ids?: string[]; member_ids?: string[] }) =>
      api.put(`/api/teams/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success('Cập nhật team thành công') },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/teams/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success('Xóa team thành công') },
    onError: (e: Error) => toast.error(e.message),
  })
}
