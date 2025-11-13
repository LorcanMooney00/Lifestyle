# OneSignal Setup for Background Push Notifications

## Why OneSignal?
- ✅ Free tier (10,000 subscribers)
- ✅ Works with Deno/Supabase Edge Functions
- ✅ Handles Web Push Protocol automatically
- ✅ Works when app is fully closed

## Setup Steps:

### 1. Create OneSignal Account
1. Go to [onesignal.com](https://onesignal.com)
2. Sign up for free account
3. Create a new app
4. Choose "Web Push" platform

### 2. Get OneSignal Credentials
1. In OneSignal dashboard → Settings → Keys & IDs
2. Copy:
   - **App ID** (OneSignal App ID)
   - **REST API Key** (for server-side sending)

### 3. Update Edge Function
Replace the Edge Function code to use OneSignal API instead of web-push.

### 4. Update Client Code
Update the push subscription registration to use OneSignal SDK.

## Alternative: Try Different Web Push Library

Before setting up OneSignal, let me try one more approach with a different library that might work with Deno.

