-- Add OneSignal support to push_subscriptions table
-- This allows storing OneSignal player IDs alongside native Web Push subscriptions

ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_onesignal_player_id 
ON public.push_subscriptions(onesignal_player_id);

-- Ensure unique OneSignal player IDs per user
-- This allows one OneSignal subscription per user
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_id_onesignal_player_id_key 
ON public.push_subscriptions(user_id, onesignal_player_id) 
WHERE onesignal_player_id IS NOT NULL;

