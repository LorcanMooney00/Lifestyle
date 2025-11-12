-- Check if everything is set up for push notifications

-- 1. Check push subscriptions (most important!)
SELECT 
  'Push Subscriptions' as check_item,
  COUNT(*)::text || ' subscription(s) found' as status,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ NO SUBSCRIPTIONS - Phone needs to register!'
    ELSE '✅ Subscriptions exist'
  END as critical_status
FROM public.push_subscriptions;

-- 2. List push subscriptions with user info
SELECT 
  ps.user_id,
  COALESCE(up.username, au.email, 'Unknown') as user_name,
  LEFT(ps.endpoint, 50) || '...' as endpoint_preview,
  ps.created_at
FROM public.push_subscriptions ps
LEFT JOIN auth.users au ON au.id = ps.user_id
LEFT JOIN public.user_profiles up ON up.id = ps.user_id
ORDER BY ps.created_at DESC;

-- 3. Check recent events that should have triggered notifications
SELECT 
  'Recent Events' as check_item,
  COUNT(*)::text || ' events in last 24h with partner_id' as status
FROM public.events
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND partner_id IS NOT NULL
  AND created_by != partner_id;

