# Fix Background Notifications (When App is Closed)

## Current Status
✅ Push subscription is working (you got a notification!)
✅ Works when app is in background (Realtime subscription)
❌ Doesn't work when app is fully closed (Edge Function not being called)

## The Problem

When the app is **open or in background**: Realtime subscription works → you get notifications
When the app is **fully closed**: Edge Function should be called by webhook → but it's not happening

## Check These:

### 1. Is the Edge Function Being Called?
1. Go to Edge Functions → `send-push-notification` → "Logs" tab
2. Have someone add an event to your calendar (while app is closed)
3. Do you see any log entries?

**If NO logs:**
- The webhook isn't calling the Edge Function
- Check webhook configuration

**If YES logs but no notification:**
- Check logs for errors
- Verify push subscription exists for the user

### 2. Check Webhook is Active
1. Go to Database → Webhooks → `send-push-on-event`
2. Is it enabled/active?
3. Check the URL: `https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send-push-notification`
4. Check the filter: `partner_id IS NOT NULL AND created_by != partner_id`

### 3. Test Edge Function Manually
1. Close the app completely on your phone
2. Go to Edge Functions → `send-push-notification` → "Test" button
3. Use this payload (replace YOUR_USER_ID with your actual user ID):
```json
{
  "event_id": "test-closed",
  "user_id": "YOUR_USER_ID",
  "title": "Test with App Closed",
  "event_date": "2025-01-15",
  "created_by": "test"
}
```
4. Click "Invoke"
5. **Do you get a notification on your phone?**
   - If YES → Edge Function works, issue is with webhook
   - If NO → Check Edge Function logs for errors

### 4. Verify Push Subscription Exists
Run in SQL Editor:
```sql
SELECT user_id, endpoint, created_at 
FROM public.push_subscriptions;
```
- You should see your user_id
- If empty → Re-register on phone

## Most Likely Issues:

1. **Webhook not calling Edge Function**
   - Solution: Check webhook configuration and logs

2. **Edge Function secrets not set**
   - Solution: Verify VAPID keys in Edge Functions → Secrets

3. **Push subscription expired/invalid**
   - Solution: Re-register on phone

## Next Steps:

1. Test Edge Function manually with app closed
2. Check Edge Function logs when event is created
3. Verify webhook is triggering
4. Check Edge Function secrets are set

Let me know what you find!

