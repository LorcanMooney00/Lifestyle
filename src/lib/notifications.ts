import { supabase } from './supabaseClient'

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  return false
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
  onNewEvent: (event: any) => void
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
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Error subscribing to calendar events')
      }
    })

  return () => {
    console.log('Unsubscribing from calendar events')
    supabase.removeChannel(channel)
  }
}

