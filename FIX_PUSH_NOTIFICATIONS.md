# Fix Push Notifications - Step by Step

The most likely issues are:

## Issue 1: Service Role Key Not Set in Trigger

The trigger needs the service role key to authenticate with the Edge Function. 

**Check:**
1. Go to Supabase Dashboard → Settings → API
2. Copy your **Service Role Key** (keep it secret!)

**Fix Option A - Use Database Webhooks (RECOMMENDED):**
- Much easier and handles authentication automatically
- Go to Database → Webhooks
- Create webhook using instructions in `supabase/webhook_push_notifications.sql`

**Fix Option B - Set Service Role Key in Database:**
```sql
-- Get your service role key from Settings → API
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```
Then re-run `supabase/trigger_push_notifications.sql`

## Issue 2: Edge Function Environment Variables

The Edge Function needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

**Check:**
- Go to Edge Functions → `send-push-notification` → Settings
- Check if these are set in "Environment Variables" or "Secrets"

**Fix:**
- These should be automatically available, but if not:
  - `SUPABASE_URL`: Your project URL (from Settings → API)
  - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key

## Issue 3: Push Subscription Not Registered

**Check:**
```sql
SELECT COUNT(*) FROM public.push_subscriptions;
```

**If 0:**
1. Open app on your phone
2. Settings → Toggle notifications OFF
3. Toggle notifications ON
4. Grant permission
5. Check table again

## Issue 4: Edge Function Not Being Called

**Check Edge Function Logs:**
1. Go to Edge Functions → `send-push-notification` → Logs
2. Have someone create an event
3. Do you see any log entries?

**If no logs:**
- The trigger/webhook isn't calling the function
- Check trigger is active: Run `supabase/complete_push_check.sql`
- Or switch to Database Webhooks (easier)

## Quick Test

**Test Edge Function directly:**
1. Go to Edge Functions → `send-push-notification` → Invoke
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
3. Check if you get notification on phone
4. Check Edge Function logs for errors

## Recommended Solution

**Use Database Webhooks instead of triggers:**
1. Disable the trigger: Run `supabase/disable_trigger_temporarily.sql`
2. Set up webhook: Follow `supabase/webhook_push_notifications.sql`
3. Webhooks handle authentication automatically

