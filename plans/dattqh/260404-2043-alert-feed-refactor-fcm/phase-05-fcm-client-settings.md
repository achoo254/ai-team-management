# Phase 5: FCM Client Integration + Settings UI

## Overview
- **Priority**: Medium
- **Status**: pending
- **Effort**: M

## Context Links
- [Plan Overview](./plan.md)
- [Phase 2: FCM Service](./phase-02-fcm-service.md) — depends on backend FCM endpoints
- Firebase Auth already configured in `packages/web/src/lib/firebase-client.ts`

## Key Insights
- Firebase client SDK already initialized (firebase/app + firebase/auth)
- Need to add `firebase/messaging` — same app instance, just getMessaging()
- Service worker `firebase-messaging-sw.js` must be at web root (`packages/web/public/`)
- VAPID key needed → generated via Firebase Console > Cloud Messaging > Web Push certificates
- New env var: `VITE_FIREBASE_VAPID_KEY`
- FCM permission request must happen on user action (not on page load) — browser requirement
- Settings page already has AlertSettingsForm → extend or add PushSettingsForm next to it

## Related Code Files

### Files to modify
- `packages/web/src/lib/firebase-client.ts` — add messaging init + token request
- `packages/web/src/components/alert-settings-form.tsx` — add push notification toggle
- `packages/web/src/hooks/use-user-settings.ts` — add FCM token mutation, push_enabled to settings type
- `packages/web/src/pages/settings.tsx` — may need to add push settings section

### Files to create
- `packages/web/public/firebase-messaging-sw.js` — FCM service worker
- `packages/web/src/hooks/use-fcm.ts` — FCM token management hook

## Implementation Steps

### 1. Create Service Worker (`packages/web/public/firebase-messaging-sw.js`)

```javascript
// Firebase messaging service worker for background push notifications
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: self.__FIREBASE_CONFIG__?.apiKey,
  projectId: self.__FIREBASE_CONFIG__?.projectId,
  messagingSenderId: self.__FIREBASE_CONFIG__?.messagingSenderId,
  appId: self.__FIREBASE_CONFIG__?.appId,
});

const messaging = firebase.messaging();

// Background message handler (when app is not in focus)
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  if (title) {
    self.registration.showNotification(title, {
      body: body ?? '',
      icon: '/favicon.ico',
      data: payload.data,
    });
  }
});

// Click handler — open app to /alerts
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/alerts';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      // Otherwise open new tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
```

**Note**: Service worker config injection handled at registration time (Step 2).

### 2. Extend Firebase Client (`packages/web/src/lib/firebase-client.ts`)

```typescript
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging'

let _messaging: Messaging | undefined

/** Get Firebase Messaging instance (lazy init) */
export function getFirebaseMessaging(): Messaging | null {
  // Messaging requires service worker support
  if (!('serviceWorker' in navigator)) return null
  if (!_messaging) _messaging = getMessaging(getApp())
  return _messaging
}

/** Request notification permission + get FCM token */
export async function requestFcmToken(): Promise<string | null> {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    console.warn('[FCM] VITE_FIREBASE_VAPID_KEY not configured')
    return null
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const messaging = getFirebaseMessaging()
  if (!messaging) return null

  // Register service worker with Firebase config
  const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js')

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: sw,
  })
  return token
}

/** Listen for foreground messages */
export function onForegroundMessage(callback: (payload: any) => void): () => void {
  const messaging = getFirebaseMessaging()
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}
```

### 3. Create FCM Hook (`packages/web/src/hooks/use-fcm.ts`)

```typescript
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
      // Store token locally for later cleanup
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
      // Refresh alert data
      qc.invalidateQueries({ queryKey: ['alerts'] })
    })
    return () => unsubRef.current?.()
  }, [qc])
}
```

### 4. Update Alert Settings Form (`packages/web/src/components/alert-settings-form.tsx`)

Add push notification toggle section:
```typescript
// Add to existing form, below Telegram alert toggle:

// Push notification section
<div className="flex items-center gap-3">
  <Label className="text-xs">Desktop Push Notification</Label>
  {!pushSupported ? (
    <span className="text-xs text-muted-foreground">Trình duyệt không hỗ trợ</span>
  ) : pushDenied ? (
    <span className="text-xs text-amber-600">
      Đã bị chặn. Vào Settings trình duyệt để bật lại.
    </span>
  ) : (
    <Button size="sm" variant={pushEnabled ? "default" : "outline"}
      onClick={handleTogglePush} disabled={enablePush.isPending}>
      {enablePush.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
      {pushEnabled ? "Đang bật" : "Bật"}
    </Button>
  )}
</div>
```

State management:
```typescript
const pushSupported = 'Notification' in window && 'serviceWorker' in navigator
const pushDenied = Notification.permission === 'denied'
const pushEnabled = settings?.push_enabled ?? false
const enablePush = useEnablePush()

async function handleTogglePush() {
  if (pushEnabled) {
    // Disable: update settings + unregister token
    const token = localStorage.getItem('fcm_token')
    if (token) await unregisterFcm.mutateAsync(token)
    await updateSettings.mutateAsync({ push_enabled: false })
  } else {
    // Enable: request permission + register token + update settings
    await enablePush.mutateAsync()
    await updateSettings.mutateAsync({ push_enabled: true })
  }
}
```

### 5. Update User Settings Hook (`packages/web/src/hooks/use-user-settings.ts`)

```typescript
// Add to UserSettings interface:
push_enabled: boolean;

// Add push_enabled to mutation body type:
push_enabled?: boolean;
```

### 6. Activate Foreground Listener

In `packages/web/src/app.tsx` or `dashboard-shell.tsx`, add the foreground listener:
```typescript
import { useForegroundMessages } from '@/hooks/use-fcm'

// Inside DashboardShell component:
export function DashboardShell() {
  useForegroundMessages()  // Listen for push while app is open
  // ... rest of component
}
```

### 7. Environment Variable

Add to `packages/web/.env.example`:
```
VITE_FIREBASE_VAPID_KEY=   # Firebase Cloud Messaging VAPID key
```

## Todo List
- [ ] Create firebase-messaging-sw.js service worker
- [ ] Extend firebase-client.ts with messaging functions
- [ ] Create use-fcm.ts hook (register/unregister/enable/foreground listener)
- [ ] Add push toggle to alert-settings-form.tsx
- [ ] Update use-user-settings.ts with push_enabled field
- [ ] Add useForegroundMessages() to DashboardShell
- [ ] Add VITE_FIREBASE_VAPID_KEY to .env.example
- [ ] Run `pnpm build` to verify compilation

## Success Criteria
- FCM permission prompt appears on toggle click (not auto)
- Push notifications received when app is backgrounded
- Foreground messages show as toast + refresh alert data
- Toggle on/off works correctly with token registration/cleanup
- Stale token scenario handled gracefully
- Works across Chrome, Edge, Firefox (Safari limited)

## Risk Assessment
- **VAPID key**: Must be generated in Firebase Console → manual step, document in deployment guide
- **Service worker scope**: Must be at root `/` → placed in `public/` dir, Vite serves as-is
- **Browser compat**: Safari push has limitations → graceful degradation (pushSupported check)
- **Permission denied**: Once denied, user must go to browser settings → show clear guidance text

## Security Considerations
- FCM token is device-specific, not sensitive (can't receive messages without Firebase project access)
- Token stored in localStorage for cleanup purposes only
- Backend validates auth before accepting token registration
