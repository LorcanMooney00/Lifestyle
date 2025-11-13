import { supabase } from '../supabaseClient'

// Shared utility function for getting group IDs for a user
export async function getGroupIdsForUser(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching group memberships:', error)
    return []
  }

  return (data || []).map((row: any) => row.group_id)
}

// Cache for signed URLs to avoid regenerating them unnecessarily
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

export function getCachedSignedUrl(storagePath: string): string | null {
  const cached = signedUrlCache.get(storagePath)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url
  }
  return null
}

export function setCachedSignedUrl(storagePath: string, url: string, expiresInSeconds: number = 604800) {
  signedUrlCache.set(storagePath, {
    url,
    expiresAt: Date.now() + (expiresInSeconds * 1000) - 60000, // Expire 1 minute before actual expiry
  })
}

