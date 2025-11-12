-- Database trigger to send push notifications when events are created
-- This trigger calls the Edge Function when a new event is inserted

-- First, enable the pg_net extension (if not already enabled)
-- Run this in Supabase SQL Editor if you get an error about pg_net
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to call the Edge Function via HTTP
CREATE OR REPLACE FUNCTION notify_push_on_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Only send notification if event is for a partner (not self-created)
  IF NEW.partner_id IS NOT NULL AND NEW.created_by != NEW.partner_id THEN
    -- Get the Edge Function URL from Supabase project settings
    -- Replace YOUR_PROJECT_REF with your actual Supabase project reference
    -- Find it in: Supabase Dashboard → Settings → API → Project URL
    -- It's the part between https:// and .supabase.co
    -- Example: If URL is https://xyzabc123.supabase.co, then project_ref is xyzabc123
    edge_function_url := 'https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send-push-notification';
    
    -- Get service role key (you'll need to set this as a database secret or use current_setting)
    -- For security, use Supabase's built-in function to get the service role key
    -- Note: You may need to set this up in Supabase Dashboard → Settings → API → Service Role Key
    
    -- Call the Edge Function using pg_net
    PERFORM
      net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'event_id', NEW.id,
          'user_id', NEW.partner_id,
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
  WHEN (NEW.partner_id IS NOT NULL AND NEW.created_by != NEW.partner_id)
  EXECUTE FUNCTION notify_push_on_event();

