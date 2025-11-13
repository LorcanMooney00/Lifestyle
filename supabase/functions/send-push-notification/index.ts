// Supabase Edge Function to send push notifications via OneSignal
// OneSignal handles Web Push Protocol and works perfectly with Deno

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') || ''
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') || ''

serve(async (req) => {
  try {
    // Get the notification data from the request
    const body = await req.json()
    const { 
      type = 'event', // 'event', 'todo', 'note', 'shopping'
      event_id, 
      todo_id,
      note_id,
      shopping_id,
      user_id, 
      title, 
      content,
      item_name,
      event_date, 
      event_time, 
      created_by 
    } = body

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: user_id' }),
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

    // Format notification based on type
    let notificationHeading = 'New Notification'
    let notificationBody = ''
    let notificationData: any = { url: '/' }

    switch (type) {
      case 'event':
        const dateStr = event_date ? new Date(event_date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }) : ''
        notificationHeading = 'New Calendar Event'
        notificationBody = title ? `${title}${dateStr ? ` on ${dateStr}` : ''}${event_time ? ` at ${event_time}` : ''}` : 'New calendar event'
        notificationData = { eventId: event_id, url: '/app/calendar' }
        break
      
      case 'todo':
        notificationHeading = 'New To-Do'
        notificationBody = content || 'New to-do item'
        notificationData = { todoId: todo_id, url: '/app/todos' }
        break
      
      case 'note':
        notificationHeading = 'New Note'
        notificationBody = title || 'New note shared with you'
        notificationData = { noteId: note_id, url: '/app/notes' }
        break
      
      case 'shopping':
        notificationHeading = 'New Shopping Item'
        notificationBody = item_name || 'New item added to shopping list'
        notificationData = { shoppingId: shopping_id, url: '/app/shopping' }
        break
      
      default:
        notificationHeading = 'New Update'
        notificationBody = title || content || item_name || 'You have a new update'
    }

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
        headings: { en: notificationHeading },
        contents: { en: notificationBody },
        data: notificationData,
        url: notificationData.url, // URL to open when notification is clicked
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
