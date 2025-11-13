# OneSignal Service Worker Setup

## Step 1: Download the Service Worker File

1. In OneSignal dashboard → **Settings** → **Web Configuration**
2. Click **"Download Service Worker File"**
3. Save it as `OneSignalSDKWorker.js`

## Step 2: Place in Public Folder

1. Copy the downloaded `OneSignalSDKWorker.js` file
2. Place it in your `public/` folder (same level as `sw.js`, `manifest.json`, etc.)

## Step 3: Verify

Your `public/` folder should now have:
- `OneSignalSDKWorker.js` (OneSignal service worker)
- `sw.js` (your existing service worker - can coexist)
- `manifest.json`
- `favicon.svg`

## Important Notes

- OneSignal's service worker handles push notifications
- Your existing `sw.js` can stay for other features
- Both service workers can coexist
- OneSignal will automatically use `OneSignalSDKWorker.js` when present

## After Adding the File

1. Deploy your app
2. Test by visiting your site and accepting push notifications
3. Check browser console for OneSignal initialization messages

