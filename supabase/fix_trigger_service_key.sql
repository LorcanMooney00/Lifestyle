-- Fix the trigger to use the service role key properly
-- The trigger needs access to the service role key to call the Edge Function

-- Option 1: Set the service role key as a database setting (temporary)
-- Get your service role key from: Supabase Dashboard → Settings → API → Service Role Key
-- Then run:
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE';

-- Option 2: Update the trigger function to get the key from a different source
-- Or better yet, use Database Webhooks which handle this automatically

-- For now, let's check if the trigger is even being called
-- Run this to see trigger execution:
SELECT * FROM pg_stat_user_functions WHERE funcname = 'notify_push_on_event';

