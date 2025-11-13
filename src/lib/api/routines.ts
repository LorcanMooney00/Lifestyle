import { supabase } from '../supabaseClient'
import type { Routine, RoutineItem, RoutineCompletion } from '../../types'

export async function getRoutines(userId: string): Promise<Routine[]> {
  const { data: routinesData, error: routinesError } = await supabase
    .from('routines')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (routinesError) {
    console.error('Error fetching routines:', routinesError)
    return []
  }

  const routines = (routinesData as Routine[]) || []

  // Fetch items for each routine and parse days_of_week
  const routinesWithItems = await Promise.all(
    routines.map(async (routine) => {
      const { data: itemsData, error: itemsError } = await supabase
        .from('routine_items')
        .select('*')
        .eq('routine_id', routine.id)
        .order('order_index', { ascending: true })

      if (itemsError) {
        console.error('Error fetching routine items:', itemsError)
        return {
          ...routine,
          days_of_week: Array.isArray(routine.days_of_week)
            ? routine.days_of_week
            : typeof routine.days_of_week === 'string'
            ? JSON.parse(routine.days_of_week)
            : [],
          items: [],
        }
      }

      return {
        ...routine,
        days_of_week: Array.isArray(routine.days_of_week)
          ? routine.days_of_week
          : typeof routine.days_of_week === 'string'
          ? JSON.parse(routine.days_of_week)
          : [],
        items: (itemsData as RoutineItem[]) || [],
      }
    })
  )

  return routinesWithItems
}

export async function createRoutine(
  userId: string,
  name: string,
  description: string | null,
  items: Array<{ name: string; category: 'fitness' | 'work' | 'food' | 'routine' }>,
  daysOfWeek: number[] = []
): Promise<{ routine: Routine | null; error: string | null }> {
  // Create routine
  const { data: routineData, error: routineError } = await supabase
    .from('routines')
    .insert({
      user_id: userId,
      name: name.trim(),
      description: description?.trim() || null,
      days_of_week: daysOfWeek.length > 0 ? daysOfWeek : [],
    })
    .select()
    .single()

  if (routineError || !routineData) {
    console.error('Error creating routine:', routineError)
    return { routine: null, error: routineError?.message || 'Failed to create routine' }
  }

  const routine = routineData as Routine

  // Create routine items
  if (items.length > 0) {
    const itemsToInsert = items
      .map((item, index) => ({
        routine_id: routine.id,
        name: item.name.trim(),
        category: item.category || 'routine',
        order_index: index,
      }))
      .filter((item) => item.name.length > 0)

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase.from('routine_items').insert(itemsToInsert)

      if (itemsError) {
        console.error('Error creating routine items:', itemsError)
        // Delete the routine if items fail
        await supabase.from('routines').delete().eq('id', routine.id)
        return { routine: null, error: 'Failed to create routine items' }
      }
    }
  }

  // Fetch the complete routine with items
  const { data: itemsData } = await supabase
    .from('routine_items')
    .select('*')
    .eq('routine_id', routine.id)
    .order('order_index', { ascending: true })

  // Parse days_of_week from JSONB
  const routineWithDays = {
    ...routine,
    days_of_week: Array.isArray(routine.days_of_week)
      ? routine.days_of_week
      : typeof routine.days_of_week === 'string'
      ? JSON.parse(routine.days_of_week)
      : [],
    items: (itemsData as RoutineItem[]) || [],
  }

  return {
    routine: routineWithDays,
    error: null,
  }
}

