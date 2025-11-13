import { supabase } from '../supabaseClient'
import { getCachedSignedUrl, setCachedSignedUrl } from './utils'

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
          'routines': true,
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
    'routines': true,
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

    // Import compression function dynamically to avoid circular dependencies
    const { compressImage } = await import('../imageCompression')
    
    // Compress the image before uploading to reduce storage egress
    // Profile pictures are displayed at 64px, so 320px (5x) is enough for retina displays
    // 100KB is sufficient for a 320px image at 60% quality (typically 30-80KB)
    console.log('Compressing profile picture before upload...')
    const compressedFile = await compressImage(file, 0.1, 320) // Max 100KB, max 320px

    // Generate a unique filename (always jpg after compression)
    const fileName = `profile-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
    const filePath = `${authenticatedUserId}/${fileName}`

    // Upload to Supabase Storage (using photos bucket, or create a profile-pictures bucket)
    // Use upsert: true to overwrite if file exists
    // Cache for 7 days (604800 seconds) to match signed URL expiry and drastically reduce egress
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, compressedFile, {
        cacheControl: '604800', // 7 days = 604800 seconds (matches signed URL expiry)
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
    
    // If it's already a full URL and it's a signed URL, return it as-is
    if (url.hostname.includes('supabase') && url.searchParams.has('token')) {
      // Already a signed URL, return as-is
      return profilePictureUrl
    }
    
    // If it's already a full URL, try to extract the path and create signed URL
    if (url.hostname.includes('supabase')) {
      // Extract storage path from URL
      const pathParts = url.pathname.split('/')
      const bucketIndex = pathParts.findIndex(part => part === 'photos')
      
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        const filePath = pathParts.slice(bucketIndex + 1).join('/')
        
        // Check cache first
        const cached = getCachedSignedUrl(filePath)
        if (cached) {
          return cached
        }
        
        const { data: signedUrlData, error: signedError } = await supabase.storage
          .from('photos')
          .createSignedUrl(filePath, 604800) // Valid for 7 days to reduce egress
        
        if (!signedError && signedUrlData?.signedUrl) {
          setCachedSignedUrl(filePath, signedUrlData.signedUrl)
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
    
    // Check cache first
    const cached = getCachedSignedUrl(profilePictureUrl)
    if (cached) {
      return cached
    }
    
    // Try to generate signed URL directly - the storage policy should allow this
    // Note: We skip the list check because listing folders requires different permissions
    // and the signed URL creation will fail if the file doesn't exist or we don't have permission
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from('photos')
      .createSignedUrl(profilePictureUrl, 604800) // Valid for 7 days to reduce egress
    
    if (!signedError && signedUrlData?.signedUrl) {
      setCachedSignedUrl(profilePictureUrl, signedUrlData.signedUrl)
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

