import { supabase } from './supabaseClient'
import type { Topic, Note, TopicMember, Event } from '../types'

export async function getTopics(): Promise<Topic[]> {
  // RLS policies will automatically filter to topics user has access to
  // (owned, member of, or partner's topics)
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching topics:', error)
    return []
  }

  return data || []
}

export async function createTopic(name: string, ownerId: string): Promise<{ topic: Topic | null; error: string | null }> {
  const { data, error } = await supabase
    .from('topics')
    .insert({ name, owner_id: ownerId })
    .select()
    .single()

  if (error) {
    console.error('Error creating topic:', error)
    return { topic: null, error: error.message }
  }

  if (!data) {
    console.error('No data returned from topic creation')
    return { topic: null, error: 'No data returned from server' }
  }

  // Add owner as member
  const { error: memberError } = await supabase
    .from('topic_members')
    .insert({
      topic_id: data.id,
      user_id: ownerId,
      role: 'owner',
    })

  if (memberError) {
    console.error('Error adding owner as member:', memberError)
    // Topic was created but member wasn't added - still return the topic
    // as the user owns it anyway
  }

  return { topic: data, error: null }
}

export async function getAllNotes(): Promise<Array<Note & { creator_username?: string | null }>> {
  // RLS policies will automatically filter to notes from topics user has access to
  // (owned, member of, or partner's topics)
  // Join with user_profiles to get creator username
  const { data, error } = await supabase
    .from('notes')
    .select(`
      *,
      creator:user_profiles!notes_created_by_fkey(username)
    `)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching notes:', error)
    return []
  }

  if (!data) return []

  // Map the data to include creator_username
  return data.map((note: any) => ({
    ...note,
    creator_username: note.creator?.username || null,
  }))
}

export async function getNotes(topicId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('topic_id', topicId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching notes:', error)
    return []
  }

  return data || []
}

export async function createNote(
  title: string | null,
  content: string | null,
  createdBy: string
): Promise<Note | null> {
  // Get or create a default topic for the user
  const topics = await getTopics()
  let defaultTopic: Topic | null = topics.find((t) => t.name === 'General') || topics[0] || null

  // If no topics exist, create a default "General" topic
  if (!defaultTopic) {
    const result = await createTopic('General', createdBy)
    defaultTopic = result.topic
  }

  if (!defaultTopic) {
    console.error('Could not create or find default topic')
    return null
  }

  const { data, error } = await supabase
    .from('notes')
    .insert({
      topic_id: defaultTopic.id,
      title,
      content,
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating note:', error)
    return null
  }

  return data
}

export async function updateNote(
  noteId: string,
  updates: { title?: string | null; content?: string | null }
): Promise<Note | null> {
  const { data, error } = await supabase
    .from('notes')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select()
    .single()

  if (error) {
    console.error('Error updating note:', error)
    return null
  }

  return data
}

export async function deleteNote(noteId: string): Promise<boolean> {
  const { error } = await supabase.from('notes').delete().eq('id', noteId)

  if (error) {
    console.error('Error deleting note:', error)
    return false
  }

  return true
}

export async function addTopicMember(
  topicId: string,
  userId: string,
  role: 'owner' | 'editor' | 'viewer' = 'editor'
): Promise<TopicMember | null> {
  const { data, error } = await supabase
    .from('topic_members')
    .insert({
      topic_id: topicId,
      user_id: userId,
      role,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding topic member:', error)
    return null
  }

  return data
}

export async function getUserProfile(userId: string): Promise<{ username: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('username')
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No profile found
      return { username: null, error: null }
    }
    console.error('Error fetching user profile:', error)
    return { username: null, error: error.message }
  }

  return { username: data?.username || null, error: null }
}

