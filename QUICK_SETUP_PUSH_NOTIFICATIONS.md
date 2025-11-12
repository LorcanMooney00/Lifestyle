# Quick Setup Guide for Push Notifications

## Step 1: Verify Push Subscription is Registered

1. Open your app on your phone
2. Go to Settings → Enable "Push Notifications" toggle
3. Grant notification permission when prompted
4. Check browser console (if possible) - you should see: "Push subscription registered and saved"
5. Verify in Supabase:
   - Go to Table Editor → `push_subscriptions`
   - You should see a row with your user_id

## Step 2: Verify Edge Function is Deployed

1. Go to Supabase Dashboard → Edge Functions
2. You should see `send-push-notification` function listed
3. Click on it to see if it's active

## Step 3: Set Up Database Webhook (EASIEST METHOD)

1. Go to Supabase Dashboard → Database → Webhooks
2. Click "Create a new webhook"
3. Configure:
   - **Name**: `send-push-on-event`
   - **Table**: `events`
   - **Events**: Check `INSERT`
   - **HTTP Request**:
     - **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push-notification`
       - Replace `YOUR_PROJECT_REF` with your actual project reference (found in Settings → API → Project URL)
     - **Method**: `POST`
     - **Headers**:
       - `Authorization`: `Bearer YOUR_SERVICE_ROLE_KEY`
         - Get this from Settings → API → Service Role Key (keep it secret!)
       - `Content-Type`: `application/json`
     - **Body** (select "JSON" and paste):
       ```json
       {
         "event_id": "{{ $1.id }}",
         "user_id": "{{ $1.partner_id }}",
         "title": "{{ $1.title }}",
         "event_date": "{{ $1.event_date }}",
         "event_time": "{{ $1.event_time }}",
         "created_by": "{{ $1.created_by }}"
       }
       ```
   - **Filter** (optional but recommended):
     - Add condition: `partner_id IS NOT NULL AND created_by != partner_id`
     - This ensures we only send notifications for events created by partners, not self-created events

4. Click "Create webhook"

## Step 4: Test

1. Have someone add an event to your calendar
2. You should receive a push notification on your phone (even if app is closed)

## Troubleshooting

### No push subscription in database?
- Check browser console for errors
- Make sure VAPID public key is in `.env` file
- Try refreshing the app and re-enabling notifications

### Webhook not triggering?
- Check Supabase Dashboard → Logs → Edge Functions for errors
- Verify the webhook URL is correct
- Make sure Service Role Key is correct in webhook headers

### Edge Function errors?
- Check Edge Functions → `send-push-notification` → Logs
- Verify all three secrets are set: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`

### Still not working?
- Check if push subscription exists in `push_subscriptions` table
- Verify the `user_id` in push_subscriptions matches the `partner_id` in the event
- Check browser notification settings - make sure notifications are allowed for your site

