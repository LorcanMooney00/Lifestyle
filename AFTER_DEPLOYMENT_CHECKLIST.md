# After Deploying send-push-notification Function

## What You Should See

After deploying, you'll see a page similar to `swift-responder` but for `send-push-notification`:

### Details Section (Left Column):
- **Slug:** `send-push-notification`
- **Endpoint URL:** `https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send-push-notification`
- **Created at:** (current date/time)
- **Deployments:** `1`

### Function Configuration (Right Column):
- **Name:** `send-push-notification`
- **Verify JWT with legacy secret:** Toggle (can leave ON for now)

## Critical Steps After Deployment

### 1. Set Secrets (MOST IMPORTANT!)
1. Click on "Edge Functions" in left sidebar
2. Click "Secrets" tab (or go to Settings → Edge Functions → Secrets)
3. Add these three secrets:
   - **Name:** `VAPID_PRIVATE_KEY`
     **Value:** `r5btv2c5d0jsxzgs6mxC8i86JJ_bAmTqbDBq9CXDJkg`
   
   - **Name:** `VAPID_PUBLIC_KEY`
     **Value:** `BK49yP6BmhAxqdqF9UOQaK5YKKVv19A14UZGSbQg--GhY4k1LJEFDQu0wGmPLyBBsroK29G1FTNQKphB7ZMH9c8`
   
   - **Name:** `VAPID_SUBJECT`
     **Value:** `mailto:your-email@example.com` (replace with your email)

### 2. Verify Webhook URL
1. Go to Database → Webhooks
2. Click on `send-push-on-event` webhook
3. Verify the URL is: `https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send-push-notification`
4. If different, update it

### 3. Test the Function
1. Go to Edge Functions → `send-push-notification`
2. Click "Test" button (or use the "Invoke" section)
3. Use this test payload (replace `YOUR_USER_ID` with your actual user ID):
```json
{
  "event_id": "test-123",
  "user_id": "YOUR_USER_ID",
  "title": "Test Notification",
  "event_date": "2025-01-15",
  "event_time": "10:00",
  "created_by": "test-user"
}
```
4. Click "Invoke"
5. Check if you get a notification on your phone
6. Check the "Logs" tab for any errors

### 4. Check Push Subscriptions
Run in SQL Editor:
```sql
SELECT COUNT(*) FROM public.push_subscriptions;
```
- If 0: Your phone hasn't registered yet
- Fix: Open app on phone → Settings → Toggle notifications off/on → Grant permission

### 5. Test with Real Event
1. Have someone add an event to your calendar
2. Go to Edge Functions → `send-push-notification` → "Logs" tab
3. You should see a log entry when the webhook fires
4. Check if you get a notification

## Troubleshooting

### No logs when event is created?
- Webhook might not be triggering
- Check webhook configuration in Database → Webhooks

### Function returns error?
- Check "Logs" tab for error details
- Verify all three VAPID secrets are set
- Verify push subscription exists for the user_id

### No notification on phone?
- Check push subscription exists (run SQL query above)
- Check browser notification permissions
- Check Edge Function logs for errors

