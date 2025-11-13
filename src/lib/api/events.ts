import { supabase } from '../supabaseClient'
import type { Event } from '../../types'

export async function getEvents(
  startDate?: Date,
  endDate?: Date,
  filterPartnerId?: string,
  currentUserId?: string
): Promise<Event[]> {
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

  // Don't filter by partner_id in the query (column may not exist)
  // We'll filter in memory instead to avoid errors

  const { data, error } = await query

  if (error) {
    console.error('Error fetching events:', error)
    return []
  }

  let memberGroupIds: string[] = []
  if (currentUserId) {
    const { data: membership, error: membershipError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', currentUserId)

    if (membershipError) {
      console.error('Error fetching group membership:', membershipError)
    } else {
      memberGroupIds = (membership || []).map((row: any) => row.group_id)
    }
  }

  // If filtering by partner, filter in memory to ensure we only show events involving both users (or their shared groups)
  if (filterPartnerId && data) {
    return data.filter((event: any) => {
      const eventPartnerId = event.partner_id ?? null
      const eventGroupId = event.group_id ?? null
      const involvesCurrentUser =
        !currentUserId ||
        event.created_by === currentUserId ||
        eventPartnerId === currentUserId ||
        (eventGroupId && memberGroupIds.includes(eventGroupId))

      if (!involvesCurrentUser) {
        return false
      }

      // Partner-to-partner events
      if (eventPartnerId === filterPartnerId && event.created_by === currentUserId) {
        return true
      }
      if (eventPartnerId === currentUserId && event.created_by === filterPartnerId) {
        return true
      }

      // Group events involving the partner
      if (eventGroupId && memberGroupIds.includes(eventGroupId)) {
        return event.created_by === filterPartnerId || eventPartnerId === filterPartnerId
      }

      return false
    })
  }

  // For general view (dashboard/calendar without partner filter) ensure we only show events the user can access
  if (currentUserId && data) {
    return data.filter((event: any) => {
      const eventPartnerId = event.partner_id ?? null
      const eventGroupId = event.group_id ?? null
      return (
        event.created_by === currentUserId ||
        eventPartnerId === currentUserId ||
        (eventGroupId && memberGroupIds.includes(eventGroupId))
      )
    })
  }

  return data || []
}

export async function createEvent(
  title: string,
  description: string | null,
  eventDate: string,
  eventTime: string | null,
  createdBy: string,
  partnerId?: string,
  groupId?: string
): Promise<Event | null> {
  // Build insert object - don't include partner_id or group_id (columns may not exist)
  // We'll try to include them, but if it fails, retry without
  const baseInsertData = {
    title,
    description,
    event_date: eventDate,
    event_time: eventTime,
    created_by: createdBy,
  }
  
  // Try to include partner_id or group_id if provided
  const insertData: any = { ...baseInsertData }
  if (partnerId) {
    insertData.partner_id = partnerId
  }
  if (groupId) {
    insertData.group_id = groupId
  }

  const { data, error } = await supabase
    .from('events')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    // If error is about missing partner_id column, don't create the event
    // Events must be associated with a partner for proper privacy
    if (partnerId && (error.code === 'PGRST204' || error.message?.includes('partner_id'))) {
      console.error('Cannot create event: partner_id column does not exist. Please add the column to your database.')
      return null
    }
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

