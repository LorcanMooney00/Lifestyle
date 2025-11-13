import { supabase } from '../supabaseClient'
import type { Note, Topic } from '../../types'
import { getPartners } from './partners'
import { getTopics, createTopic, addTopicMember } from './topics'
import { getGroup } from './groups'
import { getGroupIdsForUser } from './utils'

export async function getAllNotes(
  userId: string,
  filterPartnerId?: string,
  filterGroupId?: string
): Promise<
  Array<
    Note & {
      creator_username?: string | null
      partners?: string[]
      shared_partner_id?: string | null
      group_name?: string | null
    }
  >
> {
  const { data: notesData, error: notesError } = await supabase
    .from('notes')
    .select(`
      *,
      topic:topics!inner(id, name, owner_id),
      group:groups(id, name)
    `)
    .order('updated_at', { ascending: false })

  if (notesError) {
    console.error('Error fetching notes:', notesError)
    return []
  }

  if (!notesData || notesData.length === 0) return []

  const creatorIds = [...new Set(notesData.map((note: any) => note.created_by))]
  const topicOwnerIds = [...new Set(notesData.map((note: any) => note.topic?.owner_id).filter(Boolean))]

  const allUserIds = [...new Set([...creatorIds, ...topicOwnerIds, userId])]
  if (filterPartnerId) {
    allUserIds.push(filterPartnerId)
  }

  const { data: profilesData } = await supabase
    .from('user_profiles')
    .select('id, username')
    .in('id', allUserIds)

  const usernameMap = new Map<string, string | null>()
  if (profilesData) {
    profilesData.forEach((profile: any) => {
      usernameMap.set(profile.id, profile.username || null)
    })
  }

  const partners = await getPartners(userId)
  const partnerIds = partners.map((p) => p.id)

  const groupIds = await getGroupIdsForUser(userId)
  const groupIdSet = new Set(groupIds)
  const groupNameMap = new Map<string, string>()
  notesData.forEach((note: any) => {
    if (note.group_id && note.group?.name) {
      groupNameMap.set(note.group_id, note.group.name)
    }
  })

  let filterPartnerUsername: string | null = null
  if (filterPartnerId) {
    filterPartnerUsername = usernameMap.get(filterPartnerId) || null
  }

  let mappedNotes = notesData.map((note: any) => {
    const topicOwnerId = note.topic?.owner_id
    const topicName = note.topic?.name || ''
    const creatorId = note.created_by

    const currentUserUsername = usernameMap.get(userId) || 'You'
    let otherPersonUsername: string | null = null
    let otherPersonId: string | null = null

    if (note.group_id) {
      const groupName = groupNameMap.get(note.group_id) || note.group?.name || 'Group'
      return {
        ...(note as Note),
        creator_username: usernameMap.get(creatorId) || null,
        partners: [`Group · ${groupName}`],
        shared_partner_id: null,
        group_name: groupName,
      }
    }

    if (topicName.startsWith('Notes with ')) {
      const partnerNameFromTopic = topicName.replace('Notes with ', '')
      const partnerFromTopic = partners.find((p) => p.username === partnerNameFromTopic)
      if (partnerFromTopic) {
        otherPersonUsername = partnerFromTopic.username || null
        otherPersonId = partnerFromTopic.id
      }
    }

    if (!otherPersonUsername) {
      if (creatorId !== userId && partnerIds.includes(creatorId)) {
        otherPersonUsername = usernameMap.get(creatorId) || null
        otherPersonId = creatorId
      } else if (creatorId === userId) {
        if (topicOwnerId && topicOwnerId !== userId && partnerIds.includes(topicOwnerId)) {
          otherPersonUsername = usernameMap.get(topicOwnerId) || null
          otherPersonId = topicOwnerId
        } else if (topicOwnerId === userId) {
          const topicNotes = notesData.filter((n: any) => n.topic_id === note.topic_id)
          const otherCreators = topicNotes
            .map((n: any) => n.created_by)
            .filter((id: string) => id !== userId && partnerIds.includes(id))

          if (otherCreators.length > 0) {
            const otherCreatorId = otherCreators[0]
            otherPersonUsername = usernameMap.get(otherCreatorId) || null
            otherPersonId = otherCreatorId
          } else if (partners.length > 0) {
            otherPersonUsername = partners[0].username || null
            otherPersonId = partners[0].id
          }
        }
      }
    }

    const partnersList: string[] = []
    if (otherPersonUsername) {
      partnersList.push('You', otherPersonUsername)
    } else {
      partnersList.push(currentUserUsername)
    }

    return {
      ...(note as Note),
      creator_username: usernameMap.get(creatorId) || null,
      partners: partnersList,
      shared_partner_id: otherPersonId,
      group_name: null,
    }
  })

  if (filterGroupId) {
    mappedNotes = mappedNotes.filter((note) => note.group_id === filterGroupId)
  }

  if (filterPartnerId) {
    const { data: partnerTopicMembers } = await supabase
      .from('topic_members')
      .select('topic_id')
      .eq('user_id', filterPartnerId)

    const partnerTopicIds = partnerTopicMembers?.map((tm: any) => tm.topic_id) || []

    mappedNotes = mappedNotes.filter((note: any) => {
      if (note.group_id) return false

      const topicId = note.topic_id
      const topicName = note.topic?.name || ''
      const topicOwnerId = note.topic?.owner_id
      const creatorId = note.created_by

      const topicNameMatches = filterPartnerUsername && topicName === `Notes with ${filterPartnerUsername}`

      return (
        creatorId === filterPartnerId ||
        topicOwnerId === filterPartnerId ||
        partnerTopicIds.includes(topicId) ||
        note.shared_partner_id === filterPartnerId ||
        topicNameMatches === true
      )
    })
  }

  mappedNotes = mappedNotes.filter((note) => {
    if (note.group_id) {
      return groupIdSet.has(note.group_id)
    }
    return note.created_by === userId || note.shared_partner_id === userId || partnerIds.includes(note.created_by)
  })

  return mappedNotes
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
  createdBy: string,
  partnerId?: string | null,
  groupId?: string | null
): Promise<Note | null> {
  if (partnerId && groupId) {
    console.warn('Cannot create note with both partnerId and groupId. Using partnerId.')
    groupId = null
  }

  let defaultTopic: Topic | null = null

  // If creating a note for a specific partner, find or create a topic for that partner
  if (partnerId) {
    // Get partner info to create a topic name
    const partners = await getPartners(createdBy)
    const partner = partners.find(p => p.id === partnerId)
    const partnerName = partner?.username || 'Partner'
    
    // Look for an existing topic for this partner
    const topics = await getTopics()
    defaultTopic = topics.find((t) => t.name === `Notes with ${partnerName}`) || null
    
    // If no topic exists for this partner, create one
    if (!defaultTopic) {
      const result = await createTopic(`Notes with ${partnerName}`, createdBy)
      defaultTopic = result.topic
      
      // Add the partner as a member of this topic
      if (defaultTopic && partnerId) {
        await addTopicMember(defaultTopic.id, partnerId, 'editor')
      }
    }
  } else if (groupId) {
    const group = await getGroup(groupId)
    const groupName = group?.name || 'Group'
    const topics = await getTopics()
    const topicName = `Group Notes - ${groupName}`
    defaultTopic = topics.find((t) => t.name === topicName) || null

    if (!defaultTopic) {
      const result = await createTopic(topicName, createdBy)
      defaultTopic = result.topic
    }
  } else {
    // Get or create a default topic for the user (general notes)
    const topics = await getTopics()
    defaultTopic = topics.find((t) => t.name === 'General') || topics[0] || null

    // If no topics exist, create a default "General" topic
    if (!defaultTopic) {
      const result = await createTopic('General', createdBy)
      defaultTopic = result.topic
    }
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
      group_id: groupId ?? null,
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

