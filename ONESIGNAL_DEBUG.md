# Debug OneSignal Initialization

## Check These in Browser Console

After loading the page, check for these messages in order:

1. **"Setting up OneSignal deferred initialization..."** 
   - If you DON'T see this → The script in index.html isn't running
   
2. **"OneSignal deferred callback called, initializing..."**
   - If you DON'T see this → OneSignal SDK script isn't loading from CDN
   
3. **"✅ OneSignal initialized successfully"**
   - If you DON'T see this → OneSignal.init() is failing
   
4. **"OneSignal ready event received!"**
   - If you DON'T see this → The custom event isn't firing

## Common Issues

### Issue 1: OneSignal SDK Script Not Loading
**Symptoms:** No "Setting up OneSignal deferred initialization..." message

**Check:**
- Open Browser DevTools → Network tab
- Reload page
- Look for `OneSignalSDK.page.js` request
- Check if it's loading (status 200) or failing (404, blocked, etc.)

**Fix:**
- Check if CDN is accessible
- Check browser console for CORS or CSP errors
- Try loading the script URL directly in browser

### Issue 2: OneSignal Deferred Callback Not Firing
**Symptoms:** See "Setting up..." but NOT "OneSignal deferred callback called..."

**Possible Causes:**
- OneSignal SDK script loaded but deferred array isn't being processed
- Script loading order issue

**Fix:**
- Make sure script has `defer` attribute
- Check if there are JavaScript errors before OneSignal loads

### Issue 3: OneSignal.init() Failing
**Symptoms:** See "OneSignal deferred callback called..." but NOT "✅ OneSignal initialized successfully"

**Check:**
- Look for error message after "OneSignal deferred callback called..."
- Check if App ID is correct
- Check if service worker is blocking initialization

### Issue 4: Service Worker Issues
**Symptoms:** "Could not get ServiceWorkerRegistration to postMessage!"

**This is usually harmless** - OneSignal is trying to optimize but service worker isn't ready yet.

## Quick Test

1. Open browser console
2. Type: `window.OneSignal`
3. If it's `undefined` → OneSignal hasn't loaded
4. If it exists but methods are missing → OneSignal isn't fully initialized

## Alternative: Check OneSignal Dashboard

1. Go to OneSignal Dashboard → Settings → Web Configuration
2. Make sure your site URL is correct
3. Check if there are any errors or warnings

