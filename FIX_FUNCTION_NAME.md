# Fix Function Name Mismatch

## The Problem:
- Function is deployed as: `send_push_notifications` (with underscores)
- Webhook/trigger references: `send-push-notification` (with hyphens)
- These don't match, so the webhook can't find the function!

## Solution:

### Option 1: Update Webhook URL (EASIEST)
1. Go to Database → Webhooks → `send-push-on-event`
2. Click to edit it
3. Update the URL from:
   ```
   https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send-push-notification
   ```
   To:
   ```
   https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send_push_notifications
   ```
4. Save the webhook

### Option 2: Rename Function (if you prefer hyphens)
1. Go to Edge Functions → `send_push_notifications`
2. Click on it → Details tab
3. Change the name to `send-push-notification`
4. Redeploy

## Test After Fixing:
1. Close the app completely on your phone
2. Have someone add an event to your calendar
3. Check Edge Functions → `send_push_notifications` → Logs
4. You should see log entries
5. You should get a notification!

## Also Check:
- Edge Functions → Secrets → Make sure all VAPID keys are set
- The function code is correct (check Code tab)

