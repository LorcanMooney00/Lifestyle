import { supabase } from '../supabaseClient'

export interface PushSubscription {
  id?: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  onesignal_player_id?: string
}

export async function savePushSubscription(subscription: PushSubscription): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: subscription.user_id,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      onesignal_player_id: subscription.onesignal_player_id || null,
    }, {
      onConflict: 'user_id,endpoint'
    })

  if (error) {
    console.error('Error saving push subscription:', error)
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint)

  if (error) {
    console.error('Error deleting push subscription:', error)
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

export async function getPushSubscriptions(userId: string): Promise<PushSubscription[]> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching push subscriptions:', error)
    return []
  }

  return (data || []) as PushSubscription[]
}

export async function saveOneSignalPlayerId(userId: string, playerId: string): Promise<{ success: boolean; error: string | null }> {
  // First, check if a record with this player_id already exists for this user
  const { data: existingWithPlayerId } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('onesignal_player_id', playerId)
    .limit(1)
    .maybeSingle()

  // If it already exists with this player_id, we're done
  if (existingWithPlayerId) {
    return { success: true, error: null }
  }

  // Check if there's an existing record without a player_id (or with a different one)
  const { data: existingWithoutPlayerId } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .is('onesignal_player_id', null)
    .limit(1)
    .maybeSingle()

  if (existingWithoutPlayerId) {
    // Update the existing record that has no player_id
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ onesignal_player_id: playerId })
      .eq('id', existingWithoutPlayerId.id)

    if (error) {
      console.error('Error updating OneSignal player ID:', error)
      return { success: false, error: error.message }
    }
  } else {
    // Check if there's any existing record for this user (with a different player_id)
    const { data: anyExisting } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (anyExisting) {
      // Delete the old record first to avoid unique constraint violation
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', anyExisting.id)
    }

    // Create new entry
    const { error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: userId,
        endpoint: `onesignal://${playerId}`, // Placeholder endpoint
        p256dh: '', // Not needed for OneSignal
        auth: '', // Not needed for OneSignal
        onesignal_player_id: playerId,
      })

    if (error) {
      console.error('Error creating OneSignal subscription:', error)
      return { success: false, error: error.message }
    }
  }

  return { success: true, error: null }
}

