import { supabase } from './supabaseClient'
import type {
  Topic,
  Note,
  TopicMember,
  Event,
  Recipe,
  RecipeIngredient,
  UserIngredient,
  Photo,
  Todo,
  ShoppingItem,
  Dog,
  DogMeal,
  Group,
  GroupMember,
} from '../types'

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

export async function getUserProfile(userId: string): Promise<{ username: string | null; profilePictureUrl: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('username, profile_picture_url')
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No profile found
      return { username: null, profilePictureUrl: null, error: null }
    }
    console.error('Error fetching user profile:', error)
    return { username: null, profilePictureUrl: null, error: error.message }
  }

  return { username: data?.username || null, profilePictureUrl: data?.profile_picture_url || null, error: null }
}

export async function getTilePreferences(userId: string): Promise<{ preferences: Record<string, boolean> | null; error: string | null }> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('tile_preferences')
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No profile found, return default preferences
      return {
        preferences: {
          'shared-notes': true,
          'calendar': true,
          'recipes': true,
          'photo-gallery': true,
          'shared-todos': true,
          'shopping-list': true,
        },
        error: null,
      }
    }
    console.error('Error fetching tile preferences:', error)
    return { preferences: null, error: error.message }
  }

  // If no preferences exist, return defaults
  const preferences = {
    'shared-notes': true,
    'calendar': true,
    'recipes': true,
    'photo-gallery': true,
    'shared-todos': true,
    'shopping-list': true,
    ...(data?.tile_preferences ?? {}),
  }
  return { preferences, error: null }
}

