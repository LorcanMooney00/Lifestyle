# How to Test Push Notifications in Supabase

## Step 1: Check if Database Trigger Exists

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this query:
   ```sql
   SELECT trigger_name, event_manipulation, event_object_table 
   FROM information_schema.triggers 
   WHERE trigger_name = 'on_event_created_push';
   ```
3. **Expected Result:** Should show 1 row with the trigger name
4. **If no results:** The trigger isn't set up. Run `supabase/setup_push_trigger.sql`

## Step 2: Check if OneSignal Player ID is Saved

1. Go to **Supabase Dashboard** → **Table Editor** → **push_subscriptions**
2. Look for your user ID (`f1b83533-95cb-4cfc-ae10-7ea4d0442bbd`)
3. Check if `onesignal_player_id` column has a value
4. **If empty:** OneSignal hasn't registered yet. Accept push permission on your phone.

## Step 3: Test the Edge Function Manually

1. Go to **Supabase Dashboard** → **Edge Functions** → **send-push-notification**
2. Click **"Invoke Function"** or **"Test"**
3. Use this test payload:
   ```json
   {
     "event_id": "test-123",
     "user_id": "f1b83533-95cb-4cfc-ae10-7ea4d0442bbd",
     "title": "Test Event",
     "event_date": "2025-01-15",
     "event_time": "10:00",
     "created_by": "test-user"
   }
   ```
4. **Expected Result:** Should return success message
5. **Check Logs:** Click **"Logs"** tab to see what happened

## Step 4: Test the Full Flow (Create Real Event)

1. **On your phone:**
   - Open the app
   - Accept push notification permission
   - Check console for: `✅ OneSignal player ID saved to database!`
   - Verify in Supabase → `push_subscriptions` table

2. **Create an event:**
   - In your app, create a calendar event
   - **IMPORTANT:** Share it with a partner (set `partner_id`)
   - Don't create it for yourself

3. **Check Edge Function logs:**
   - Go to **Supabase** → **Edge Functions** → **send-push-notification** → **Logs**
   - You should see the function being called
   - Check for any errors

4. **Check OneSignal Dashboard:**
   - Go to **OneSignal Dashboard** → **Delivery**
   - You should see notifications being sent

## Step 5: Check Database Logs (if trigger exists)

1. Go to **Supabase Dashboard** → **Database** → **Logs**
2. Look for any errors related to the trigger
3. Check if `pg_net` extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

## Troubleshooting

### Trigger Not Firing?
- Check if `partner_id` is set on the event
- Verify trigger exists (Step 1)
- Check database logs for errors

### Edge Function Not Being Called?
- Check if trigger is set up correctly
- Verify service_role key in trigger function
- Check `pg_net` extension is enabled

### No Player ID?
- Accept push permission on device
- Check browser console for OneSignal errors
- Verify `onesignal_player_id` is being saved

### Edge Function Error?
- Check Edge Function logs
- Verify OneSignal secrets are set:
  - `ONESIGNAL_APP_ID`
  - `ONESIGNAL_REST_API_KEY`
- Test Edge Function manually (Step 3)

## Quick Test Checklist

- [ ] Trigger exists (Step 1)
- [ ] Player ID saved in database (Step 2)
- [ ] Edge Function works manually (Step 3)
- [ ] Event created with `partner_id` (Step 4)
- [ ] Edge Function called automatically (Step 4)
- [ ] Notification sent via OneSignal (Step 4)

