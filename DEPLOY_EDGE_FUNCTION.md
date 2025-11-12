# Deploy Edge Function for Push Notifications

## Step 1: Deploy the Function

1. On the Edge Functions page, click **"Deploy a new function"** or **"Open Editor"**
2. Name it: `send-push-notification`
3. Copy the entire code from `supabase/functions/send-push-notification/index.ts`
4. Paste it into the editor
5. Click **"Deploy"**

## Step 2: Set Secrets

After deploying, set these secrets:
1. Go to Edge Functions → Secrets
2. Add these three secrets:
   - `VAPID_PRIVATE_KEY` = `r5btv2c5d0jsxzgs6mxC8i86JJ_bAmTqbDBq9CXDJkg`
   - `VAPID_PUBLIC_KEY` = `BK49yP6BmhAxqdqF9UOQaK5YKKVv19A14UZGSbQg--GhY4k1LJEFDQu0wGmPLyBBsroK29G1FTNQKphB7ZMH9c8`
   - `VAPID_SUBJECT` = `mailto:your-email@example.com` (use your email)

## Step 3: Verify Deployment

1. Go back to Edge Functions
2. You should see `send-push-notification` in the list
3. Click on it to see details

## Step 4: Test

1. Click on `send-push-notification`
2. Look for "Invoke" or "Test" button
3. Use this test payload (replace YOUR_USER_ID):
```json
{
  "event_id": "test",
  "user_id": "YOUR_USER_ID",
  "title": "Test",
  "event_date": "2025-01-15",
  "created_by": "test"
}
```