export async function updateTilePreferences(userId: string, preferences: Record<string, boolean>): Promise<{ success: boolean; error: string | null }> {
  // Use update instead of upsert to avoid issues with missing columns
  const { error } = await supabase
    .from('user_profiles')
    .update({
      tile_preferences: preferences,
    })
    .eq('id', userId)

  if (error) {
    console.error('Error updating tile preferences:', error)
    // If column doesn't exist, provide helpful error message
    if (error.message.includes('tile_preferences') || error.message.includes('column') || error.message.includes('schema cache')) {
      return { 
        success: false, 
        error: 'Tile preferences column not found. Please run the SQL migration in Supabase SQL Editor to add the column.' 
      }
    }
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

export async function updateUserProfile(userId: string, username: string, profilePictureUrl?: string | null): Promise<{ success: boolean; error: string | null }> {
  // Use upsert to either update existing profile or create new one
  const updateData: any = {
    id: userId,
    username,
  }
  
  if (profilePictureUrl !== undefined) {
    updateData.profile_picture_url = profilePictureUrl
  }

  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      updateData,
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

export async function uploadProfilePicture(file: File): Promise<{ url: string | null; error: string | null }> {
  try {
    // Get the current session to ensure we have an authenticated user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session || !session.user) {
      return { url: null, error: 'You must be logged in to upload profile pictures' }
    }

    const authenticatedUserId = session.user.id

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return { url: null, error: 'Please select an image file' }
    }

    // Validate file size (max 2MB for profile pictures)
    if (file.size > 2 * 1024 * 1024) {
      return { url: null, error: 'Profile picture size must be less than 2MB' }
    }

    // Generate a unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `profile-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${authenticatedUserId}/${fileName}`

    // Upload to Supabase Storage (using photos bucket, or create a profile-pictures bucket)
    // Use upsert: true to overwrite if file exists
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true, // Allow overwriting existing files
      })

    console.log('Upload result - error:', uploadError)
    if (uploadError) {
      console.error('Error uploading profile picture:', uploadError)
      return { url: null, error: uploadError.message }
    }
    console.log('File uploaded successfully to:', filePath)

    // Verify the file actually exists in storage immediately after upload
    console.log('Verifying file exists in storage...')
    const { data: verifyList, error: verifyError } = await supabase.storage
      .from('photos')
      .list(authenticatedUserId)
    
    console.log('Verification - file list:', verifyList)
    console.log('Verification - error:', verifyError)
    
    const uploadedFileName = filePath.split('/')[1]
    const fileExists = verifyList?.some((file: any) => file.name === uploadedFileName)
    console.log('File exists verification:', fileExists, 'for file:', uploadedFileName)
    
    if (!fileExists) {
      console.error('CRITICAL: File was not found in storage after upload!')
      console.error('This suggests a storage permissions issue or upload failure')
      return { url: null, error: 'File upload failed - file not found in storage' }
    }

    // Store the storage path (not the public URL) so we can generate signed URLs
    // The storage path is: userId/fileName
    const storagePath = filePath

    console.log('=== PROFILE PICTURE UPLOAD DEBUG ===')
    console.log('Storage path:', storagePath)
    console.log('User ID:', authenticatedUserId)

    // First, check if profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('username, profile_picture_url')
      .eq('id', authenticatedUserId)
      .single()

    console.log('Existing profile:', existingProfile)
    console.log('Fetch error:', fetchError)

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      console.error('Error checking profile:', fetchError)
      await supabase.storage.from('photos').remove([filePath])
      return { url: null, error: 'Failed to check user profile' }
    }

    // Update or create profile
    if (existingProfile) {
      console.log('Updating existing profile')
      
      // Save old profile picture path BEFORE updating database
      const oldProfilePictureUrl = existingProfile.profile_picture_url
      
      // Profile exists, update the picture URL FIRST (store storage path)
      // This ensures the new path is in the database before we try to delete the old one
      console.log('Updating profile with storage path:', storagePath)
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ profile_picture_url: storagePath })
        .eq('id', authenticatedUserId)

      if (updateError) {
        console.error('Error updating profile picture URL:', updateError)
        await supabase.storage.from('photos').remove([filePath])
        return { url: null, error: updateError.message }
      }
      console.log('Profile updated successfully')
      
      // Delete old profile picture AFTER updating the database (to save storage space)
      // This way, if deletion fails, we still have the new picture in the database
      if (oldProfilePictureUrl && oldProfilePictureUrl !== storagePath) {
        console.log('Old profile picture URL:', oldProfilePictureUrl)
        try {
          // Check if old picture is a storage path or URL
          let oldPath = oldProfilePictureUrl
          try {
            const oldUrl = new URL(oldProfilePictureUrl)
            console.log('Old URL parsed:', oldUrl.href)
            if (oldUrl.hostname.includes('supabase')) {
              // Extract path from URL
              const pathParts = oldUrl.pathname.split('/')
              const bucketIndex = pathParts.findIndex(part => part === 'photos')
              if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
                oldPath = pathParts.slice(bucketIndex + 1).join('/')
                console.log('Extracted old path from URL:', oldPath)
              } else {
                oldPath = null // Can't extract path, skip deletion
                console.log('Could not extract path from URL')
              }
            } else {
              oldPath = null // Not a Supabase URL, skip deletion
              console.log('Not a Supabase URL, skipping deletion')
            }
          } catch {
            // Not a URL, assume it's already a storage path
            oldPath = oldProfilePictureUrl
            console.log('Not a URL, using as storage path:', oldPath)
          }
          
          if (oldPath && oldPath !== storagePath) {
            // Only delete if it's different from the new one
            console.log('Deleting old profile picture:', oldPath)
            const { error: deleteError } = await supabase.storage.from('photos').remove([oldPath])
            if (deleteError) {
              console.warn('Error deleting old profile picture (non-critical):', deleteError)
            } else {
              console.log('Old profile picture deleted successfully')
            }
          } else {
            console.log('Skipping deletion - same path or no old path')
          }
        } catch (deleteError) {
          // Ignore deletion errors - not critical
          console.warn('Could not delete old profile picture (non-critical):', deleteError)
        }
      } else {
        console.log('No old profile picture to delete')
      }
    } else {
      // Profile doesn't exist, need to create it with a username
      // Get user email to use as default username
      const { data: { user } } = await supabase.auth.getUser()
      const defaultUsername = user?.email?.split('@')[0] || `user_${authenticatedUserId.slice(0, 8)}`
      
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: authenticatedUserId,
          username: defaultUsername,
          profile_picture_url: storagePath,
        })

      if (insertError) {
        console.error('Error creating profile with picture:', insertError)
        await supabase.storage.from('photos').remove([filePath])
        return { url: null, error: insertError.message }
      }
    }

    // Return the storage path (not a signed URL) so it doesn't expire
    // The caller should use getProfilePictureUrl() to convert it to a signed URL for display
    console.log('Returning storage path:', storagePath)
    console.log('=== END PROFILE PICTURE UPLOAD DEBUG ===')
    return { url: storagePath, error: null }
  } catch (error: any) {
    console.error('Error uploading profile picture:', error)
    return { url: null, error: error.message || 'Failed to upload profile picture' }
  }
}

