import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let _app: FirebaseApp | undefined
let _auth: Auth | undefined
let _messaging: Messaging | undefined

function getApp() {
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  }
  return _app
}

/** Lazy init — avoids errors when env vars are missing at startup */
export function getFirebaseAuth() {
  if (!_auth) _auth = getAuth(getApp())
  return _auth
}

export const googleProvider = new GoogleAuthProvider()

/** Get Firebase Messaging instance (lazy init) */
export function getFirebaseMessaging(): Messaging | null {
  if (!('serviceWorker' in navigator)) return null
  if (!firebaseConfig.messagingSenderId || !firebaseConfig.appId) return null
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

  // Register service worker with Firebase config via query params
  const swParams = new URLSearchParams({
    apiKey: firebaseConfig.apiKey ?? '',
    projectId: firebaseConfig.projectId ?? '',
    messagingSenderId: firebaseConfig.messagingSenderId ?? '',
    appId: firebaseConfig.appId ?? '',
  })
  const sw = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${swParams}`)

  return getToken(messaging, { vapidKey, serviceWorkerRegistration: sw })
}

/** Listen for foreground messages */
export function onForegroundMessage(callback: (payload: any) => void): () => void {
  const messaging = getFirebaseMessaging()
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}
