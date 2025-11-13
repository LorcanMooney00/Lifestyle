import { supabase } from '../supabaseClient'
import type { Photo } from '../../types'
import { getCachedSignedUrl, setCachedSignedUrl } from './utils'

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
    // Cache for 7 days (604800 seconds) to match signed URL expiry and drastically reduce egress
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, file, {
        cacheControl: '604800', // 7 days = 604800 seconds (matches signed URL expiry)
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
  // Use cache to avoid regenerating signed URLs unnecessarily
  const photosWithUrls = await Promise.all(
    (data || []).map(async (photo: Photo) => {
      // Check if URL is already a signed URL
      if (photo.url && photo.url.includes('token=')) {
        return photo
      }

      // Check cache first
      const cached = getCachedSignedUrl(photo.storage_path)
      if (cached) {
        return {
          ...photo,
          url: cached,
        }
      }

      // Generate a signed URL that's valid for 7 days (maximum allowed) to reduce egress
      const { data: signedUrlData } = await supabase.storage
        .from('photos')
        .createSignedUrl(photo.storage_path, 604800) // 7 days = 604800 seconds

      const signedUrl = signedUrlData?.signedUrl || photo.url
      
      // Cache the signed URL
      if (signedUrlData?.signedUrl) {
        setCachedSignedUrl(photo.storage_path, signedUrlData.signedUrl)
      }

      return {
        ...photo,
        url: signedUrl, // Use signed URL if available, fallback to stored URL
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

