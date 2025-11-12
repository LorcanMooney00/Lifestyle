// Service Worker for Push Notifications
const CACHE_NAME = 'lifestyle-v1'

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...')
  self.skipWaiting() // Activate immediately
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  return self.clients.claim() // Take control of all pages immediately
})

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push event received:', event)
  
  let notificationData = {
    title: 'New Calendar Event',
    body: 'You have a new calendar event',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'calendar-event',
  }

  // If the push event has data, use it
  if (event.data) {
    try {
      const data = event.data.json()
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || notificationData.tag,
        data: data.data || {},
      }
    } catch (e) {
      console.error('Error parsing push data:', e)
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      requireInteraction: false,
    })
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event)
  event.notification.close()

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url === self.location.origin && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow('/')
      }
    })
  )
})

// Handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data)
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

