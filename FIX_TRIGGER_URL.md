# Fix Trigger URL for Edge Function

## The Issue
The trigger is calling the wrong Edge Function name. If you created `send_push_notifications` (with underscores), the URL needs to match.

## Quick Fix

### Option 1: Update the Trigger (Recommended)
Run this in **Supabase → SQL Editor**:

```sql
CREATE OR REPLACE FUNCTION notify_push_on_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT := 'https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send_push_notifications';
  service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuaXh3aHZ6a2Z1cHNqem9ienp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQ2NDEzMSwiZXhwIjoyMDc4MDQwMTMxfQ.mmiZ27DpW6y9aB8BpLy5OrJHQRwRoKN9PcHQnRSGzyg';
BEGIN
  IF NEW.partner_id IS NOT NULL AND NEW.created_by != NEW.partner_id THEN
    PERFORM
      net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
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
```

**Note:** The URL now uses `send_push_notifications` (with underscores) to match your function name.

### Option 2: Check Your Actual Function Name
1. Go to **Supabase → Edge Functions**
2. Look at the list of functions
3. Find the exact name (might be `send-push-notification` or `send_push_notifications`)
4. Update the URL in the trigger to match

## Test After Fixing

1. Create an event with `partner_id` set
2. Check **Supabase → Edge Functions → send_push_notifications → Logs**
3. You should see the function being called
4. Partner should receive notification

