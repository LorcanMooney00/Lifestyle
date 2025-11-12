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

// Show a notification
export function showNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      ...options,
    })
  }
}

// Set up Supabase Realtime subscription for new calendar events
// Note: Make sure Realtime is enabled for the 'events' table in Supabase:
// 1. Go to Supabase Dashboard → Database → Replication
// 2. Find the 'events' table and enable replication for it
export function subscribeToCalendarEvents(
  userId: string,
  onNewEvent: (event: any) => void
) {
  // Subscribe to new events where the current user is the partner
  const channel = supabase
    .channel('calendar-events')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'events',
        filter: `partner_id=eq.${userId}`,
      },
      (payload) => {
        // Only notify if the event was created by someone else (not the current user)
        if (payload.new.created_by !== userId) {
          onNewEvent(payload.new)
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

