-- Temporarily disable the push notification trigger
-- Use this if pg_net extension can't be enabled or if you want to use webhooks instead

DROP TRIGGER IF EXISTS on_event_created_push ON public.events;

-- To re-enable later, run the trigger_push_notifications.sql file again

