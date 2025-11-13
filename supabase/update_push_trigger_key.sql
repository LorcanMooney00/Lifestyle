-- Update Push Notification Trigger with New Service Role Key
-- IMPORTANT: Replace NEW_SERVICE_ROLE_KEY_HERE with your new rotated service_role key
-- Get it from: Supabase Dashboard → Settings → API → service_role key

-- Step 1: Update the trigger function with the new service_role key
CREATE OR REPLACE FUNCTION notify_push_on_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT := 'https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send_push_notifications';
  service_role_key TEXT := 'NEW_SERVICE_ROLE_KEY_HERE'; -- ⚠️ REPLACE THIS with your new rotated key!
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

-- Step 2: Verify the trigger still exists and is working
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'on_event_created_push';

-- Note: The trigger should already exist from previous setup
-- If it doesn't exist, run this:
-- CREATE TRIGGER on_event_created_push
--   AFTER INSERT ON public.events
--   FOR EACH ROW
--   EXECUTE FUNCTION notify_push_on_event();

