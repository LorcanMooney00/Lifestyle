-- Add profile_picture_url column to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_profile_picture ON public.user_profiles(profile_picture_url) WHERE profile_picture_url IS NOT NULL;

-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS get_partners_with_emails(UUID);

-- Recreate get_partners_with_emails function to include profile_picture_url
CREATE FUNCTION get_partners_with_emails(p_user_id UUID)
RETURNS TABLE(partner_id UUID, email TEXT, username TEXT, profile_picture_url TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.partner_id,
    au.email::TEXT,
    COALESCE(up.username, au.email::TEXT) as username,
    up.profile_picture_url
  FROM public.partner_links pl
  JOIN auth.users au ON au.id = pl.partner_id
  LEFT JOIN public.user_profiles up ON up.id = pl.partner_id
  WHERE pl.user_id = p_user_id;
END;
$$;

