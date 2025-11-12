# Diagnosing Push Notification Issue

## Current Status from Usage Page:
- ✅ Edge Function Invocations: 4 / 500,000 (plenty of quota left)
- ⚠️ Egress overage (might cause some restrictions, but shouldn't block notifications)

## The Real Issues to Check:

### 1. Is the Edge Function Being Called?
Only 4 invocations suggests it's barely being used. Check:

**A. Edge Function Logs:**
- Go to Edge Functions → `send-push-notification` → "Logs" tab
- When someone creates an event, do you see new log entries?
- If NO logs → Webhook isn't calling the function

**B. Webhook Status:**
- Go to Database → Webhooks → `send-push-on-event`
- Is it active/enabled?
- Check the URL is correct: `https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send-push-notification`

### 2. Push Subscription Registered?
Run in SQL Editor:
```sql
SELECT COUNT(*) FROM public.push_subscriptions;
```
- If 0 → Phone hasn't registered
- Fix: Open app → Settings → Toggle notifications off/on → Grant permission

### 3. Edge Function Secrets Set?
- Go to Edge Functions → Secrets
- Verify you have:
  - `VAPID_PRIVATE_KEY`
  - `VAPID_PUBLIC_KEY`
  - `VAPID_SUBJECT`
- If missing → Function will fail silently

### 4. Test Edge Function Manually
1. Go to Edge Functions → `send-push-notification` → "Test" button
2. Use this payload (replace YOUR_USER_ID):
```json
{
  "event_id": "test",
  "user_id": "YOUR_USER_ID",
  "title": "Test",
  "event_date": "2025-01-15",
  "created_by": "test"
}
```
3. Click "Invoke"
4. Check "Logs" tab for response
5. Do you get a notification on phone?

## Most Likely Issues (in order):

1. **Push subscription not registered** (most common)
   - Solution: Register on phone

2. **Edge Function secrets not set**
   - Solution: Add VAPID keys to secrets

3. **Webhook not calling function**
   - Solution: Check webhook configuration and logs

4. **Edge Function not deployed**
   - Solution: Deploy it

## Quick Action Items:

1. ✅ Check Edge Function logs when event is created
2. ✅ Check push subscription count
3. ✅ Verify Edge Function secrets are set
4. ✅ Test Edge Function manually

The usage limits are NOT the problem - you have plenty of Edge Function quota left!

