import { supabase } from '../supabaseClient'
import { getProfilePictureUrl } from './user'

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

