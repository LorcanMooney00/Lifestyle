# Alternative: Use Database Trigger Instead of Webhook

Since Supabase webhooks might not have a JSON body option, we'll use a **database trigger** that calls the Edge Function directly.

## Step 1: Enable pg_net Extension (if not already done)

Run this in Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

## Step 2: Create the Trigger Function

Run this SQL in Supabase SQL Editor:

```sql
-- Function to call Edge Function when event is created
CREATE OR REPLACE FUNCTION notify_push_on_event()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT := 'https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send-push-notification';
  service_role_key TEXT := 'YOUR_SERVICE_ROLE_KEY_HERE'; -- Replace with your service_role key
BEGIN
  -- Only send notification if event has a partner_id (shared with someone)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Important:** Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual service_role key from:
- Supabase → Settings → API → `service_role` key (keep this secret!)

## Step 3: Create the Trigger

```sql
-- Create trigger on events table
DROP TRIGGER IF EXISTS on_event_created_push ON public.events;

CREATE TRIGGER on_event_created_push
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_event();
```

## Step 4: Test

1. Create an event with a `partner_id` set
2. Check Supabase → Edge Functions → Logs
3. You should see the Edge Function being called
4. Check OneSignal dashboard for sent notifications

## Troubleshooting

### Trigger not firing?
- Check if `pg_net` extension is enabled
- Verify the service_role key is correct
- Check Supabase → Database → Functions for errors

### Edge Function not receiving data?
- Check Edge Function logs
- Verify the URL is correct
- Make sure the service_role key has proper permissions

## Why This Works Better

- ✅ Works even when app is closed
- ✅ Server-side, so it's reliable
- ✅ No need to configure webhook JSON body
- ✅ Direct database trigger → Edge Function call

