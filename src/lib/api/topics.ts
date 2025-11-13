import { supabase } from '../supabaseClient'
import type { Topic, TopicMember } from '../../types'

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

