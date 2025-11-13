import { supabase } from '../supabaseClient'
import type { Dog, DogMeal } from '../../types'
import { getCachedSignedUrl, setCachedSignedUrl } from './utils'

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

  // Import compression function dynamically to avoid circular dependencies
  const { compressImage } = await import('../imageCompression')
  
  // Compress the image before uploading to reduce storage egress
  // Dog photos are displayed at 64px, so 320px (5x) is enough for retina displays
  // 100KB is sufficient for a 320px image at 60% quality (typically 30-80KB)
  console.log('Compressing dog photo before upload...')
  const compressedFile = await compressImage(file, 0.1, 320) // Max 100KB, max 320px

  const fileExt = 'jpg' // Always use jpg after compression
  const fileName = `dog-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
  const filePath = `${userId}/dogs/${fileName}`

  // Cache for 7 days (604800 seconds) to match signed URL expiry and drastically reduce egress
  const { error } = await supabase.storage.from('photos').upload(filePath, compressedFile, {
    cacheControl: '604800', // 7 days = 604800 seconds (matches signed URL expiry)
    upsert: true,
  })

  if (error) {
    console.error('Error uploading dog photo:', error)
    return { path: null, error: error.message }
  }

  return { path: filePath, error: null }
}

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
    // Check if it's already a signed URL
    try {
      const url = new URL(dog.photo_url)
      if (url.searchParams.has('token')) {
        return { ...dog, photo_signed_url: dog.photo_url }
      }
    } catch {
      // Not a valid URL, continue to generate signed URL
    }
  }

  // Check cache first
  const cached = getCachedSignedUrl(dog.photo_url)
  if (cached) {
    return { ...dog, photo_signed_url: cached }
  }

  const { data: signed, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(dog.photo_url, 604800) // Valid for 7 days to reduce egress

  if (error) {
    console.warn('Could not create signed URL for dog photo:', error)
    return { ...dog, photo_signed_url: null }
  }

  if (signed?.signedUrl) {
    setCachedSignedUrl(dog.photo_url, signed.signedUrl)
    return { ...dog, photo_signed_url: signed.signedUrl }
  }

  return { ...dog, photo_signed_url: null }
}

