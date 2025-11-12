import { supabase } from './supabaseClient'
import { savePushSubscription, type PushSubscription } from './api'

// Request notification permission and register for push
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications')
    return false
  }

  if (Notification.permission === 'granted') {
    // Already granted, try to register for push
    await registerPushSubscription()
    return true
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      // Register for push notifications
      await registerPushSubscription()
      return true
    }
  }

  return false
}

// Register for Web Push API
async function registerPushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications are not supported in this browser')
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    
    // Check if we already have a subscription
    let subscription = await registration.pushManager.getSubscription()
    
    if (!subscription) {
      // Subscribe to push notifications
      // Note: You'll need to add VAPID public key here
      // For now, we'll try without it (some browsers support it)
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      
      if (!vapidPublicKey) {
        console.warn('VAPID public key not configured. Push notifications may not work.')
        return
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
    }

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('No user logged in, cannot save push subscription')
      return
    }

    // Extract subscription details
    const subscriptionData: PushSubscription = {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
      auth: arrayBufferToBase64(subscription.getKey('auth')!),
    }

    // Save to database
    await savePushSubscription(subscriptionData)
    console.log('Push subscription registered and saved')
  } catch (error) {
    console.error('Error registering push subscription:', error)
  }
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

// Show a notification (uses service worker if available, otherwise falls back to regular notifications)
export async function showNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission !== 'granted') {
    return
  }

  // Try to use service worker notification first (better for mobile)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        ...options,
      })
      return
    } catch (error) {
      console.log('Service worker notification failed, falling back to regular notification:', error)
    }
  }

  // Fallback to regular notification
  new Notification(title, {
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    ...options,
  })
}

// Set up Supabase Realtime subscription for new calendar events
// Note: Make sure Realtime is enabled for the 'events' table in Supabase:
// 1. Go to Supabase Dashboard → Database → Publications
// 2. Find the 'events' table and enable replication for it
export function subscribeToCalendarEvents(
  userId: string,
  onNewEvent: (event: any) => void,
  onStatusChange?: (status: string) => void
) {
  console.log('Setting up calendar event subscription for user:', userId)
  
  // Create a unique channel name per device to ensure both devices can subscribe independently
  const channelName = `calendar-events-${userId}-${Date.now()}`
  
  // Subscribe to all new events and filter in code (more reliable than filter syntax)
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'events',
      },
      (payload) => {
        console.log('Received event insert:', payload.new)
        const newEvent = payload.new as any
        
        // Check if this event is for the current user (partner_id matches)
        if (newEvent.partner_id === userId && newEvent.created_by !== userId) {
          console.log('Event matches! Notifying user:', newEvent)
          onNewEvent(newEvent)
        } else {
          console.log('Event does not match filter:', {
            partner_id: newEvent.partner_id,
            userId,
            created_by: newEvent.created_by,
            matches: newEvent.partner_id === userId && newEvent.created_by !== userId
          })
        }
      }
    )
    .subscribe((status) => {
      console.log('Subscription status:', status)
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to calendar events on this device')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.error('Subscription error or closed:', status)
      }
      
      // Notify parent about status changes
      if (onStatusChange) {
        onStatusChange(status)
      }
    })

  return () => {
    console.log('Unsubscribing from calendar events')
    supabase.removeChannel(channel)
  }
}

