# OneSignal Setup - Step by Step

## ✅ Code is Ready!
All code has been updated to use OneSignal. Now you just need to:

## Step 1: Create OneSignal Account (2 minutes)

1. Go to **https://onesignal.com**
2. Click **"Sign Up"** (free, no credit card)
3. Create a new app:
   - Click **"New App/Website"**
   - Choose **"Web Push"**
   - Name: `Lifestyle`
   - Click **"Create"**

## Step 2: Get Your Credentials (1 minute)

1. In OneSignal dashboard → **Settings** → **Keys & IDs**
2. Copy these:
   - **OneSignal App ID** (looks like: `12345678-abcd-1234-abcd-123456789abc`)
   - **REST API Key** (long string starting with letters/numbers)

## Step 3: Add to Environment Variables

### Local Development (.env file):
```env
VITE_ONESIGNAL_APP_ID=your-app-id-here
```

### Production (Vercel/Netlify/etc):
Add `VITE_ONESIGNAL_APP_ID` to your deployment platform's environment variables.

## Step 4: Add Secrets to Supabase Edge Function

1. Go to **Supabase Dashboard** → **Edge Functions** → **Secrets**
2. Add two secrets:
   - **Name:** `ONESIGNAL_APP_ID`
     **Value:** (paste your OneSignal App ID)
   - **Name:** `ONESIGNAL_REST_API_KEY`
     **Value:** (paste your REST API Key)

## Step 5: Update Database Schema

Run this SQL in Supabase SQL Editor:

```sql
-- Add OneSignal support
ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_onesignal_player_id 
ON public.push_subscriptions(onesignal_player_id);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_id_onesignal_player_id_key 
ON public.push_subscriptions(user_id, onesignal_player_id) 
WHERE onesignal_player_id IS NOT NULL;
```

## Step 6: Deploy Edge Function

1. Copy the code from `supabase/functions/send-push-notification/index.ts`
2. Go to Supabase → **Edge Functions** → **send-push-notification** (or create it)
3. Paste the code
4. Click **"Deploy"**

## Step 7: Test!

1. Deploy your frontend with `VITE_ONESIGNAL_APP_ID` set
2. Open the app
3. Accept push notification permission
4. Check browser console - you should see: `✅ OneSignal player ID saved to database!`
5. Have someone add an event to your calendar
6. **Close the app completely**
7. You should get a notification! 🎉

## Troubleshooting

### "OneSignal App ID not configured"
- Make sure `VITE_ONESIGNAL_APP_ID` is in your `.env` file
- Redeploy if using a deployment platform

### "No OneSignal player IDs found"
- User hasn't registered yet - they need to accept push permission
- Check browser console for OneSignal errors

### Notifications not working
- Check Supabase Edge Function logs
- Verify OneSignal secrets are set correctly
- Make sure user accepted push permission

## That's It!

OneSignal handles all the Web Push complexity. It works when the app is closed, on mobile, everywhere! 🚀

