// Supabase Edge Function to send push notifications via OneSignal
// OneSignal handles Web Push Protocol and works perfectly with Deno

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') || ''
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') || ''

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

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OneSignal credentials not configured. Add ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY to Edge Function secrets.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get push subscriptions for the user
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get OneSignal player IDs for the user
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('onesignal_player_id')
      .eq('user_id', user_id)
      .not('onesignal_player_id', 'is', null)

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

    // Format notification body
    const dateStr = new Date(event_date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
    const notificationBody = `${title} on ${dateStr}${event_time ? ` at ${event_time}` : ''}`

    // Extract OneSignal player IDs
    const playerIds = subscriptions
      .map(sub => sub.onesignal_player_id)
      .filter(id => id !== null && id !== undefined) as string[]

    if (playerIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No OneSignal player IDs found for user. Make sure user has registered with OneSignal SDK.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Send notification via OneSignal API
    const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: playerIds,
        headings: { en: 'New Calendar Event' },
        contents: { en: notificationBody },
        data: {
          eventId: event_id,
          url: '/',
        },
        url: '/', // URL to open when notification is clicked
      }),
    })

    if (!oneSignalResponse.ok) {
      const errorText = await oneSignalResponse.text()
      console.error('OneSignal API error:', errorText)
      throw new Error(`OneSignal API error: ${oneSignalResponse.status} - ${errorText}`)
    }

    const result = await oneSignalResponse.json()

    return new Response(
      JSON.stringify({
        message: 'Notification sent via OneSignal',
        oneSignalResult: result,
        playerIdsSent: playerIds.length,
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
