# Debug Push Notifications - Step by Step

## Current Status Checklist:
- ✅ Push subscriptions registered (8 rows in database)
- ✅ VAPID key set in deployment
- ✅ Edge Function deployed (`send_push_notifications`)
- ✅ Webhook configured
- ❌ Notifications not working

## Debug Steps:

### 1. Check Edge Function Logs (MOST IMPORTANT)
1. Go to Edge Functions → `send_push_notifications` → "Logs" tab
2. Have someone add an event to your calendar (while app is **fully closed**)
3. **Do you see any log entries?**
   - If NO → Webhook isn't calling the function
   - If YES → Check logs for errors

### 2. Test Edge Function Manually
1. Close app completely on phone
2. Go to Edge Functions → `send_push_notifications` → "Test" button
3. Use this payload (replace with YOUR user_id from push_subscriptions):
```json
{
  "event_id": "test-manual",
  "user_id": "cc7e55c8-5277-4d35-a1ce-156417b57e46",
  "title": "Manual Test",
  "event_date": "2025-01-15",
  "created_by": "test"
}
```
4. Click "Invoke"
5. **Check the response:**
   - What does it say?
   - Check "Logs" tab for any errors
6. **Do you get a notification on phone?**
   - If YES → Function works, issue is webhook
   - If NO → Check logs for errors

### 3. Check Edge Function Secrets
1. Go to Edge Functions → Secrets
2. Verify you have ALL of these:
   - `VAPID_PRIVATE_KEY`
   - `VAPID_PUBLIC_KEY`
   - `VAPID_SUBJECT`
3. If any are missing → Add them

### 4. Check Edge Function Code
1. Go to Edge Functions → `send_push_notifications` → "Code" tab
2. Does it match the code in `supabase/functions/send-push-notification/index.ts`?
3. If different → Copy correct code and redeploy

### 5. Check Webhook Configuration
1. Go to Database → Webhooks → `send-push-on-event`
2. Verify:
   - URL: `https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send_push_notifications`
   - Method: `POST`
   - Headers: `Authorization: Bearer [service_role_key]` and `Content-Type: application/json`
   - Body: JSON with `{{ $1.partner_id }}` etc.
   - Filter: `partner_id IS NOT NULL AND created_by != partner_id`
3. Is it enabled/active?

### 6. Verify Push Subscription is Valid
Run in SQL Editor:
```sql
SELECT user_id, endpoint, created_at 
FROM public.push_subscriptions 
WHERE user_id = 'cc7e55c8-5277-4d35-a1ce-156417b57e46';
```
- Does the endpoint look valid? (should start with https://)
- Is it recent?

## Most Likely Issues:

1. **Webhook not calling function** → Check Edge Function logs when event is created
2. **Edge Function secrets missing** → Check Secrets tab
3. **Edge Function code wrong** → Check Code tab
4. **Push subscription invalid** → Re-register on phone

## Next Steps:
Start with #1 (check Edge Function logs) - that will tell us if the webhook is working!

