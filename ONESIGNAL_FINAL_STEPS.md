# OneSignal Final Setup Steps

## ✅ Completed:
- [x] OneSignal account created
- [x] App ID: `56a8f812-6bb8-49de-a0ce-528ef87d563d`
- [x] Code updated in `index.html`
- [x] Service worker file placed in `public/`
- [x] Database migration ready (`add_onesignal_support.sql`)

## 🔲 Remaining Steps:

### Step 1: Get REST API Key (1 minute)
1. Go to OneSignal Dashboard → **Settings** → **Keys & IDs**
2. Copy the **REST API Key** (long string)

### Step 2: Add Secrets to Supabase (2 minutes)
1. Go to **Supabase Dashboard** → **Edge Functions** → **Secrets**
2. Add these two secrets:
   - **Name:** `ONESIGNAL_APP_ID`
     **Value:** `56a8f812-6bb8-49de-a0ce-528ef87d563d`
   - **Name:** `ONESIGNAL_REST_API_KEY`
     **Value:** (paste your REST API Key from Step 1)

### Step 3: Run Database Migration (1 minute)
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run the SQL from `supabase/add_onesignal_support.sql`
3. Verify it runs without errors

### Step 4: Deploy Edge Function (2 minutes)
1. Go to **Supabase Dashboard** → **Edge Functions** → **send-push-notification**
2. Copy the code from `supabase/functions/send-push-notification/index.ts`
3. Paste it into the Edge Function editor
4. Click **"Deploy"**

### Step 5: Deploy Frontend (2 minutes)
1. Commit and push your changes
2. Deploy to Vercel/Netlify/etc
3. Make sure `OneSignalSDKWorker.js` is included in the build

### Step 6: Test! 🎉
1. Visit your deployed site
2. Accept push notification permission
3. Check browser console - should see: `✅ OneSignal player ID saved to database!`
4. Have someone add an event to your calendar
5. **Close the app completely**
6. You should get a notification!

## Troubleshooting:
- **No player ID saved?** Check browser console for errors
- **Notifications not sending?** Check Supabase Edge Function logs
- **Service worker not loading?** Verify `OneSignalSDKWorker.js` is in `public/` folder

## You're Almost There! 🚀