export async function getProfilePictureUrl(profilePictureUrl: string | null | undefined): Promise<string | null> {
  if (!profilePictureUrl) {
    console.log('getProfilePictureUrl: No URL provided')
    return null
  }
  
  // Check if it's already a full URL (legacy format) or a storage path
  try {
    // Try to parse as URL first
    const url = new URL(profilePictureUrl)
    
    // If it's already a full URL, try to extract the path and create signed URL
    // Or if it's a signed URL, return it as-is
    if (url.hostname.includes('supabase')) {
      // Extract storage path from URL
      const pathParts = url.pathname.split('/')
      const bucketIndex = pathParts.findIndex(part => part === 'photos')
      
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        const filePath = pathParts.slice(bucketIndex + 1).join('/')
        const { data: signedUrlData, error: signedError } = await supabase.storage
          .from('photos')
          .createSignedUrl(filePath, 3600)
        
        if (!signedError && signedUrlData?.signedUrl) {
          return signedUrlData.signedUrl
        }
      }
      
      // If extraction failed, return original URL (might be a public URL)
      return profilePictureUrl
    }
    
    // Not a Supabase URL, return as-is
    return profilePictureUrl
  } catch (e) {
    // Not a URL, assume it's a storage path (e.g., "userId/filename.jpg")
    
    // Try to generate signed URL directly - the storage policy should allow this
    // Note: We skip the list check because listing folders requires different permissions
    // and the signed URL creation will fail if the file doesn't exist or we don't have permission
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from('photos')
      .createSignedUrl(profilePictureUrl, 3600) // Valid for 1 hour
    
    if (!signedError && signedUrlData?.signedUrl) {
      return signedUrlData.signedUrl
    } else if (signedError) {
      // If file doesn't exist, handle gracefully
      if (signedError.message?.includes('not found') || signedError.message?.includes('Object not found')) {
        console.warn('Profile picture file not found in storage:', profilePictureUrl)
      }
      return null
    }
  }
  
  return null
}

export async function getPartners(userId: string): Promise<Array<{ id: string; email: string; username: string; profilePictureUrl?: string | null }>> {
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
      profilePictureUrl: null,
    }))
  }

  console.log('Partners data received:', data)
  
  if (!data || data.length === 0) {
    return []
  }

  // Get signed URLs for profile pictures
  const mapped = await Promise.all(
    data.map(async (row: any) => {
      console.log('Mapping partner row:', row)
      let profilePictureUrl = null
      
      // Check if profile_picture_url exists in the row data
      const profilePicturePath = row.profile_picture_url || null
      
      if (profilePicturePath) {
        profilePictureUrl = await getProfilePictureUrl(profilePicturePath)
        
        // If file doesn't exist, clean up the database entry
        if (!profilePictureUrl && profilePicturePath) {
          console.log('Profile picture file not found, cleaning up database entry for partner:', row.partner_id)
          // Note: We can't directly update partner profiles here without proper permissions
          // The profile picture will just show as null (default icon)
        }
      } else {
        console.log('No profile picture path found for partner:', row.partner_id)
      }
      
      return {
        id: row.partner_id,
        email: row.email || 'Unknown',
        username: row.username || row.email || 'Unknown',
        profilePictureUrl,
      }
    })
  )
  
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

// ============================================
// TODOS API
// ============================================

export async function getTodos(userId: string): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching todos:', error)
    return []
  }

  return (data as Todo[]) || []
}

