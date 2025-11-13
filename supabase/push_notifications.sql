-- ============================================
-- PUSH NOTIFICATIONS SETUP
-- ============================================
-- Complete setup for OneSignal push notifications
-- Run these in order after schema.sql

-- ============================================
-- STEP 1: Enable pg_net extension
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Verify it's enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- ============================================
-- STEP 2: Create push_subscriptions table
-- ============================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  onesignal_player_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_onesignal_player_id 
ON public.push_subscriptions(onesignal_player_id);

-- Ensure unique OneSignal player IDs per user
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_id_onesignal_player_id_key 
ON public.push_subscriptions(user_id, onesignal_player_id) 
WHERE onesignal_player_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view their own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can create their own push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update their own push subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete their own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- STEP 3: Create database trigger for push notifications
-- ============================================
-- This trigger automatically calls the Edge Function when events are created

-- IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY with your actual service_role key
-- Get it from: Supabase → Settings → API → service_role key
CREATE OR REPLACE FUNCTION notify_push_on_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT := 'https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send_push_notifications';
  service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuaXh3aHZ6a2Z1cHNqem9ienp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQ2NDEzMSwiZXhwIjoyMDc4MDQwMTMxfQ.mmiZ27DpW6y9aB8BpLy5OrJHQRwRoKN9PcHQnRSGzyg'; -- ⚠️ REPLACE THIS!
BEGIN
  -- Only send notification if event has a partner_id and wasn't created by the partner themselves
  IF NEW.partner_id IS NOT NULL AND NEW.created_by != NEW.partner_id THEN
    -- Call Edge Function via HTTP
    PERFORM
      net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'event_id', NEW.id,
          'user_id', NEW.partner_id,  -- Send to the partner
          'title', NEW.title,
          'event_date', NEW.event_date,
          'event_time', NEW.event_time,
          'created_by', NEW.created_by
        )
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_event_created_push ON public.events;

CREATE TRIGGER on_event_created_push
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_event();

-- Verify the trigger was created
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'on_event_created_push';

