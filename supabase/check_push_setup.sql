-- Quick check to verify push notification setup

-- 1. Check if push_subscriptions table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'push_subscriptions'
) AS push_subscriptions_table_exists;

-- 2. Count push subscriptions
SELECT COUNT(*) AS total_subscriptions FROM public.push_subscriptions;

-- 3. List all push subscriptions (with user info)
SELECT 
  ps.id,
  ps.user_id,
  ps.endpoint,
  ps.created_at,
  up.username,
  au.email
FROM public.push_subscriptions ps
LEFT JOIN auth.users au ON au.id = ps.user_id
LEFT JOIN public.user_profiles up ON up.id = ps.user_id
ORDER BY ps.created_at DESC;

-- 4. Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'events'
AND trigger_name LIKE '%push%';