export async function createTodo(
  userId: string,
  content: string,
  partnerId: string | null
): Promise<{ todo: Todo | null; error: string | null }> {
  const { data, error } = await supabase
    .from('todos')
    .insert({
      user_id: userId,
      content,
      partner_id: partnerId,
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

// ============================================
// SHOPPING LIST API
// ============================================

export async function getShoppingItems(userId: string, filterPartnerId?: string | null): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .select('*')
    .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching shopping list items:', error)
    return []
  }

  let items = (data as ShoppingItem[]) || []

  if (filterPartnerId) {
    items = items.filter(
      (item) =>
        item.partner_id === filterPartnerId ||
        item.user_id === filterPartnerId
    )
  }

  return items
}

export async function createShoppingItem(
  userId: string,
  itemName: string,
  quantity?: string | null,
  partnerId?: string | null,
  notes?: string | null
): Promise<{ item: ShoppingItem | null; error: string | null }> {
  const payload = {
    user_id: userId,
    item_name: itemName,
    quantity: quantity ?? null,
    partner_id: partnerId ?? null,
    notes: notes ?? null,
  }

  const { data, error } = await supabase
    .from('shopping_list_items')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('Error creating shopping list item:', error)
    return { item: null, error: error.message }
  }

  return { item: data as ShoppingItem, error: null }
}

export async function updateShoppingItem(
  itemId: string,
  updates: {
    item_name?: string
    quantity?: string | null
    notes?: string | null
    partner_id?: string | null
  }
): Promise<{ item: ShoppingItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select()
    .single()

  if (error) {
    console.error('Error updating shopping list item:', error)
    return { item: null, error: error.message }
  }

  return { item: data as ShoppingItem, error: null }
}

