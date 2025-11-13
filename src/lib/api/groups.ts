import { supabase } from '../supabaseClient'
import type { Group, GroupMember } from '../../types'

export async function getGroups(userId: string): Promise<Group[]> {
  const { data: membership, error: membershipError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)

  if (membershipError) {
    console.error('Error fetching group memberships:', membershipError)
    return []
  }

  const groupIds = Array.from(new Set((membership || []).map((row: any) => row.group_id)))

  if (groupIds.length === 0) {
    return []
  }

  const { data: groupsData, error } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching groups:', error)
    return []
  }

  const groupsWithCounts = await Promise.all(
    (groupsData || []).map(async (group) => {
      const { count, error: countError } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id)

      if (countError) {
        console.error('Error counting members:', countError)
      }

      return {
        ...group,
        member_count: count || 0
      }
    })
  )

  return groupsWithCounts
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()

  if (error) {
    console.error('Error fetching group:', error)
    return null
  }

  return data
}

export async function createGroup(name: string, description: string | null, createdBy: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .insert({
      name,
      description,
      created_by: createdBy
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating group:', error)
    return null
  }

  return data
}

export async function updateGroup(groupId: string, name: string, description: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('groups')
    .update({
      name,
      description,
      updated_at: new Date().toISOString()
    })
    .eq('id', groupId)

  if (error) {
    console.error('Error updating group:', error)
    return false
  }

  return true
}

export async function deleteGroup(groupId: string): Promise<boolean> {
  const { error} = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId)

  if (error) {
    console.error('Error deleting group:', error)
    return false
  }

  return true
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })

  if (error) {
    console.error('Error fetching group members:', error)
    return []
  }

  return (data || []) as GroupMember[]
}

export async function addGroupMember(groupId: string, userEmail: string, role: 'admin' | 'member' = 'member'): Promise<boolean> {
  // First, find the user by email
  const { data: userData, error: userError } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('email', userEmail)
    .single()

  if (userError || !userData) {
    console.error('Error finding user:', userError)
    return false
  }

  // Add the user to the group
  const { error } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: userData.user_id,
      role
    })

  if (error) {
    console.error('Error adding group member:', error)
    return false
  }

  return true
}

export async function removeGroupMember(groupId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error removing group member:', error)
    return false
  }

  return true
}

export async function updateGroupMemberRole(groupId: string, userId: string, role: 'admin' | 'member'): Promise<boolean> {
  const { error } = await supabase
    .from('group_members')
    .update({ role })
    .eq('group_id', groupId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating member role:', error)
    return false
  }

  return true
}

