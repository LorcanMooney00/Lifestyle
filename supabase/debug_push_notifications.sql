-- Debug script to check push notification setup
-- Run this in Supabase SQL Editor to see what's configured

-- 1. Check if push_subscriptions table exists and has data
SELECT 
  'Push Subscriptions' as check_type,
  COUNT(*) as count,
  STRING_AGG(user_id::text, ', ') as user_ids
FROM public.push_subscriptions;

-- 2. List all push subscriptions with details
SELECT 
  ps.id,
  ps.user_id,
  LEFT(ps.endpoint, 50) as endpoint_preview,
  ps.created_at,
  up.username,
  au.email
FROM public.push_subscriptions ps
LEFT JOIN auth.users au ON au.id = ps.user_id
LEFT JOIN public.user_profiles up ON up.id = ps.user_id
ORDER BY ps.created_at DESC;

-- 3. Check if trigger exists
SELECT 
  'Trigger Status' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'on_event_created_push'
    ) THEN 'EXISTS'
    ELSE 'NOT FOUND'
  END as status;

-- 4. Check recent events to see if they have partner_id
SELECT 
  id,
  title,
  partner_id,
  created_by,
  event_date,
  created_at
FROM public.events
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check if pg_net extension is enabled
SELECT 
  'pg_net Extension' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
    ) THEN 'ENABLED'
    ELSE 'NOT ENABLED'
  END as status;