export async function toggleShoppingItemPurchased(
  itemId: string,
  purchased: boolean
): Promise<{ item: ShoppingItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .update({
      purchased,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select()
    .single()

  if (error) {
    console.error('Error toggling shopping list item:', error)
    return { item: null, error: error.message }
  }

  return { item: data as ShoppingItem, error: null }
}

export async function deleteShoppingItem(itemId: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('shopping_list_items')
    .delete()
    .eq('id', itemId)

  if (error) {
    console.error('Error deleting shopping list item:', error)
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

// ============================================
// DOGS API
// ============================================

export async function getDogs(userId: string): Promise<Dog[]> {
  const { data, error } = await supabase
    .from('dogs')
    .select('*')
    .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching dogs:', error)
    return []
  }

  const rawDogs = (data as Dog[]) || []

  return Promise.all(rawDogs.map(attachDogPhotoSignedUrl))
}

export async function createDog(
  userId: string,
  input: {
    name: string
    meals_per_day?: number | null
    weight_per_meal?: number | null
    partner_id?: string | null
    photo_url?: string | null
  }
): Promise<{ dog: Dog | null; error: string | null }> {
  const payload = {
    user_id: userId,
    name: input.name,
    meals_per_day: input.meals_per_day ?? null,
    weight_per_meal: input.weight_per_meal ?? null,
    partner_id: input.partner_id ?? null,
    photo_url: input.photo_url ?? null,
  }

  const { data, error } = await supabase
    .from('dogs')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('Error creating dog:', error)
    return { dog: null, error: error.message }
  }

  const createdDog = await attachDogPhotoSignedUrl(data as Dog)
  return { dog: createdDog, error: null }
}

export async function updateDog(
  dogId: string,
  updates: Partial<Pick<Dog, 'name' | 'meals_per_day' | 'weight_per_meal' | 'photo_url' | 'partner_id'>>
): Promise<{ dog: Dog | null; error: string | null }> {
  const { data, error } = await supabase
    .from('dogs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dogId)
    .select()
    .single()

  if (error) {
    console.error('Error updating dog:', error)
    return { dog: null, error: error.message }
  }

  const updatedDog = await attachDogPhotoSignedUrl(data as Dog)
  return { dog: updatedDog, error: null }
}

export async function deleteDog(dogId: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase.from('dogs').delete().eq('id', dogId)

  if (error) {
    console.error('Error deleting dog:', error)
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

export async function uploadDogPhoto(file: File, userId: string): Promise<{ path: string | null; error: string | null }> {
  if (!file.type.startsWith('image/')) {
    return { path: null, error: 'Please select an image file' }
  }

  if (file.size > 5 * 1024 * 1024) {
    return { path: null, error: 'Dog photo must be less than 5MB' }
  }

  const fileExt = file.name.split('.').pop()
  const fileName = `dog-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
  const filePath = `${userId}/dogs/${fileName}`

  const { error } = await supabase.storage.from('photos').upload(filePath, file, {
    cacheControl: '3600',
    upsert: true,
  })

  if (error) {
    console.error('Error uploading dog photo:', error)
    return { path: null, error: error.message }
  }

  return { path: filePath, error: null }
}

// ============================================
// Dog Meals API
// ============================================

export async function getDogMeals(dogIds: string[], date?: string): Promise<DogMeal[]> {
  const targetDate = date || new Date().toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('dog_meals')
    .select('*')
    .in('dog_id', dogIds)
    .eq('meal_date', targetDate)

  if (error) {
    console.error('Error fetching dog meals:', error)
    return []
  }

  return (data as DogMeal[]) || []
}

export async function toggleDogMeal(
  userId: string,
  dogId: string,
  mealIndex: number,
  date?: string
): Promise<{ success: boolean; error: string | null }> {
  const targetDate = date || new Date().toISOString().split('T')[0]

  // Check if meal already exists
  const { data: existing, error: fetchError } = await supabase
    .from('dog_meals')
    .select('*')
    .eq('dog_id', dogId)
    .eq('meal_date', targetDate)
    .eq('meal_index', mealIndex)
    .maybeSingle()

  if (fetchError) {
    console.error('Error checking dog meal:', fetchError)
    return { success: false, error: fetchError.message }
  }

  if (existing) {
    // Meal exists, toggle it by deleting
    const { error: deleteError } = await supabase
      .from('dog_meals')
      .delete()
      .eq('id', existing.id)

    if (deleteError) {
      console.error('Error deleting dog meal:', deleteError)
      return { success: false, error: deleteError.message }
    }
  } else {
    // Meal doesn't exist, create it
    const { error: insertError } = await supabase
      .from('dog_meals')
      .insert({
        dog_id: dogId,
        user_id: userId,
        meal_date: targetDate,
        meal_index: mealIndex,
        completed: true,
      })

    if (insertError) {
      console.error('Error creating dog meal:', insertError)
      return { success: false, error: insertError.message }
    }
  }

  return { success: true, error: null }
}

async function attachDogPhotoSignedUrl(dog: Dog): Promise<Dog> {
  if (!dog.photo_url) {
    return { ...dog, photo_signed_url: null }
  }

  if (dog.photo_url.startsWith('http')) {
    return { ...dog, photo_signed_url: dog.photo_url }
  }

  const { data: signed, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(dog.photo_url, 3600)

  if (error) {
    console.warn('Could not create signed URL for dog photo:', error)
    return { ...dog, photo_signed_url: null }
  }

  return { ...dog, photo_signed_url: signed?.signedUrl ?? null }
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

  // Normalize selected ingredient names for comparison
  const selectedLower = selectedIngredientNames.map(name => name.toLowerCase().trim())

  // Get all recipes that use at least one of the selected ingredients
  const { data: matchingIngredients, error: ingredientsError } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id, ingredient_name')
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

  // Attach ingredients to recipes and calculate match score
  const recipesWithScores = recipesData.map((recipe: any) => {
    const ingredients = ingredientsByRecipe.get(recipe.id) || []
    const requiredIngredients = ingredients.map((ing: RecipeIngredient) => ing.ingredient_name.toLowerCase().trim())
    
    // Count how many ingredients match
    const matchingCount = requiredIngredients.filter((ing: string) => 
      selectedLower.includes(ing)
    ).length
    
    // Calculate match percentage
    const matchPercentage = ingredients.length > 0 ? (matchingCount / ingredients.length) * 100 : 0
    
    return {
      ...recipe,
      ingredients,
      matchingCount,
      matchPercentage,
    }
  })

  // Filter to show recipes that use at least one selected ingredient
  // Sort by match percentage (recipes with more matching ingredients first)
  return recipesWithScores
    .filter((recipe: any) => recipe.matchingCount > 0)
    .sort((a: any, b: any) => b.matchPercentage - a.matchPercentage)
    .map((recipe: any) => {
      // Remove the scoring fields before returning
      const { matchingCount, matchPercentage, ...recipeWithoutScores } = recipe
      return recipeWithoutScores
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

// Photo functions
export async function uploadPhoto(file: File): Promise<{ photo: Photo | null; error: string | null }> {
  try {
    // Get the current session to ensure we have an authenticated user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session || !session.user) {
      console.error('=== AUTHENTICATION FAILED ===')
      return { photo: null, error: 'You must be logged in to upload photos' }
    }

    // Use the authenticated user's ID from the session
    const authenticatedUserId = session.user.id
    
    // Generate a unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${authenticatedUserId}/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading photo:', uploadError)
      return { photo: null, error: uploadError.message }
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filePath)
    const publicUrl = urlData.publicUrl
    
    // Save photo record to database
    const { data, error: dbError } = await supabase
      .from('photos')
      .insert({
        user_id: authenticatedUserId,
        storage_path: filePath,
        url: publicUrl,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error saving photo record:', dbError)
      // Try to delete the uploaded file
      await supabase.storage.from('photos').remove([filePath])
      return { photo: null, error: dbError.message }
    }

    return { photo: data as Photo, error: null }
  } catch (error: any) {
    console.error('Error uploading photo:', error)
    return { photo: null, error: error.message || 'Failed to upload photo' }
  }
}

export async function getUserPhotos(userId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching photos:', error)
    return []
  }

  // Generate signed URLs for each photo (works for both public and private buckets)
  const photosWithUrls = await Promise.all(
    (data || []).map(async (photo: Photo) => {
      // Generate a signed URL that's valid for 1 hour
      const { data: signedUrlData } = await supabase.storage
        .from('photos')
        .createSignedUrl(photo.storage_path, 3600)

      return {
        ...photo,
        url: signedUrlData?.signedUrl || photo.url, // Use signed URL if available, fallback to stored URL
      }
    })
  )

  return photosWithUrls as Photo[]
}

export async function deletePhoto(photoId: string, storagePath: string): Promise<{ success: boolean; error: string | null }> {
  try {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('photos')
      .remove([storagePath])

    if (storageError) {
      console.error('Error deleting photo from storage:', storageError)
      // Continue to delete from database even if storage deletion fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId)

    if (dbError) {
      console.error('Error deleting photo record:', dbError)
      return { success: false, error: dbError.message }
    }

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Error deleting photo:', error)
    return { success: false, error: error.message || 'Failed to delete photo' }
  }
}

// Photo assignment functions (replacing localStorage)
export async function savePhotoAssignment(userId: string, widgetIndex: number, photoId: string): Promise<boolean> {
  const { error } = await supabase
    .from('photo_assignments')
    .upsert({
      user_id: userId,
      widget_index: widgetIndex,
      photo_id: photoId
    }, {
      onConflict: 'user_id,widget_index'
    })

  if (error) {
    console.error('Error saving photo assignment:', error)
    return false
  }

  return true
}

export async function getPhotoAssignments(userId: string): Promise<Record<number, string>> {
  const { data, error } = await supabase
    .from('photo_assignments')
    .select('widget_index, photo_id')
    .eq('user_id', userId)

  if (error) {
    console.error('Error loading photo assignments:', error)
    return {}
  }

  // Convert array to object: { widgetIndex: photoId }
  const assignments: Record<number, string> = {}
  data?.forEach(assignment => {
    assignments[assignment.widget_index] = assignment.photo_id
  })

  return assignments
}

export async function deletePhotoAssignment(userId: string, widgetIndex: number): Promise<boolean> {
  const { error } = await supabase
    .from('photo_assignments')
    .delete()
    .eq('user_id', userId)
    .eq('widget_index', widgetIndex)

  if (error) {
    console.error('Error deleting photo assignment:', error)
    return false
  }

  return true
}

// ============ GROUPS ============

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

