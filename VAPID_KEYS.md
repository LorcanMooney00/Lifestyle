# VAPID Keys for Push Notifications

## Public Key (Safe to commit)
```
BK49yP6BmhAxqdqF9UOQaK5YKKVv19A14UZGSbQg--GhY4k1LJEFDQu0wGmPLyBBsroK29G1FTNQKphB7ZMH9c8
```

This key has been added to `.env` as `VITE_VAPID_PUBLIC_KEY`.

## Private Key (DO NOT COMMIT - Store in Supabase Edge Function Secrets)

**Important:** 
- The private key should be stored in Supabase Dashboard → Settings → Edge Functions → Secrets
- Add it as `VAPID_PRIVATE_KEY` (you have this key saved locally)
- Also add `VAPID_PUBLIC_KEY` (same as the public key above) and `VAPID_SUBJECT` (e.g., `mailto:your-email@example.com`)

## Next Steps

1. The public key is now in your `.env` file
2. When you deploy the Edge Function, add the private key to Supabase secrets
3. Run the SQL migration: `supabase/add_push_subscriptions.sql`
4. Deploy the Edge Function: `supabase/functions/send-push-notification/index.ts`

