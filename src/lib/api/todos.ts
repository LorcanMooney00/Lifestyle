import { supabase } from '../supabaseClient'
import type { Todo } from '../../types'
import { getGroupIdsForUser } from './utils'

export async function getTodos(
  userId: string,
  filterPartnerId?: string,
  filterGroupId?: string
): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching todos:', error)
    return []
  }

  const groupIds = await getGroupIdsForUser(userId)
  const groupSet = new Set(groupIds)

  let todos = (data as Todo[]) || []

  todos = todos.filter((todo) => {
    if (todo.group_id) {
      return groupSet.has(todo.group_id)
    }
    return todo.user_id === userId || todo.partner_id === userId
  })

  if (filterGroupId) {
    todos = todos.filter((todo) => todo.group_id === filterGroupId)
  }

  if (filterPartnerId) {
    todos = todos.filter((todo) => {
      if (todo.group_id) return false
      const isCreatorWithPartner = todo.user_id === userId && todo.partner_id === filterPartnerId
      const isPartnerCreator = todo.user_id === filterPartnerId && todo.partner_id === userId
      return isCreatorWithPartner || isPartnerCreator
    })
  }

  return todos
}

export async function createTodo(
  userId: string,
  content: string,
  partnerId?: string | null,
  groupId?: string | null
): Promise<{ todo: Todo | null; error: string | null }> {
  if (partnerId && groupId) {
    console.warn('Cannot create todo with both partner and group. Using partner.')
    groupId = null
  }

  const { data, error } = await supabase
    .from('todos')
    .insert({
      user_id: userId,
      content,
      partner_id: partnerId ?? null,
      group_id: groupId ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating todo:', error)
    return { todo: null, error: error.message }
  }

  return { todo: data as Todo, error: null }
}

export async function updateTodoContent(todoId: string, content: string): Promise<{ todo: Todo | null; error: string | null }> {
  const { data, error } = await supabase
    .from('todos')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', todoId)
    .select()
    .single()

  if (error) {
    console.error('Error updating todo content:', error)
    return { todo: null, error: error.message }
  }

  return { todo: data as Todo, error: null }
}

export async function toggleTodoCompletion(todoId: string, completed: boolean): Promise<{ todo: Todo | null; error: string | null }> {
  const { data, error } = await supabase
    .from('todos')
    .update({ completed, updated_at: new Date().toISOString() })
    .eq('id', todoId)
    .select()
    .single()

  if (error) {
    console.error('Error toggling todo:', error)
    return { todo: null, error: error.message }
  }

  return { todo: data as Todo, error: null }
}

export async function deleteTodo(todoId: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', todoId)

  if (error) {
    console.error('Error deleting todo:', error)
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

