-- Setup Database Trigger for OneSignal Push Notifications
-- This trigger automatically calls the Edge Function when events are created

-- Step 1: Enable pg_net extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Create the trigger function
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

-- Step 3: Create the trigger
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

