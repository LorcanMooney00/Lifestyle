-- ============================================
-- UTILITY QUERIES FOR DEBUGGING AND TESTING
-- ============================================
-- These queries help diagnose issues and test functionality

-- ============================================
-- PUSH NOTIFICATIONS DIAGNOSTICS
-- ============================================

-- Check if push_subscriptions table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'push_subscriptions'
) AS push_subscriptions_table_exists;

-- Count push subscriptions
SELECT COUNT(*) AS total_subscriptions FROM public.push_subscriptions;

-- List all push subscriptions with user info
SELECT 
  ps.id,
  ps.user_id,
  ps.endpoint,
  ps.onesignal_player_id,
  ps.created_at,
  up.username,
  au.email
FROM public.push_subscriptions ps
LEFT JOIN auth.users au ON au.id = ps.user_id
LEFT JOIN public.user_profiles up ON up.id = ps.user_id
ORDER BY ps.created_at DESC;

-- Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'events'
AND trigger_name LIKE '%push%';

-- Check if pg_net extension is enabled
SELECT 
  'pg_net Extension' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
    ) THEN 'ENABLED'
    ELSE 'NOT ENABLED'
  END as status;

-- Check recent events that should have triggered notifications
SELECT 
  id,
  title,
  partner_id,
  created_by,
  event_date,
  created_at
FROM public.events
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND partner_id IS NOT NULL
  AND created_by != partner_id
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- TEST PUSH NOTIFICATION TRIGGER
-- ============================================
-- Uncomment and modify to test the trigger manually
/*
INSERT INTO public.events (
  title,
  description,
  event_date,
  event_time,
  created_by,
  partner_id
)
SELECT 
  'Test Push Notification',
  'This is a test event to trigger push notification',
  CURRENT_DATE,
  '12:00',
  'YOUR_USER_ID_HERE'::uuid,  -- Replace with actual user ID
  'PARTNER_USER_ID_HERE'::uuid  -- Replace with actual partner ID
WHERE EXISTS (
  SELECT 1 FROM public.push_subscriptions LIMIT 1
);
*/

-- ============================================
-- DISABLE/ENABLE TRIGGER
-- ============================================
-- Temporarily disable the push notification trigger
-- DROP TRIGGER IF EXISTS on_event_created_push ON public.events;

-- Re-enable by running the trigger creation in push_notifications.sql

-- ============================================
-- CHECK TRIGGER FUNCTION STATISTICS
-- ============================================
SELECT * FROM pg_stat_user_functions WHERE funcname = 'notify_push_on_event';