export async function updateUserProfile(userId: string, username: string): Promise<{ success: boolean; error: string | null }> {
  // Use upsert to either update existing profile or create new one
  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: userId,
        username,
      },
      {
        onConflict: 'id',
      }
    )

  if (error) {
    console.error('Error updating user profile:', error)
    // Check for unique constraint violation (username already taken)
    if (error.code === '23505' || error.message.includes('unique')) {
      return { success: false, error: 'This username is already taken. Please choose another.' }
    }
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

export async function getPartners(userId: string): Promise<Array<{ id: string; email: string; username: string }>> {
  // Use RPC function to get partners with emails
  const { data, error } = await supabase.rpc('get_partners_with_emails', {
    p_user_id: userId,
  })

  if (error) {
    console.error('Error fetching partners with emails:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    // Fallback: get partner IDs only
    const { data: links } = await supabase
      .from('partner_links')
      .select('partner_id')
      .eq('user_id', userId)

    if (links && links.length > 0) {
      console.warn('Using fallback: partner emails not available. Make sure get_partners_with_emails function exists in Supabase.')
    }

    return (links || []).map((link: any) => ({
      id: link.partner_id,
      email: `Partner ${link.partner_id.slice(0, 8)}`,
      username: `Partner ${link.partner_id.slice(0, 8)}`,
    }))
  }

  console.log('Partners data received:', data)
  
  if (!data || data.length === 0) {
    return []
  }

  const mapped = data.map((row: any) => {
    console.log('Mapping partner row:', row)
    return {
      id: row.partner_id,
      email: row.email || 'Unknown',
      username: row.username || row.email || 'Unknown',
    }
  })
  
  console.log('Mapped partners:', mapped)
  return mapped
}

export async function linkPartner(userId: string, partnerEmail: string): Promise<boolean> {
  // Call the database function to find partner and create links
  const { data, error } = await supabase.rpc('link_partner_by_email', {
    p_user_id: userId,
    p_partner_email: partnerEmail,
  })

  if (error) {
    console.error('Error linking partner:', error)
    return false
  }

  return data === true
}

export async function unlinkPartner(userId: string, partnerId?: string): Promise<boolean> {
  // If partnerId is provided, unlink that specific partner
  // Otherwise, unlink all partners (for backward compatibility)
  if (partnerId) {
    // Delete both directions of the specific partner link
    const { error: error1 } = await supabase
      .from('partner_links')
      .delete()
      .eq('user_id', userId)
      .eq('partner_id', partnerId)

    const { error: error2 } = await supabase
      .from('partner_links')
      .delete()
      .eq('user_id', partnerId)
      .eq('partner_id', userId)

    if (error1 || error2) {
      console.error('Error unlinking partner:', error1 || error2)
      return false
    }
  } else {
    // Delete all partner links for this user (backward compatibility)
    const { error: error1 } = await supabase
      .from('partner_links')
      .delete()
      .eq('user_id', userId)

    const { error: error2 } = await supabase
      .from('partner_links')
      .delete()
      .eq('partner_id', userId)

    if (error1 || error2) {
      console.error('Error unlinking partners:', error1 || error2)
      return false
    }
  }

  return true
}

// Events API functions
export async function getEvents(startDate?: Date, endDate?: Date): Promise<Event[]> {
  let query = supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true })

  // Filter by date range if provided
  if (startDate) {
    query = query.gte('event_date', startDate.toISOString().split('T')[0])
  }
  if (endDate) {
    query = query.lte('event_date', endDate.toISOString().split('T')[0])
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching events:', error)
    return []
  }

  return data || []
}

export async function createEvent(
  title: string,
  description: string | null,
  eventDate: string,
  eventTime: string | null,
  createdBy: string
): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      title,
      description,
      event_date: eventDate,
      event_time: eventTime,
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating event:', error)
    return null
  }

  return data
}

export async function updateEvent(
  eventId: string,
  updates: {
    title?: string
    description?: string | null
    event_date?: string
    event_time?: string | null
  }
): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select()
    .single()

  if (error) {
    console.error('Error updating event:', error)
    return null
  }

  return data
}

export async function deleteEvent(eventId: string): Promise<boolean> {
  const { error } = await supabase.from('events').delete().eq('id', eventId)

  if (error) {
    console.error('Error deleting event:', error)
    return false
  }

  return true
}

