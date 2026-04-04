import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { requestFcmToken, onForegroundMessage } from '@/lib/firebase-client'
import { toast } from 'sonner'

/** Register FCM token with backend */
export function useRegisterFcmToken() {
  return useMutation({
    mutationFn: (token: string) =>
      api.post('/api/user/settings/fcm-token', { token }),
  })
}

/** Unregister FCM token */
export function useUnregisterFcmToken() {
  return useMutation({
    mutationFn: (token: string) =>
      api.delete('/api/user/settings/fcm-token', { token }),
  })
}

/** Enable push notifications: request permission + register token */
export function useEnablePush() {
  const register = useRegisterFcmToken()

  return useMutation({
    mutationFn: async () => {
      const token = await requestFcmToken()
      if (!token) throw new Error('Không thể bật thông báo. Hãy cho phép notification trong trình duyệt.')
      await register.mutateAsync(token)
      localStorage.setItem('fcm_token', token)
      return token
    },
  })
}

/** Listen for foreground push messages → show toast + invalidate alert queries */
export function useForegroundMessages() {
  const qc = useQueryClient()
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    unsubRef.current = onForegroundMessage((payload) => {
      const { title, body } = payload.notification ?? {}
      if (title) {
        toast.info(title, { description: body })
      }
      qc.invalidateQueries({ queryKey: ['alerts'] })
    })
    return () => unsubRef.current?.()
  }, [qc])
}