export async function updateRoutine(
  routineId: string,
  name: string,
  description: string | null,
  items: Array<{ name: string; category: 'fitness' | 'work' | 'food' | 'routine' }>,
  daysOfWeek: number[] = []
): Promise<{ routine: Routine | null; error: string | null }> {
  // Update routine
  const { error: routineError } = await supabase
    .from('routines')
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      days_of_week: daysOfWeek.length > 0 ? daysOfWeek : [],
    })
    .eq('id', routineId)

  if (routineError) {
    console.error('Error updating routine:', routineError)
    return { routine: null, error: routineError.message }
  }

  // Delete existing items
  const { error: deleteError } = await supabase.from('routine_items').delete().eq('routine_id', routineId)

  if (deleteError) {
    console.error('Error deleting routine items:', deleteError)
    return { routine: null, error: 'Failed to update routine items' }
  }

  // Create new items
  if (items.length > 0) {
    const itemsToInsert = items
      .map((item, index) => ({
        routine_id: routineId,
        name: item.name.trim(),
        category: item.category || 'routine',
        order_index: index,
      }))
      .filter((item) => item.name.length > 0)

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase.from('routine_items').insert(itemsToInsert)

      if (itemsError) {
        console.error('Error creating routine items:', itemsError)
        return { routine: null, error: 'Failed to create routine items' }
      }
    }
  }

  // Fetch the updated routine with items
  const { data: routineData } = await supabase.from('routines').select('*').eq('id', routineId).single()
  const { data: itemsData } = await supabase
    .from('routine_items')
    .select('*')
    .eq('routine_id', routineId)
    .order('order_index', { ascending: true })

  const routine = routineData as Routine
  // Parse days_of_week from JSONB
  const routineWithDays = {
    ...routine,
    days_of_week: Array.isArray(routine.days_of_week)
      ? routine.days_of_week
      : typeof routine.days_of_week === 'string'
      ? JSON.parse(routine.days_of_week)
      : [],
    items: (itemsData as RoutineItem[]) || [],
  }

  return {
    routine: routineWithDays,
    error: null,
  }
}

export async function deleteRoutine(routineId: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase.from('routines').delete().eq('id', routineId)

  if (error) {
    console.error('Error deleting routine:', error)
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

export async function getRoutineCompletion(
  routineId: string,
  userId: string,
  date: string
): Promise<RoutineCompletion | null> {
  const { data, error } = await supabase
    .from('routine_completions')
    .select('*')
    .eq('routine_id', routineId)
    .eq('user_id', userId)
    .eq('completion_date', date)
    .maybeSingle()

  if (error) {
    // PGRST116 means no record found, 42P01 means table doesn't exist
    if (error.code === 'PGRST116' || error.code === '42P01') {
      // No completion found or table doesn't exist yet
      return null
    }
    console.error('Error fetching routine completion:', error)
    return null
  }

  if (!data) {
    return null
  }

  const completion = data as RoutineCompletion
  // Parse completed_items JSONB to array
  return {
    ...completion,
    completed_items: Array.isArray(completion.completed_items)
      ? completion.completed_items
      : typeof completion.completed_items === 'string'
      ? JSON.parse(completion.completed_items)
      : [],
  }
}

export async function toggleRoutineItem(
  routineId: string,
  userId: string,
  itemId: string,
  date: string,
  completed: boolean
): Promise<{ success: boolean; error: string | null }> {
  // Get or create completion record
  const existingCompletion = await getRoutineCompletion(routineId, userId, date)

  let completedItems: string[] = existingCompletion?.completed_items || []

  if (completed) {
    // Add item if not already in list
    if (!completedItems.includes(itemId)) {
      completedItems.push(itemId)
    }
  } else {
    // Remove item from list
    completedItems = completedItems.filter((id) => id !== itemId)
  }

  if (existingCompletion) {
    // Update existing completion
    const { error } = await supabase
      .from('routine_completions')
      .update({
        completed_items: completedItems,
      })
      .eq('id', existingCompletion.id)

    if (error) {
      // If table doesn't exist, fail gracefully
      if (error.code === '42P01') {
        console.warn('Routine completions table does not exist. Please run the SQL migration.')
        return { success: false, error: 'Database table not found. Please run the SQL migration.' }
      }
      console.error('Error updating routine completion:', error)
      return { success: false, error: error.message }
    }
  } else {
    // Create new completion
    const { error } = await supabase.from('routine_completions').insert({
      routine_id: routineId,
      user_id: userId,
      completion_date: date,
      completed_items: completedItems,
    })

    if (error) {
      // If table doesn't exist, fail gracefully
      if (error.code === '42P01') {
        console.warn('Routine completions table does not exist. Please run the SQL migration.')
        return { success: false, error: 'Database table not found. Please run the SQL migration.' }
      }
      console.error('Error creating routine completion:', error)
      return { success: false, error: error.message }
    }
  }

  return { success: true, error: null }
}

