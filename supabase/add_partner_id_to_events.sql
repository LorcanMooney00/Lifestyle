-- Add partner_id column to events table
-- Run this in Supabase SQL Editor

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES auth.users(id);

