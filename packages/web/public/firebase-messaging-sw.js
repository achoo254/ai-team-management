/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js')

// Config injected via query params at registration time
const urlParams = new URL(location.href).searchParams
const config = {
  apiKey: urlParams.get('apiKey'),
  projectId: urlParams.get('projectId'),
  messagingSenderId: urlParams.get('messagingSenderId'),
  appId: urlParams.get('appId'),
}

if (config.apiKey) {
  firebase.initializeApp(config)
  const messaging = firebase.messaging()

  // Background message handler (app not in focus)
  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification ?? {}
    if (title) {
      self.registration.showNotification(title, {
        body: body ?? '',
        icon: '/favicon.ico',
        data: payload.data,
      })
    }
  })
}

// Click handler — open app to /alerts
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/alerts'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    }),
  )
})
