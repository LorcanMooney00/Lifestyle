# Environment Variables Setup

## Local Development (.env file)

Create a `.env` file in the root of your project with:

```env
# Supabase (Required)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Site URL (Optional - for local dev)
VITE_SITE_URL=http://localhost:5173

# OneSignal (Required for push notifications)
VITE_ONESIGNAL_APP_ID=56a8f812-6bb8-49de-a0ce-528ef87d563d

# VAPID Key (Optional - only if using native Web Push as fallback)
VITE_VAPID_PUBLIC_KEY=BK49yP6BmhAxqdqF9UOQaK5YKKVv19A14UZGSbQg--GhY4k1LJEFDQu0wGmPLyBBsroK29G1FTNQKphB7ZMH9c8
```

## Vercel Environment Variables

### How to Add:

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add each variable below:

### Required Variables:

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Get from Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Get from Supabase → Settings → API |
| `VITE_ONESIGNAL_APP_ID` | `56a8f812-6bb8-49de-a0ce-528ef87d563d` | OneSignal App ID |

### Optional Variables:

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `VITE_SITE_URL` | `https://lifestyleapp.vercel.app` | Your Vercel deployment URL |
| `VITE_VAPID_PUBLIC_KEY` | `BK49yP6BmhAxqdqF9UOQaK5YKKVv19A14UZGSbQg--GhY4k1LJEFDQu0wGmPLyBBsroK29G1FTNQKphB7ZMH9c8` | Only if using native Web Push fallback |

### Important Notes:

- **REST API Key is NOT needed in Vercel** - it's only for Supabase Edge Functions (already added as a secret)
- After adding variables, **redeploy** your Vercel project for changes to take effect
- Make sure to select the correct **Environment** (Production, Preview, Development) when adding variables

## Quick Vercel Setup Steps:

1. Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Click **"Add New"**
3. Add each variable from the table above
4. Click **"Save"**
5. Go to **Deployments** tab
6. Click the **"..."** menu on the latest deployment
7. Click **"Redeploy"** to apply the new environment variables

## Verify Setup:

After deployment, check browser console on your site:
- Should see: `✅ OneSignal player ID saved to database!` (after accepting notifications)
- No errors about missing environment variables

