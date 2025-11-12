-- Complete push notification setup check
-- Run this to see the full status

-- 1. Push subscriptions count
SELECT 
  'Push Subscriptions Count' as check_item,
  COUNT(*)::text as status
FROM public.push_subscriptions;

-- 2. Push subscriptions details
SELECT 
  'Push Subscription' as check_item,
  'User: ' || COALESCE(up.username, au.email, ps.user_id::text) || 
  ' | Endpoint: ' || LEFT(ps.endpoint, 30) || '...' as status
FROM public.push_subscriptions ps
LEFT JOIN auth.users au ON au.id = ps.user_id
LEFT JOIN public.user_profiles up ON up.id = ps.user_id
ORDER BY ps.created_at DESC
LIMIT 5;

-- 3. Trigger status
SELECT 
  'Database Trigger' as check_item,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'on_event_created_push'
    ) THEN 'ACTIVE - Will call Edge Function on event insert'
    ELSE 'NOT FOUND - Use Database Webhooks instead'
  END as status;

-- 4. pg_net extension
SELECT 
  'pg_net Extension' as check_item,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
    ) THEN 'ENABLED ✓'
    ELSE 'NOT ENABLED - Run enable_pg_net.sql'
  END as status;

-- 5. Recent events with partner_id (these should trigger notifications)
SELECT 
  'Recent Events for Partners' as check_item,
  COUNT(*)::text || ' events in last 24h with partner_id' as status
FROM public.events
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND partner_id IS NOT NULL
  AND created_by != partner_id;

