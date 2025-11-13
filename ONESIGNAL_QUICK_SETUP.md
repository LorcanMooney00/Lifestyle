# OneSignal Quick Setup Guide

## Step 1: Create OneSignal Account (2 minutes)
1. Go to [onesignal.com](https://onesignal.com)
2. Sign up (free)
3. Create new app → Choose "Web Push"
4. Get your credentials:
   - **App ID** (OneSignal App ID)
   - **REST API Key** (Settings → Keys & IDs)

## Step 2: Add OneSignal Secrets to Edge Function
1. Go to Supabase → Edge Functions → Secrets
2. Add:
   - `ONESIGNAL_APP_ID` = your App ID
   - `ONESIGNAL_REST_API_KEY` = your REST API Key

## Step 3: Update Client Code to Use OneSignal SDK
Instead of native Web Push, use OneSignal SDK which handles everything.

## Step 4: Deploy Updated Edge Function
The Edge Function code is already updated to use OneSignal API.

## Benefits:
- ✅ Works when app is closed
- ✅ Free (10,000 subscribers)
- ✅ Easy setup
- ✅ Works with Deno
- ✅ Handles all Web Push complexity

Want me to update the client code to use OneSignal SDK?

