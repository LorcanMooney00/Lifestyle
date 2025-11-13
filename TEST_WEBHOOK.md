# Test Webhook and Edge Function

## Current Status:
✅ Push subscriptions are registered (8 rows in database)
✅ Events are being created
❌ Notifications not working when app is closed

## The Issue:
The Realtime subscription only works when app is open/background. For closed app, the **webhook** should call the **Edge Function**.

## Test Steps:

### 1. Check Edge Function Logs
1. Go to Edge Functions → `send-push-notification` → "Logs" tab
2. Have someone add an event to your calendar (while your app is **fully closed**)
3. Do you see any log entries?
   - If NO → Webhook isn't calling the function
   - If YES → Check logs for errors

### 2. Test Edge Function Manually
1. Close the app completely on your phone
2. Go to Edge Functions → `send-push-notification` → "Test" button
3. Use this payload (replace with YOUR_USER_ID from push_subscriptions table):
```json
{
  "event_id": "test-closed",
  "user_id": "cc7e55c8-5277-4d35-a1ce-156417b57e46",
  "title": "Test with App Closed",
  "event_date": "2025-01-15",
  "created_by": "test-user"
}
```
4. Click "Invoke"
5. **Do you get a notification?**
   - If YES → Edge Function works, issue is webhook
   - If NO → Check Edge Function logs for errors

### 3. Check Webhook Configuration
1. Go to Database → Webhooks → `send-push-on-event`
2. Verify:
   - URL: `https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send-push-notification`
   - Filter: `partner_id IS NOT NULL AND created_by != partner_id`
   - Is it enabled/active?

### 4. Check Webhook Logs
Some platforms show webhook execution logs. Check if the webhook is firing.

## Most Likely Issue:
The webhook isn't calling the Edge Function when events are created. This could be:
- Webhook not configured correctly
- Filter not matching events
- Edge Function not deployed/active

Test the Edge Function manually first - that will tell us if the function works or if there's an issue with the webhook.

