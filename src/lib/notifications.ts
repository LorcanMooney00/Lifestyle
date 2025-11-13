import { supabase } from './supabaseClient'
import { savePushSubscription, saveOneSignalPlayerId, type PushSubscription } from './api'

// Declare OneSignal types
declare global {
  interface Window {
    OneSignal?: {
      init: (options: { appId: string }) => Promise<void>
      isPushNotificationsEnabled?: () => Promise<boolean>
      registerForPushNotifications?: () => Promise<void>
      getUserId?: () => Promise<string | null>
      setNotificationOpenedHandler?: (handler: (result: any) => void) => void
      Notifications?: {
        requestPermission: () => Promise<NotificationPermission>
      }
      User?: {
        PushSubscription?: {
          id?: string | null
          optedIn?: boolean
        }
      }
    }
    OneSignalDeferred?: Array<(OneSignal: any) => void>
  }
}

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

// Register for push notifications using OneSignal
async function registerPushSubscription(): Promise<void> {
  console.log('Starting OneSignal push subscription registration...')
  
  const oneSignalAppId = import.meta.env.VITE_ONESIGNAL_APP_ID
  
  if (!oneSignalAppId) {
    console.error('❌ OneSignal App ID not configured!')
    console.error('Add VITE_ONESIGNAL_APP_ID to your .env file')
    // Fallback to native Web Push if OneSignal not configured
    await registerNativePushSubscription()
    return
  }

  try {
    // Wait for OneSignal SDK to load via OneSignalDeferred
    // The SDK initializes in index.html, so we wait for it to be ready
    console.log('Waiting for OneSignal to initialize...')
    
    // First check if already ready (might have initialized before this code runs)
    // OneSignal v16 API might be different - check multiple ways
    const isReady = window.OneSignal && (
      (typeof window.OneSignal.isPushNotificationsEnabled === 'function') ||
      (window.OneSignal.Notifications && typeof window.OneSignal.Notifications.requestPermission === 'function') ||
      (window.OneSignal.User && typeof window.OneSignal.User.PushSubscription !== 'undefined')
    )
    
    if (isReady && window.OneSignal) {
      console.log('✅ OneSignal already ready!')
      console.log('OneSignal structure:', {
        hasIsPushNotificationsEnabled: typeof window.OneSignal.isPushNotificationsEnabled === 'function',
        hasNotifications: !!window.OneSignal.Notifications,
        hasUser: !!window.OneSignal.User,
        keys: Object.keys(window.OneSignal || {})
      })
    } else {
      // Wait for the custom event or poll until ready
      const waitForOneSignal = new Promise((resolve) => {
        let resolved = false
        
        // Wait for the custom event
        const handler = () => {
          if (!resolved) {
            resolved = true
            console.log('✅ OneSignal ready event received!')
            window.removeEventListener('onesignal-ready', handler)
            resolve(true)
          }
        }
        window.addEventListener('onesignal-ready', handler)
        
        // Also poll as fallback (check immediately and then periodically)
        let attempts = 0
        const maxAttempts = 100 // 10 seconds
        const pollInterval = setInterval(() => {
          const isReady = window.OneSignal && (
            (typeof window.OneSignal.isPushNotificationsEnabled === 'function') ||
            (window.OneSignal.Notifications && typeof window.OneSignal.Notifications.requestPermission === 'function') ||
            (window.OneSignal.User && typeof window.OneSignal.User.PushSubscription !== 'undefined')
          )
          
          if (isReady) {
            if (!resolved) {
              resolved = true
              clearInterval(pollInterval)
              window.removeEventListener('onesignal-ready', handler)
              console.log('✅ OneSignal detected via polling!')
              resolve(true)
            }
          } else if (attempts >= maxAttempts) {
            if (!resolved) {
              resolved = true
              clearInterval(pollInterval)
              window.removeEventListener('onesignal-ready', handler)
              console.error('❌ OneSignal not ready after waiting')
              resolve(false)
            }
          }
          attempts++
        }, 100)
      })
      
      const oneSignalReady = await waitForOneSignal

      if (!oneSignalReady || !window.OneSignal) {
        console.error('❌ OneSignal SDK failed to initialize after waiting')
        console.log('⚠️ Falling back to native Web Push (works when app is open, but NOT when closed)')
        console.log('💡 For notifications when app is closed, OneSignal must initialize')
        await registerNativePushSubscription()
        return
      }
    }
    
    console.log('✅ OneSignal is ready!')
    console.log('OneSignal API structure:', {
      hasIsPushNotificationsEnabled: typeof window.OneSignal?.isPushNotificationsEnabled === 'function',
      hasNotifications: !!window.OneSignal?.Notifications,
      hasUser: !!window.OneSignal?.User,
      allKeys: Object.keys(window.OneSignal || {})
    })

    // Try different ways to check subscription status and get player ID
    let isEnabled = false
    let playerId: string | null = null

    // Method 1: Try direct methods (older API)
    if (typeof window.OneSignal?.isPushNotificationsEnabled === 'function') {
      console.log('Using direct API methods...')
      isEnabled = await window.OneSignal.isPushNotificationsEnabled()
      console.log('OneSignal push enabled:', isEnabled)

      if (!isEnabled && window.OneSignal.registerForPushNotifications) {
        console.log('Requesting push notification permission...')
        await window.OneSignal.registerForPushNotifications()
        console.log('✅ OneSignal push notification permission requested')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      if (window.OneSignal.getUserId) {
        playerId = await window.OneSignal.getUserId()
      }
      console.log('Player ID (direct method):', playerId)
    } 
    // Method 2: Try v16 API structure
    else if (window.OneSignal?.User) {
      console.log('Using OneSignal v16 API structure...')
      try {
        // Check subscription status
        const subscription = window.OneSignal.User.PushSubscription
        isEnabled = subscription?.optedIn || false
        console.log('OneSignal push enabled (v16):', isEnabled)

        if (!isEnabled) {
          console.log('Requesting push notification permission (v16)...')
          if (window.OneSignal.Notifications) {
            await window.OneSignal.Notifications.requestPermission()
          }
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

        // Get player ID
        playerId = window.OneSignal.User.PushSubscription?.id || null
        console.log('Player ID (v16 method):', playerId)
      } catch (error) {
        console.error('Error using v16 API:', error)
      }
    }

    // Get player ID - try multiple times with delays if still null
    console.log('Getting OneSignal Player ID (final check)...')
    if (!playerId && window.OneSignal?.getUserId) {
      playerId = await window.OneSignal.getUserId()
      console.log('First attempt - Player ID:', playerId)
    }
    
    if (!playerId) {
      console.log('Player ID not ready, waiting 2 seconds...')
      await new Promise(resolve => setTimeout(resolve, 2000))
      if (typeof window.OneSignal?.getUserId === 'function') {
        playerId = await window.OneSignal.getUserId()
      }
      console.log('Second attempt - Player ID:', playerId)
    }
    
    if (!playerId) {
      console.log('Player ID still not ready, waiting 3 more seconds...')
      await new Promise(resolve => setTimeout(resolve, 3000))
      if (typeof window.OneSignal?.getUserId === 'function') {
        playerId = await window.OneSignal.getUserId()
      }
      console.log('Third attempt - Player ID:', playerId)
    }
    
    console.log('Final OneSignal Player ID:', playerId)
    
    if (!playerId) {
      console.warn('⚠️ OneSignal Player ID is null. User may need to accept push permission or wait longer.')
      console.warn('💡 Try refreshing the page and accepting push permission again.')
    }

    if (playerId) {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('Error getting user or not logged in')
        return
      }

      // Save OneSignal player ID to database
      const result = await saveOneSignalPlayerId(user.id, playerId)
      if (result.success) {
        console.log('✅ OneSignal player ID saved to database!')
      } else {
        console.error('❌ Failed to save OneSignal player ID:', result.error)
      }
    }

    // Set up notification click handler (if method exists)
    if (typeof window.OneSignal?.setNotificationOpenedHandler === 'function') {
      window.OneSignal.setNotificationOpenedHandler((result) => {
        console.log('Notification clicked:', result)
        // You can navigate to a specific page here if needed
        window.focus()
      })
    }
  } catch (error) {
    console.error('❌ Error registering OneSignal:', error)
    // Fallback to native Web Push
    await registerNativePushSubscription()
  }
}

// Fallback: Register for native Web Push API (if OneSignal not available)
async function registerNativePushSubscription(): Promise<void> {
  console.log('Falling back to native Web Push...')
  
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.error('Push notifications are not supported in this browser')
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    
    if (!subscription) {
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        console.warn('VAPID key not configured, skipping native push registration')
        return
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const subscriptionData: PushSubscription = {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
      auth: arrayBufferToBase64(subscription.getKey('auth')!),
    }

    await savePushSubscription(subscriptionData)
    console.log('✅ Native push subscription saved')
  } catch (error) {
    console.error('Error with native push:', error)
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

