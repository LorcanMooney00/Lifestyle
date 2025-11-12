-- Test if we can call the Edge Function directly from SQL
-- This will help us see if the trigger is working

-- First, let's test the trigger function manually
-- Create a test event and see if it triggers
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
  '00000000-0000-0000-0000-000000000000'::uuid, -- Replace with a test user ID
  (SELECT id FROM auth.users LIMIT 1) -- Replace with actual partner_id
WHERE EXISTS (
  SELECT 1 FROM public.push_subscriptions LIMIT 1
);

-- Check if the trigger fired by looking at Edge Function logs
-- Go to Edge Functions → send-push-notification → Logs after running this

