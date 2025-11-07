import { supabase } from './supabaseClient'
import type { Topic, Note, TopicMember, Event, Recipe, RecipeIngredient, UserIngredient } from '../types'

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

export async function getAllNotes(userId: string, filterPartnerId?: string): Promise<Array<Note & { creator_username?: string | null; partners?: string[] }>> {
  // RLS policies will automatically filter to notes from topics user has access to
  // (owned, member of, or partner's topics)
  // First get all notes with their topics
  const { data: notesData, error: notesError } = await supabase
    .from('notes')
    .select(`
      *,
      topic:topics!inner(id, name, owner_id)
    `)
    .order('updated_at', { ascending: false })

  if (notesError) {
    console.error('Error fetching notes:', notesError)
    return []
  }

  if (!notesData || notesData.length === 0) return []

  // Get unique creator IDs and topic owner IDs
  const creatorIds = [...new Set(notesData.map((note: any) => note.created_by))]
  const topicOwnerIds = [...new Set(notesData.map((note: any) => note.topic?.owner_id).filter(Boolean))]

  // Get all user IDs we need usernames for
  const allUserIds = [...new Set([...creatorIds, ...topicOwnerIds, userId])]
  if (filterPartnerId) {
    allUserIds.push(filterPartnerId)
  }

  // Fetch usernames for all users
  const { data: profilesData } = await supabase
    .from('user_profiles')
    .select('id, username')
    .in('id', allUserIds)

  // Create a map of user_id -> username
  const usernameMap = new Map<string, string | null>()
  if (profilesData) {
    profilesData.forEach((profile: any) => {
      usernameMap.set(profile.id, profile.username || null)
    })
  }

  // Get current user's partners
  const partners = await getPartners(userId)
  const partnerIds = partners.map(p => p.id)
  
  // If filtering by partner, get the partner's username to match topic names
  let filterPartnerUsername: string | null = null
  if (filterPartnerId) {
    filterPartnerUsername = usernameMap.get(filterPartnerId) || null
  }

  // Map notes to include creator_username and partners
  const mappedNotes = notesData.map((note: any) => {
    const topicOwnerId = note.topic?.owner_id
    const topicName = note.topic?.name || ''
    const creatorId = note.created_by
    
    // Determine the two people involved in this note
    const currentUserUsername = usernameMap.get(userId) || 'You'
    let otherPersonUsername: string | null = null
    let otherPersonId: string | null = null
    
    // Strategy: Use topic name to identify partner if it matches "Notes with [Partner Name]"
    if (topicName.startsWith('Notes with ')) {
      const partnerNameFromTopic = topicName.replace('Notes with ', '')
      const partnerFromTopic = partners.find(p => p.username === partnerNameFromTopic)
      if (partnerFromTopic) {
        otherPersonUsername = partnerFromTopic.username || null
        otherPersonId = partnerFromTopic.id
      }
    }
    
    // If topic name didn't help, use creator/topic owner logic
    if (!otherPersonUsername) {
      // If creator is a partner, that's definitely the other person
      if (creatorId !== userId && partnerIds.includes(creatorId)) {
        otherPersonUsername = usernameMap.get(creatorId) || null
        otherPersonId = creatorId
      }
      // If creator is current user, find which partner is involved
      else if (creatorId === userId) {
        // If topic owner is a partner, that's the other person
        if (topicOwnerId && topicOwnerId !== userId && partnerIds.includes(topicOwnerId)) {
          otherPersonUsername = usernameMap.get(topicOwnerId) || null
          otherPersonId = topicOwnerId
        }
        // If current user owns topic, we need to find which partner created notes in this topic
        else if (topicOwnerId === userId) {
          // Find all creators of notes in this same topic
          const topicNotes = notesData.filter((n: any) => n.topic_id === note.topic_id)
          const otherCreators = topicNotes
            .map((n: any) => n.created_by)
            .filter((id: string) => id !== userId && partnerIds.includes(id))
          
          if (otherCreators.length > 0) {
            // Use the first partner who created a note in this topic
            const otherCreatorId = otherCreators[0]
            otherPersonUsername = usernameMap.get(otherCreatorId) || null
            otherPersonId = otherCreatorId
          } else if (partners.length > 0) {
            // Fallback: if no partner has created notes yet, use first partner
            otherPersonUsername = partners[0].username || null
            otherPersonId = partners[0].id
          }
        }
      }
    }
    
    // Only show exactly 2 people: current user and the other person
    const partnersList: string[] = []
    if (otherPersonUsername) {
      // Always show "You" first, then the partner
      partnersList.push('You', otherPersonUsername)
    } else {
      // Only current user (shouldn't happen in shared notes, but handle it)
      partnersList.push(currentUserUsername)
    }
    
    return {
      ...note,
      creator_username: usernameMap.get(creatorId) || null,
      partners: partnersList,
      // Store the other person's ID for filtering
      otherPersonId: otherPersonId,
    }
  })

  // If filtering by partner, only return notes involving that partner
  if (filterPartnerId) {
    // Get all topics that the partner is a member of
    const { data: partnerTopicMembers } = await supabase
      .from('topic_members')
      .select('topic_id')
      .eq('user_id', filterPartnerId)
    
    const partnerTopicIds = partnerTopicMembers?.map((tm: any) => tm.topic_id) || []
    
    return mappedNotes.filter((note: any) => {
      const topicId = note.topic_id
      const topicName = note.topic?.name || ''
      const topicOwnerId = note.topic?.owner_id
      const creatorId = note.created_by
      
      // Check if the note involves the specific partner:
      // 1. Partner created the note
      // 2. Partner owns the topic
      // 3. Partner is a member of the topic
      // 4. Partner is identified as the "other person" in the note
      // 5. Topic name matches "Notes with [Partner Name]" (most reliable for partner-specific topics)
      const topicNameMatches = filterPartnerUsername && topicName === `Notes with ${filterPartnerUsername}`
      
      return creatorId === filterPartnerId || 
             topicOwnerId === filterPartnerId ||
             partnerTopicIds.includes(topicId) ||
             note.otherPersonId === filterPartnerId ||
             topicNameMatches === true
    })
  }

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
  partnerId?: string
): Promise<Note | null> {
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

// ============================================
// RECIPES API
// ============================================

export async function getAllRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('title', { ascending: true })

  if (error) {
    console.error('Error fetching recipes:', error)
    return []
  }

  if (!data || data.length === 0) return []

  // Fetch ingredients for all recipes
  const recipeIds = data.map((r: any) => r.id)
  const { data: ingredientsData } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .in('recipe_id', recipeIds)

  // Group ingredients by recipe_id
  const ingredientsByRecipe = new Map<string, RecipeIngredient[]>()
  if (ingredientsData) {
    ingredientsData.forEach((ing: any) => {
      if (!ingredientsByRecipe.has(ing.recipe_id)) {
        ingredientsByRecipe.set(ing.recipe_id, [])
      }
      ingredientsByRecipe.get(ing.recipe_id)!.push(ing)
    })
  }

  // Attach ingredients to recipes
  return data.map((recipe: any) => ({
    ...recipe,
    ingredients: ingredientsByRecipe.get(recipe.id) || [],
  }))
}

