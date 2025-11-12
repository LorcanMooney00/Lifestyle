-- Database function to trigger push notifications
-- This will be called by a Supabase Edge Function when events are created
-- The Edge Function will handle the actual push notification sending

-- Function to get push subscriptions for a user
CREATE OR REPLACE FUNCTION get_user_push_subscriptions(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  endpoint TEXT,
  p256dh TEXT,
  auth TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id,
    ps.endpoint,
    ps.p256dh,
    ps.auth
  FROM public.push_subscriptions ps
  WHERE ps.user_id = p_user_id;
END;
$$;

-- Note: The actual push notification sending will be handled by a Supabase Edge Function
-- See PUSH_NOTIFICATIONS_SETUP.md for instructions on setting up VAPID keys and Edge Functions

