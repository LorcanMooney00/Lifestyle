# Push Notifications Setup Guide

This guide explains how to set up Web Push API notifications that work even when the app is closed.

## Overview

The app now supports Web Push API for background notifications. This requires:
1. VAPID keys (public/private key pair)
2. A Supabase Edge Function to send push notifications
3. Database trigger to call the Edge Function when events are created

## Step 1: Generate VAPID Keys

You need to generate a VAPID key pair. You can use this online tool or Node.js:

### Using Node.js:
```bash
npm install -g web-push
web-push generate-vapid-keys
```

This will output:
- **Public Key**: A long base64 string (starts with `BM...`)
- **Private Key**: A long base64 string (starts with `...`)

### Save the keys:
1. Add the **public key** to your `.env` file:
   ```
   VITE_VAPID_PUBLIC_KEY=BM...your-public-key-here...
   ```

2. Save the **private key** securely - you'll need it for the Edge Function

## Step 2: Create Supabase Edge Function

Create a new Edge Function in Supabase to send push notifications:

1. Go to Supabase Dashboard → Edge Functions
2. Create a new function called `send-push-notification`
3. Use the code from `supabase/functions/send-push-notification/index.ts` (create this file)
4. Set the `VAPID_PRIVATE_KEY` secret in Supabase Dashboard → Settings → Edge Functions → Secrets

## Step 3: Create Database Trigger

Run the SQL in `supabase/send_push_notifications.sql` to create the helper function.

Then create a trigger that calls the Edge Function when a new event is created:

```sql
-- Create a function that calls the Edge Function
CREATE OR REPLACE FUNCTION notify_new_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Call Supabase Edge Function via HTTP
  PERFORM
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push-notification',
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
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_event_created ON public.events;
CREATE TRIGGER on_event_created
  AFTER INSERT ON public.events
  FOR EACH ROW
  WHEN (NEW.partner_id IS NOT NULL AND NEW.created_by != NEW.partner_id)
  EXECUTE FUNCTION notify_new_event();
```

**Note**: You'll need to enable the `http` extension and set up the service role key. Alternatively, use Supabase's built-in webhook system.

## Step 4: Alternative - Use Supabase Webhooks

Instead of a database trigger, you can use Supabase Webhooks:

1. Go to Supabase Dashboard → Database → Webhooks
2. Create a new webhook for the `events` table
3. Set the URL to your Edge Function endpoint
4. Configure it to trigger on INSERT events

## Step 5: Test

1. Make sure you've run the SQL migration: `supabase/add_push_subscriptions.sql`
2. Open the app and enable notifications in settings
3. Grant notification permission
4. The app will automatically register for push notifications
5. Have someone add an event to your calendar
6. You should receive a push notification even if the app is closed!

## Troubleshooting

- **No notifications**: Check browser console for errors
- **VAPID key error**: Make sure the public key is correctly set in `.env`
- **Edge Function not called**: Check Supabase logs for errors
- **Permission denied**: Make sure notification permission is granted in browser settings

## Security Notes

- Never commit VAPID private key to git
- Store private key in Supabase Edge Function secrets
- Public key is safe to expose in client code

