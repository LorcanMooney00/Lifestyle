import { supabase } from './supabaseClient'
import type { Topic, Note, TopicMember, Event } from '../types'

export async function getTopics(userId: string): Promise<Topic[]> {
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

export async function getAllNotes(userId: string): Promise<Note[]> {
  // RLS policies will automatically filter to notes from topics user has access to
  // (owned, member of, or partner's topics)
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching notes:', error)
    return []
  }

  return data || []
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
  const topics = await getTopics(createdBy)
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

export async function getPartnerId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('partner_links')
    .select('partner_id')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No partner linked
      return null
    }
    console.error('Error fetching partner:', error)
    return null
  }

  return data?.partner_id || null
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

