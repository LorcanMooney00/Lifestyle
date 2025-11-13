# Quick Setup: Database Trigger for Push Notifications

## Why Use a Trigger Instead of Webhook?

- ✅ Easier to set up (just run SQL)
- ✅ No need to configure JSON body in webhook UI
- ✅ More reliable (runs directly in database)
- ✅ Works when app is closed

## Setup Steps (5 minutes)

### Step 1: Get Your Service Role Key

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Find **service_role** key (the long secret key)
3. **Copy it** (you'll need it in Step 2)

⚠️ **Keep this secret!** Don't share it publicly.

### Step 2: Update the SQL File

1. Open `supabase/setup_push_trigger.sql`
2. Find this line:
   ```sql
   service_role_key TEXT := 'YOUR_SERVICE_ROLE_KEY'; -- ⚠️ REPLACE THIS!
   ```
3. Replace `YOUR_SERVICE_ROLE_KEY` with your actual service_role key
4. Save the file

### Step 3: Run the SQL

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy the entire contents of `supabase/setup_push_trigger.sql`
3. Paste and run it
4. You should see: "Success. No rows returned"

### Step 4: Test

1. Create an event **with a partner_id** (share it with someone)
2. Check **Supabase** → **Edge Functions** → **Logs**
3. You should see the Edge Function being called
4. Check **OneSignal dashboard** for sent notifications
5. **Close the app completely** on your phone
6. Create another event - you should get a notification! 🎉

## Troubleshooting

### "pg_net extension not found"
- The SQL file includes `CREATE EXTENSION IF NOT EXISTS pg_net;`
- If it still fails, run it separately first

### "Trigger not firing"
- Make sure the event has a `partner_id` set
- Check that `created_by != partner_id` (don't notify yourself)
- Verify the service_role key is correct

### "Edge Function not receiving data"
- Check Edge Function logs in Supabase
- Verify the URL is correct: `https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send-push-notification`
- Make sure OneSignal secrets are set in Edge Function

## That's It!

The trigger will automatically call your Edge Function whenever someone creates an event for their partner. No webhook configuration needed! 🚀

