# Push Notification Troubleshooting

## Current Status
- ✅ `pg_net` extension is enabled
- ✅ Events are being created (1 event in last 24h with partner_id)
- ❓ Need to verify: Push subscriptions, Trigger status, Edge Function

## Step-by-Step Debugging

### 1. Check Push Subscriptions
Run this in SQL Editor:
```sql
SELECT COUNT(*) as subscription_count FROM public.push_subscriptions;
```

**If count is 0:**
- Your phone hasn't registered for push notifications yet
- **Fix:** 
  1. Open the app on your phone
  2. Go to Settings → Toggle "Push Notifications" OFF
  3. Toggle it back ON
  4. Grant permission when prompted
  5. Check the table again - you should see a row

### 2. Check Trigger Status
From your diagnostic query results, what does the "Database Trigger" row say?
- If "ACTIVE" → Trigger is working
- If "NOT FOUND" → Trigger was disabled, need to re-enable it

**If trigger is NOT FOUND:**
Run `supabase/trigger_push_notifications.sql` again in SQL Editor

### 3. Check Edge Function
- Go to Supabase Dashboard → Edge Functions
- Is `send-push-notification` listed?
- Click on it → Check "Logs" tab
- When someone adds an event, do you see log entries?

**If no logs appear:**
- The trigger/webhook isn't calling the Edge Function
- Check the trigger is active (step 2)
- Or set up a Database Webhook instead

### 4. Test Edge Function Manually
- Go to Edge Functions → `send-push-notification` → "Invoke"
- Use this test payload (replace YOUR_USER_ID with your actual user ID):
```json
{
  "event_id": "test-123",
  "user_id": "YOUR_USER_ID",
  "title": "Test Notification",
  "event_date": "2025-01-15",
  "event_time": "10:00",
  "created_by": "someone-else"
}
```
- Click "Invoke"
- **Do you get a push notification on your phone?**
  - If YES → Edge Function works, issue is with trigger/webhook
  - If NO → Check push subscriptions exist and Edge Function logs for errors

### 5. Check Edge Function Secrets
- Go to Edge Functions → Secrets
- Verify you have:
  - `VAPID_PRIVATE_KEY`
  - `VAPID_PUBLIC_KEY`  
  - `VAPID_SUBJECT`

## Most Likely Issues

1. **No push subscription registered** → Phone hasn't registered yet
2. **Trigger not active** → Was disabled when pg_net wasn't available
3. **Edge Function not deployed** → Need to deploy it
4. **Edge Function not being called** → Trigger/webhook not working

## Quick Fix Checklist

- [ ] Push subscription exists in database (check `push_subscriptions` table)
- [ ] Trigger is active (run diagnostic query)
- [ ] Edge Function is deployed (check Edge Functions list)
- [ ] Edge Function secrets are set (check Secrets)
- [ ] Test Edge Function manually (does it send notification?)
- [ ] Check Edge Function logs when event is created (is it being called?)