export async function getRecipesByIngredients(selectedIngredientNames: string[]): Promise<Recipe[]> {
  if (selectedIngredientNames.length === 0) {
    return getAllRecipes()
  }

  // Get all recipes that use at least one of the selected ingredients
  const { data: matchingIngredients, error: ingredientsError } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id')
    .in('ingredient_name', selectedIngredientNames)

  if (ingredientsError) {
    console.error('Error fetching recipes by ingredients:', ingredientsError)
    return []
  }

  if (!matchingIngredients || matchingIngredients.length === 0) {
    return []
  }

  const recipeIds = [...new Set(matchingIngredients.map((ing: any) => ing.recipe_id))]

  // Get recipes
  const { data: recipesData, error: recipesError } = await supabase
    .from('recipes')
    .select('*')
    .in('id', recipeIds)
    .order('title', { ascending: true })

  if (recipesError) {
    console.error('Error fetching recipes:', recipesError)
    return []
  }

  if (!recipesData || recipesData.length === 0) return []

  // Fetch ingredients for all recipes
  const { data: ingredientsData } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .in('recipe_id', recipeIds)

  // Group ingredients by recipe_id
  const ingredientsByRecipe = new Map<string, RecipeIngredient[]>()
  if (ingredientsData) {
    ingredientsData.forEach((ing: any) => {
      if (!ingredientsByRecipe.has(ing.recipe_id)) {
        ingredientsByRecipe.set(ing.recipe_id, [])
      }
      ingredientsByRecipe.get(ing.recipe_id)!.push(ing)
    })
  }

  // Attach ingredients to recipes and filter to only show recipes where user has all ingredients
  return recipesData
    .map((recipe: any) => ({
      ...recipe,
      ingredients: ingredientsByRecipe.get(recipe.id) || [],
    }))
    .filter((recipe: Recipe) => {
      // Check if user has all required ingredients for this recipe
      const requiredIngredients = recipe.ingredients?.map(ing => ing.ingredient_name.toLowerCase().trim()) || []
      const userIngredientsLower = selectedIngredientNames.map(name => name.toLowerCase().trim())
      
      // Recipe matches if user has ALL required ingredients
      return requiredIngredients.length > 0 && requiredIngredients.every((ing: string) => 
        userIngredientsLower.includes(ing)
      )
    })
}

export async function getAllIngredients(): Promise<string[]> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('ingredient_name')
    .order('ingredient_name', { ascending: true })

  if (error) {
    console.error('Error fetching ingredients:', error)
    return []
  }

  if (!data || data.length === 0) return []

  // Get unique ingredient names
  const ingredientNames = data.map((ing: any) => String(ing.ingredient_name))
  const uniqueIngredients: string[] = Array.from(new Set(ingredientNames))
  return uniqueIngredients.sort()
}

export async function getUserIngredients(userId: string): Promise<UserIngredient[]> {
  const { data, error } = await supabase
    .from('user_ingredients')
    .select('*')
    .eq('user_id', userId)
    .order('ingredient_name', { ascending: true })

  if (error) {
    console.error('Error fetching user ingredients:', error)
    return []
  }

  return data || []
}

export async function addUserIngredient(userId: string, ingredientName: string): Promise<UserIngredient | null> {
  const { data, error } = await supabase
    .from('user_ingredients')
    .insert({
      user_id: userId,
      ingredient_name: ingredientName,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding user ingredient:', error)
    return null
  }

  return data
}

export async function removeUserIngredient(userId: string, ingredientName: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_ingredients')
    .delete()
    .eq('user_id', userId)
    .eq('ingredient_name', ingredientName)

  if (error) {
    console.error('Error removing user ingredient:', error)
    return false
  }

  return true
}

