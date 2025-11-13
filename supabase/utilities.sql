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

-- ============================================
-- DATABASE SIZE DIAGNOSTICS
-- ============================================
-- Use these queries to find what's taking up space

-- Total database size
SELECT 
  pg_size_pretty(pg_database_size(current_database())) AS total_database_size;

-- Table sizes (ordered by size - shows what's taking up space)
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Row counts per table
SELECT 
  'photos' as table_name, COUNT(*) as rows FROM public.photos
UNION ALL
SELECT 'events', COUNT(*) FROM public.events
UNION ALL
SELECT 'notes', COUNT(*) FROM public.notes
UNION ALL
SELECT 'routine_completions', COUNT(*) FROM public.routine_completions
UNION ALL
SELECT 'dog_meals', COUNT(*) FROM public.dog_meals
UNION ALL
SELECT 'todos', COUNT(*) FROM public.todos
UNION ALL
SELECT 'shopping_items', COUNT(*) FROM public.shopping_items
ORDER BY rows DESC;

-- Photos table details (likely culprit for large size)
SELECT 
  COUNT(*) as total_photos,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as oldest_photo,
  MAX(created_at) as newest_photo
FROM public.photos;

-- Check for duplicate photos
SELECT 
  storage_path,
  COUNT(*) as duplicate_count
FROM public.photos
GROUP BY storage_path
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 20;

-- IMPORTANT: Storage bucket size is NOT included in database size!
-- Go to Supabase Dashboard → Storage → photos bucket to check actual file storage size
-- Large photo files in storage buckets are often the real culprit for high storage usage

-- ============================================
-- REDUCE EGRESS (DATA TRANSFER) TIPS
-- ============================================
-- If you're seeing high Egress usage (data transfer out):
-- 
-- 1. Check for large queries fetching all data:
--    - Use pagination (LIMIT/OFFSET or cursor-based)
--    - Only SELECT columns you need
--    - Use COUNT(*) separately instead of fetching all rows
--
-- 2. Optimize Realtime subscriptions:
--    - Only subscribe to tables/channels you need
--    - Use filters to reduce data sent
--    - Unsubscribe when not needed
--
-- 3. Check for large JSONB columns being fetched:
--    - routine_completions.completed_items
--    - user_profiles.tile_preferences
--    - Only fetch these when needed
--
-- 4. Photo URLs:
--    - Don't fetch full photo URLs unless displaying
--    - Consider image optimization/thumbnails
--
-- 5. Check Supabase Dashboard → Logs for high-traffic queries
--
-- Example: Instead of fetching all events, use pagination:
-- SELECT * FROM events ORDER BY event_date DESC LIMIT 50 OFFSET 0;

