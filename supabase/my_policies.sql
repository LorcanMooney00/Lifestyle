-- Update Storage Policies to Allow Partners to View Each Other's Profile Pictures
-- Run this in Supabase SQL Editor

-- Note: Storage policies are managed in the Supabase Dashboard, not via SQL
-- Go to: Storage → photos bucket → Policies

-- The SELECT policy (allows users to view their own files AND profile pictures)
(bucket_id = 'photos'::text) AND ((auth.uid()::text = (storage.foldername(name))[1]) OR (name LIKE '%/profile-%'))

-- The insert policy 
((bucket_id = 'photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))

-- The delete policy 
((bucket_id = 'photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))