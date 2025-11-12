// Supabase Edge Function to send push notifications
// This function receives event data and sends push notifications to subscribed users

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as webpush from 'https://deno.land/x/webpush@v1.0.0/mod.ts'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:your-email@example.com'

serve(async (req) => {
  try {
    // Get the event data from the request
    const { event_id, user_id, title, event_date, event_time, created_by } = await req.json()

    if (!user_id || !title) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get push subscriptions for the user
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id)

    if (error) {
      console.error('Error fetching subscriptions:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No subscriptions found for user' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get creator name (optional - you can fetch this from the database)
    const dateStr = new Date(event_date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })

    const notificationBody = `${title} on ${dateStr}${event_time ? ` at ${event_time}` : ''}`

    // Send push notification to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const subscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        }

        const payload = JSON.stringify({
          title: 'New Calendar Event',
          body: notificationBody,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: `event-${event_id}`,
          data: {
            eventId: event_id,
            url: '/',
          },
        })

        await webpush.sendNotification(subscription, payload, {
          vapidDetails: {
            subject: VAPID_SUBJECT,
            publicKey: VAPID_PUBLIC_KEY,
            privateKey: VAPID_PRIVATE_KEY,
          },
        })
      })
    )

    const successful = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    return new Response(
      JSON.stringify({
        message: `Sent ${successful} notifications, ${failed} failed`,
        successful,
        failed,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error sending push notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

