# Complete OneSignal Setup Guide

## Why OneSignal?
- ✅ **Free** (10,000 subscribers)
- ✅ **Works with Deno/Supabase Edge Functions**
- ✅ **Handles Web Push Protocol automatically**
- ✅ **Works when app is fully closed**
- ✅ **Easy setup** (15 minutes)

## Step 1: Create OneSignal Account (2 minutes)

1. Go to [onesignal.com](https://onesignal.com)
2. Sign up (free, no credit card needed)
3. Click "New App/Website"
4. Choose **"Web Push"**
5. Enter app name: "Lifestyle"
6. Click "Create"

## Step 2: Get OneSignal Credentials (1 minute)

1. In OneSignal dashboard → **Settings** → **Keys & IDs**
2. Copy these two values:
   - **OneSignal App ID** (looks like: `12345678-abcd-1234-abcd-123456789abc`)
   - **REST API Key** (looks like: `ABCDEF123456...`)

## Step 3: Add Secrets to Supabase (2 minutes)

1. Go to Supabase Dashboard → **Edge Functions** → **Secrets**
2. Add two secrets:
   - **Name:** `ONESIGNAL_APP_ID`
     **Value:** (paste your App ID)
   - **Name:** `ONESIGNAL_REST_API_KEY`
     **Value:** (paste your REST API Key)

## Step 4: Update Database Schema (2 minutes)

We need to store OneSignal player IDs. Run this SQL:

```sql
-- Add OneSignal player_id column to push_subscriptions
ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_onesignal_player_id 
ON public.push_subscriptions(onesignal_player_id);
```

## Step 5: Update Client Code to Use OneSignal SDK (5 minutes)

I'll update the notification registration code to use OneSignal SDK instead of native Web Push.

## Step 6: Deploy Updated Edge Function

The Edge Function code is already updated to use OneSignal. Just deploy it.

## Step 7: Test

1. Register for push notifications (will now use OneSignal)
2. Have someone add an event to your calendar
3. Close the app completely
4. You should get a notification! 🎉

## Benefits:
- Works when app is closed ✅
- Free for 10,000 users ✅
- Easy to set up ✅
- Reliable ✅

Ready to set up OneSignal? It's the best solution for Deno/Supabase!

