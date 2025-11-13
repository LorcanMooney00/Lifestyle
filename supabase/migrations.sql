-- ============================================
-- FEATURE MIGRATIONS
-- ============================================
-- This file contains all feature additions to the base schema
-- Run these after schema.sql

-- ============================================
-- GROUPS FEATURE
-- ============================================
-- Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Add group_id columns to existing tables
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    ALTER TABLE public.events ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notes') THEN
    ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'todos') THEN
    ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shopping_list_items') THEN
    ALTER TABLE public.shopping_list_items ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Helper function to safely check group membership
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_group_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id = COALESCE(p_user_id, auth.uid())
  );
END;
$$;

-- Groups policies (see create_groups.sql for full policy definitions)
-- Note: Full policies are in schema.sql, this is just the table structure

-- Function to automatically add creator as admin when group is created
CREATE OR REPLACE FUNCTION add_group_creator_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_group_creator_trigger ON public.groups;
CREATE TRIGGER add_group_creator_trigger
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION add_group_creator_as_admin();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_events_group_id ON public.events(group_id);
CREATE INDEX IF NOT EXISTS idx_notes_group_id ON public.notes(group_id);
CREATE INDEX IF NOT EXISTS idx_todos_group_id ON public.todos(group_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_group_id ON public.shopping_list_items(group_id);

-- ============================================
-- ROUTINES FEATURE
-- ============================================
CREATE TABLE IF NOT EXISTS public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  days_of_week JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.routine_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID REFERENCES public.routines(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'routine',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.routine_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID REFERENCES public.routines(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  completion_date DATE NOT NULL,
  completed_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(routine_id, user_id, completion_date)
);

-- Add days_of_week and category columns if they don't exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'routines') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'days_of_week') THEN
      ALTER TABLE public.routines ADD COLUMN days_of_week JSONB DEFAULT '[]'::jsonb;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'routine_items') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routine_items' AND column_name = 'category') THEN
      ALTER TABLE public.routine_items ADD COLUMN category TEXT DEFAULT 'routine';
    END IF;
  END IF;
END $$;

-- Indexes and triggers (see create_routines.sql for full setup)
CREATE INDEX IF NOT EXISTS idx_routines_user_id ON public.routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_items_routine_id ON public.routine_items(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_completions_routine_id ON public.routine_completions(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_completions_user_id ON public.routine_completions(user_id);

-- ============================================
-- TODOS FEATURE
-- ============================================
CREATE TABLE IF NOT EXISTS public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_user_id ON public.todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_partner_id ON public.todos(partner_id);
CREATE INDEX IF NOT EXISTS idx_todos_group_id ON public.todos(group_id);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON public.todos(completed);

-- ============================================
-- DOGS FEATURE
-- ============================================
CREATE TABLE IF NOT EXISTS public.dogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  meals_per_day INTEGER DEFAULT 2 CHECK (meals_per_day > 0),
  weight_per_meal NUMERIC(10,2),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dog_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id UUID REFERENCES public.dogs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  meal_date DATE NOT NULL,
  meal_index INTEGER NOT NULL CHECK (meal_index >= 0),
  completed BOOLEAN DEFAULT TRUE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dog_id, meal_date, meal_index)
);

CREATE INDEX IF NOT EXISTS idx_dogs_user_id ON public.dogs(user_id);
CREATE INDEX IF NOT EXISTS idx_dogs_partner_id ON public.dogs(partner_id);
CREATE INDEX IF NOT EXISTS idx_dog_meals_dog_id ON public.dog_meals(dog_id);
CREATE INDEX IF NOT EXISTS idx_dog_meals_meal_date ON public.dog_meals(meal_date);

-- ============================================
-- PHOTO ASSIGNMENTS FEATURE
-- ============================================
CREATE TABLE IF NOT EXISTS public.photo_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  widget_index INTEGER NOT NULL,
  photo_id UUID REFERENCES public.photos(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, widget_index)
);

CREATE INDEX IF NOT EXISTS idx_photo_assignments_user_widget 
  ON public.photo_assignments(user_id, widget_index);

-- ============================================
-- PROFILE PICTURE FEATURE
-- ============================================
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_profile_picture 
ON public.user_profiles(profile_picture_url) 
WHERE profile_picture_url IS NOT NULL;

-- Update get_partners_with_emails function to include profile_picture_url
DROP FUNCTION IF EXISTS get_partners_with_emails(UUID);
CREATE FUNCTION get_partners_with_emails(p_user_id UUID)
RETURNS TABLE(partner_id UUID, email TEXT, username TEXT, profile_picture_url TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.partner_id,
    au.email::TEXT,
    COALESCE(up.username, au.email::TEXT) as username,
    up.profile_picture_url
  FROM public.partner_links pl
  JOIN auth.users au ON au.id = pl.partner_id
  LEFT JOIN public.user_profiles up ON up.id = pl.partner_id
  WHERE pl.user_id = p_user_id;
END;
$$;

-- ============================================
-- PARTNER_ID TO EVENTS
-- ============================================
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES auth.users(id);

-- ============================================
-- TILE PREFERENCES
-- ============================================
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS tile_preferences JSONB DEFAULT '{"shared-notes": true, "calendar": true, "recipes": true, "photo-gallery": true, "shared-todos": true, "notifications": true}'::jsonb;

-- Note: RLS policies for all these tables are defined in schema.sql
-- This file only contains table structures and indexes

