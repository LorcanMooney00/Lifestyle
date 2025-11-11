-- Database Schema for Lifestyle Shared Notes App
-- This is the clean schema file - use reset.sql to drop and recreate everything
-- Run this ONLY if you want to create tables without dropping existing ones first

-- ============================================
-- QUICK UPDATE: Run this SQL to update get_partners_with_emails function for username support
-- ============================================
-- Copy and paste this into Supabase SQL Editor:
/*
CREATE OR REPLACE FUNCTION get_partners_with_emails(p_user_id UUID)
RETURNS TABLE(partner_id UUID, email TEXT, username TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.partner_id,
    au.email::TEXT,
    COALESCE(up.username, au.email::TEXT) as username
  FROM public.partner_links pl
  JOIN auth.users au ON au.id = pl.partner_id
  LEFT JOIN public.user_profiles up ON up.id = pl.partner_id
  WHERE pl.user_id = p_user_id;
END;
$$;
*/

-- ============================================
-- QUICK UPDATE: Create shared todos table with RLS
-- ============================================
-- Copy and paste this into Supabase SQL Editor to add the shared to-do list:
/*
-- Step 1: Create todos table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create helpful indexes
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON public.todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_partner_id ON public.todos(partner_id);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON public.todos(completed);

-- Step 3: Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION set_todos_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_todos_updated_at_trigger ON public.todos;
CREATE TRIGGER set_todos_updated_at_trigger
BEFORE UPDATE ON public.todos
FOR EACH ROW
EXECUTE FUNCTION set_todos_updated_at();

-- Step 4: Enable row level security
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop any existing policies (safety)
DROP POLICY IF EXISTS "Users can view their todos" ON public.todos;
DROP POLICY IF EXISTS "Users can insert todos" ON public.todos;
DROP POLICY IF EXISTS "Users can update shared todos" ON public.todos;
DROP POLICY IF EXISTS "Users can delete shared todos" ON public.todos;

-- Step 6: Policies to keep todos private between partners
CREATE POLICY "Users can view their todos"
  ON public.todos FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.uid() = partner_id
  );

CREATE POLICY "Users can insert todos"
  ON public.todos FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (partner_id IS NULL OR are_partners(user_id, partner_id))
  );

CREATE POLICY "Users can update shared todos"
  ON public.todos FOR UPDATE
  USING (
    auth.uid() = user_id OR auth.uid() = partner_id
  )
  WITH CHECK (
    (auth.uid() = user_id AND (partner_id IS NULL OR are_partners(user_id, partner_id))) OR
    (auth.uid() = partner_id AND are_partners(user_id, partner_id))
  );

CREATE POLICY "Users can delete shared todos"
  ON public.todos FOR DELETE
  USING (
    auth.uid() = user_id OR auth.uid() = partner_id
  );
*/

-- ============================================
-- QUICK UPDATE: Add tile_preferences column to user_profiles
-- ============================================
-- Copy and paste this into Supabase SQL Editor if the column doesn't exist:
/*
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS tile_preferences JSONB DEFAULT '{"shared-notes": true, "calendar": true, "recipes": true, "photo-gallery": true, "shared-todos": true}'::jsonb;
*/

-- ============================================
-- QUICK UPDATE: Create photos table and add RLS policies
-- ============================================
-- Copy and paste this into Supabase SQL Editor to create photos table and set up RLS:
/*
-- Step 1: Create photos table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for photos table
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON public.photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON public.photos(created_at);

-- Step 3: CRITICAL - Enable RLS on photos table (must be done before creating policies)
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop ALL existing policies first (important to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own photos" ON public.photos CASCADE;
DROP POLICY IF EXISTS "Users can add their own photos" ON public.photos CASCADE;
DROP POLICY IF EXISTS "Users can delete their own photos" ON public.photos CASCADE;

-- Step 5: Create RLS policies for photos
-- These policies ensure users can only access their own photos
CREATE POLICY "Users can view their own photos"
  ON public.photos FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can add their own photos"
  ON public.photos FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own photos"
  ON public.photos FOR DELETE
  USING (user_id = auth.uid());

-- Step 6: CRITICAL - Create a function to insert photos (bypasses RLS issues)
-- This function MUST be created for photo uploads to work!
CREATE OR REPLACE FUNCTION insert_photo(
  p_user_id UUID,
  p_storage_path TEXT,
  p_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_photo_id UUID;
  v_result JSONB;
BEGIN
  -- Validate that the user_id matches the authenticated user
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'User ID does not match authenticated user';
  END IF;
  
  -- Insert the photo
  INSERT INTO public.photos (user_id, storage_path, url)
  VALUES (p_user_id, p_storage_path, p_url)
  RETURNING id INTO v_photo_id;
  
  -- Return the inserted photo as JSONB
  SELECT row_to_json(p.*)::jsonb INTO v_result
  FROM public.photos p
  WHERE p.id = v_photo_id;
  
  RETURN v_result;
END;
$$;

-- Step 7: Verify RLS is enabled and policies exist (should return 3 rows)
SELECT 
  tablename, 
  policyname, 
  cmd,
  CASE WHEN cmd = 'SELECT' THEN qual ELSE with_check END as policy_condition
FROM pg_policies 
WHERE tablename = 'photos'
ORDER BY cmd;

-- IMPORTANT: You also need to set up Storage bucket policies!
-- Go to Supabase Dashboard → Storage → photos bucket → Policies
-- Or run this SQL to create storage policies:
-- Note: Storage policies are managed differently - you need to use the Storage API or Dashboard
-- 
-- In Supabase Dashboard:
-- 1. Go to Storage → photos bucket
-- 2. Click "Policies" tab
-- 3. Click "New Policy"
-- 4. Create these policies:
--
-- Policy 1: "Allow authenticated users to upload"
--   Operation: INSERT
--   Policy definition: (bucket_id = 'photos'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
--
-- Policy 2: "Allow authenticated users to view their own files"
--   Operation: SELECT
--   Policy definition: (bucket_id = 'photos'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
--
-- Policy 3: "Allow authenticated users to delete their own files"
--   Operation: DELETE
--   Policy definition: (bucket_id = 'photos'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
*/

-- ============================================
-- QUICK UPDATE: Create shared shopping list with RLS
-- ============================================
-- Copy and paste this into Supabase SQL Editor to add the shopping list feature:
/*
CREATE TABLE IF NOT EXISTS public.shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity TEXT,
  notes TEXT,
  purchased BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_shopping_list_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_shopping_list_items_updated_at_trigger ON public.shopping_list_items;
CREATE TRIGGER set_shopping_list_items_updated_at_trigger
BEFORE UPDATE ON public.shopping_list_items
FOR EACH ROW
EXECUTE FUNCTION set_shopping_list_items_updated_at();

ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view shopping items" ON public.shopping_list_items;
DROP POLICY IF EXISTS "Users can insert shopping items" ON public.shopping_list_items;
DROP POLICY IF EXISTS "Users can update shopping items" ON public.shopping_list_items;
DROP POLICY IF EXISTS "Users can delete shopping items" ON public.shopping_list_items;

CREATE POLICY "Users can view shopping items"
  ON public.shopping_list_items FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.uid() = partner_id
  );

CREATE POLICY "Users can insert shopping items"
  ON public.shopping_list_items FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (partner_id IS NULL OR are_partners(user_id, partner_id))
  );

CREATE POLICY "Users can update shopping items"
  ON public.shopping_list_items FOR UPDATE
  USING (
    auth.uid() = user_id OR auth.uid() = partner_id
  )
  WITH CHECK (
    (auth.uid() = user_id AND (partner_id IS NULL OR are_partners(user_id, partner_id))) OR
    (auth.uid() = partner_id AND are_partners(user_id, partner_id))
  );

CREATE POLICY "Users can delete shopping items"
  ON public.shopping_list_items FOR DELETE
  USING (
    auth.uid() = user_id OR auth.uid() = partner_id
  );
*/

-- ============================================
-- QUICK UPDATE: Create shared dogs table with RLS
-- ============================================
-- Copy and paste this into Supabase SQL Editor to add the shared dog planner:
/*
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

CREATE OR REPLACE FUNCTION set_dogs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_dogs_updated_at_trigger ON public.dogs;
CREATE TRIGGER set_dogs_updated_at_trigger
BEFORE UPDATE ON public.dogs
FOR EACH ROW
EXECUTE FUNCTION set_dogs_updated_at();

ALTER TABLE public.dogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view dogs" ON public.dogs;
DROP POLICY IF EXISTS "Users can insert dogs" ON public.dogs;
DROP POLICY IF EXISTS "Users can update dogs" ON public.dogs;
DROP POLICY IF EXISTS "Users can delete dogs" ON public.dogs;

CREATE POLICY "Users can view dogs"
  ON public.dogs FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.uid() = partner_id
  );

CREATE POLICY "Users can insert dogs"
  ON public.dogs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (partner_id IS NULL OR are_partners(user_id, partner_id))
  );

CREATE POLICY "Users can update dogs"
  ON public.dogs FOR UPDATE
  USING (
    auth.uid() = user_id OR auth.uid() = partner_id
  )
  WITH CHECK (
    (auth.uid() = user_id AND (partner_id IS NULL OR are_partners(user_id, partner_id))) OR
    (auth.uid() = partner_id AND are_partners(user_id, partner_id))
  );

CREATE POLICY "Users can delete dogs"
  ON public.dogs FOR DELETE
  USING (
    auth.uid() = user_id OR auth.uid() = partner_id
  );
*/

-- ============================================
-- QUICK UPDATE: Run this SQL to enable partner notes sharing
-- ============================================
-- Copy and paste this section into Supabase SQL Editor to update existing database:
/*
-- Create the is_topic_member function (if it doesn't exist)
CREATE OR REPLACE FUNCTION is_topic_member(p_topic_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.topic_members
    WHERE topic_id = p_topic_id AND user_id = p_user_id
  );
$$;

-- Create the are_partners function
CREATE OR REPLACE FUNCTION are_partners(p_user_id UUID, p_partner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partner_links
    WHERE (user_id = p_user_id AND partner_id = p_partner_id)
    OR (user_id = p_partner_id AND partner_id = p_user_id)
  );
$$;

-- Update topics SELECT policy
DROP POLICY IF EXISTS "Users can view topics they own or are members of" ON public.topics CASCADE;
CREATE POLICY "Users can view topics they own or are members of"
  ON public.topics FOR SELECT
  USING (
    owner_id = auth.uid() OR
    is_topic_member(id, auth.uid()) OR
    are_partners(auth.uid(), owner_id)
  );

-- Update notes SELECT policy
-- Users can only see their own notes, or notes in topics they're explicitly members of
DROP POLICY IF EXISTS "Users can view notes for accessible topics" ON public.notes CASCADE;
CREATE POLICY "Users can view notes for accessible topics"
  ON public.notes FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = notes.topic_id
      AND (
        topics.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.topic_members
          WHERE topic_members.topic_id = topics.id
          AND topic_members.user_id = auth.uid()
        )
      )
    )
  );

-- Update notes INSERT policy
DROP POLICY IF EXISTS "Users can create notes in accessible topics" ON public.notes CASCADE;
CREATE POLICY "Users can create notes in accessible topics"
  ON public.notes FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = notes.topic_id
      AND (
        topics.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.topic_members
          WHERE topic_members.topic_id = topics.id
          AND topic_members.user_id = auth.uid()
          AND topic_members.role IN ('owner', 'editor')
        ) OR
        are_partners(auth.uid(), topics.owner_id)
      )
    )
  );

-- Update notes UPDATE policy
DROP POLICY IF EXISTS "Users can update notes in accessible topics" ON public.notes CASCADE;
CREATE POLICY "Users can update notes in accessible topics"
  ON public.notes FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = notes.topic_id
      AND (
        topics.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.topic_members
          WHERE topic_members.topic_id = topics.id
          AND topic_members.user_id = auth.uid()
          AND topic_members.role IN ('owner', 'editor')
        )
      )
    )
  );

-- Update notes DELETE policy
DROP POLICY IF EXISTS "Users can delete notes in accessible topics" ON public.notes CASCADE;
CREATE POLICY "Users can delete notes in accessible topics"
  ON public.notes FOR DELETE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = notes.topic_id
      AND (
        topics.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.topic_members
          WHERE topic_members.topic_id = topics.id
          AND topic_members.user_id = auth.uid()
          AND topic_members.role IN ('owner', 'editor')
        )
      )
    )
  );
*/
-- QUICK UPDATE: Add partner_id column to events table
--- ============================================
-- Copy and paste this into Supabase SQL Editor if the column doesn't exist:
-- ALTER TABLE public.events 
-- ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES auth.users(id);
-- ============================================
-- END QUICK UPDATE SECTION
-- ============================================

-- Add partner_id column to events table if it doesn't exist
-- This is safe to run even if the column already exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'events' 
    AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE public.events 
    ADD COLUMN partner_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Topics table
CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Topic members table (for sharing topics with partners)
CREATE TABLE IF NOT EXISTS public.topic_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('owner', 'editor', 'viewer')) NOT NULL DEFAULT 'editor',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic_id, user_id)
);

-- Notes table
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  content TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles table (for storing usernames)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  tile_preferences JSONB DEFAULT '{"shared-notes": true, "calendar": true, "recipes": true, "photo-gallery": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partner links table (for linking accounts)
CREATE TABLE IF NOT EXISTS public.partner_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, partner_id)
);

-- Events table (for calendar events)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  partner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recipes table
CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  prep_time INTEGER, -- minutes
  cook_time INTEGER, -- minutes
  servings INTEGER,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recipe ingredients table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE NOT NULL,
  ingredient_name TEXT NOT NULL,
  amount TEXT, -- e.g., "2 cups", "1 tsp", "to taste"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(recipe_id, ingredient_name)
);

-- User ingredients table (tracks what ingredients users have)
CREATE TABLE IF NOT EXISTS public.user_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ingredient_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ingredient_name)
);

-- Photos table (for photo gallery widget)
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_topics_owner_id ON public.topics(owner_id);
CREATE INDEX IF NOT EXISTS idx_topic_members_topic_id ON public.topic_members(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_members_user_id ON public.topic_members(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_topic_id ON public.notes(topic_id);
CREATE INDEX IF NOT EXISTS idx_partner_links_user_id ON public.partner_links(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_links_partner_id ON public.partner_links(partner_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events(created_by);
CREATE INDEX IF NOT EXISTS idx_recipes_title ON public.recipes(title);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON public.recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_name ON public.recipe_ingredients(ingredient_name);
CREATE INDEX IF NOT EXISTS idx_user_ingredients_user_id ON public.user_ingredients(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ingredients_ingredient_name ON public.user_ingredients(ingredient_name);
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON public.photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON public.photos(created_at);

-- Enable Row-Level Security on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Function to check if user is member of topic (bypasses RLS to avoid recursion)
-- Must be created before policies that use it
CREATE OR REPLACE FUNCTION is_topic_member(p_topic_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.topic_members
    WHERE topic_id = p_topic_id AND user_id = p_user_id
  );
$$;

-- Function to check if two users are partners (bypasses RLS)
CREATE OR REPLACE FUNCTION are_partners(p_user_id UUID, p_partner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partner_links
    WHERE (user_id = p_user_id AND partner_id = p_partner_id)
    OR (user_id = p_partner_id AND partner_id = p_user_id)
  );
$$;

-- User profiles policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles CASCADE;
CREATE POLICY "Users can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles CASCADE;
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles CASCADE;
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Topics policies
-- Use SECURITY DEFINER function to avoid RLS recursion
DROP POLICY IF EXISTS "Users can view topics they own or are members of" ON public.topics CASCADE;
CREATE POLICY "Users can view topics they own or are members of"
  ON public.topics FOR SELECT
  USING (
    owner_id = auth.uid() OR
    is_topic_member(id, auth.uid()) OR
    are_partners(auth.uid(), owner_id)
  );

DROP POLICY IF EXISTS "Users can create topics" ON public.topics CASCADE;
CREATE POLICY "Users can create topics"
  ON public.topics FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update topics they own" ON public.topics CASCADE;
CREATE POLICY "Users can update topics they own"
  ON public.topics FOR UPDATE
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete topics they own" ON public.topics CASCADE;
CREATE POLICY "Users can delete topics they own"
  ON public.topics FOR DELETE
  USING (owner_id = auth.uid());

-- Topic members policies (fixed to avoid recursion)
DROP POLICY IF EXISTS "Users can view topic members for accessible topics" ON public.topic_members CASCADE;
CREATE POLICY "Users can view topic members for accessible topics"
  ON public.topic_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = topic_members.topic_id
      AND topics.owner_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Topic owners can add members" ON public.topic_members CASCADE;
CREATE POLICY "Topic owners can add members"
  ON public.topic_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = topic_members.topic_id
      AND topics.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Topic owners can update members" ON public.topic_members CASCADE;
CREATE POLICY "Topic owners can update members"
  ON public.topic_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = topic_members.topic_id
      AND topics.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Topic owners can remove members" ON public.topic_members CASCADE;
CREATE POLICY "Topic owners can remove members"
  ON public.topic_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = topic_members.topic_id
      AND topics.owner_id = auth.uid()
    )
  );

-- Notes policies
-- Users can only see their own notes, or notes in topics they're explicitly members of
DROP POLICY IF EXISTS "Users can view notes for accessible topics" ON public.notes CASCADE;
CREATE POLICY "Users can view notes for accessible topics"
  ON public.notes FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = notes.topic_id
      AND (
        topics.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.topic_members
          WHERE topic_members.topic_id = topics.id
          AND topic_members.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can create notes in accessible topics" ON public.notes CASCADE;
CREATE POLICY "Users can create notes in accessible topics"
  ON public.notes FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = notes.topic_id
      AND (
        topics.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.topic_members
          WHERE topic_members.topic_id = topics.id
          AND topic_members.user_id = auth.uid()
          AND topic_members.role IN ('owner', 'editor')
        ) OR
        are_partners(auth.uid(), topics.owner_id)
      )
    )
  );

DROP POLICY IF EXISTS "Users can update notes in accessible topics" ON public.notes CASCADE;
CREATE POLICY "Users can update notes in accessible topics"
  ON public.notes FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = notes.topic_id
      AND (
        topics.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.topic_members
          WHERE topic_members.topic_id = topics.id
          AND topic_members.user_id = auth.uid()
          AND topic_members.role IN ('owner', 'editor')
        ) OR
        are_partners(auth.uid(), topics.owner_id)
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete notes in accessible topics" ON public.notes CASCADE;
CREATE POLICY "Users can delete notes in accessible topics"
  ON public.notes FOR DELETE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = notes.topic_id
      AND (
        topics.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.topic_members
          WHERE topic_members.topic_id = topics.id
          AND topic_members.user_id = auth.uid()
          AND topic_members.role IN ('owner', 'editor')
        ) OR
        are_partners(auth.uid(), topics.owner_id)
      )
    )
  );

-- Partner links policies
DROP POLICY IF EXISTS "Users can view their own partner links" ON public.partner_links CASCADE;
CREATE POLICY "Users can view their own partner links"
  ON public.partner_links FOR SELECT
  USING (user_id = auth.uid() OR partner_id = auth.uid());

DROP POLICY IF EXISTS "Users can create partner links" ON public.partner_links CASCADE;
CREATE POLICY "Users can create partner links"
  ON public.partner_links FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own partner links" ON public.partner_links CASCADE;
CREATE POLICY "Users can delete their own partner links"
  ON public.partner_links FOR DELETE
  USING (user_id = auth.uid() OR partner_id = auth.uid());

-- Events policies (shared between partners)
-- Note: This policy works with or without the partner_id column
-- If partner_id column doesn't exist yet, run: ALTER TABLE public.events ADD COLUMN partner_id UUID REFERENCES auth.users(id);
DROP POLICY IF EXISTS "Users can view shared events" ON public.events CASCADE;
CREATE POLICY "Users can view shared events"
  ON public.events FOR SELECT
  USING (
    -- User can see events they created
    created_by = auth.uid() OR
    -- User can see events created by their partners
    EXISTS (
      SELECT 1 FROM public.partner_links
      WHERE (
        (partner_links.user_id = auth.uid() AND partner_links.partner_id = events.created_by)
        OR (partner_links.partner_id = auth.uid() AND partner_links.user_id = events.created_by)
      )
    )
  );

DROP POLICY IF EXISTS "Users can create events" ON public.events CASCADE;
CREATE POLICY "Users can create events"
  ON public.events FOR INSERT
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update their own events" ON public.events CASCADE;
CREATE POLICY "Users can update their own events"
  ON public.events FOR UPDATE
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own events" ON public.events CASCADE;
CREATE POLICY "Users can delete their own events"
  ON public.events FOR DELETE
  USING (created_by = auth.uid());

-- Recipes policies (public recipes, anyone can view)
DROP POLICY IF EXISTS "Anyone can view recipes" ON public.recipes CASCADE;
CREATE POLICY "Anyone can view recipes"
  ON public.recipes FOR SELECT
  USING (true);

-- Recipe ingredients policies (public, anyone can view)
DROP POLICY IF EXISTS "Anyone can view recipe ingredients" ON public.recipe_ingredients CASCADE;
CREATE POLICY "Anyone can view recipe ingredients"
  ON public.recipe_ingredients FOR SELECT
  USING (true);

-- User ingredients policies (private to user)
DROP POLICY IF EXISTS "Users can view their own ingredients" ON public.user_ingredients CASCADE;
CREATE POLICY "Users can view their own ingredients"
  ON public.user_ingredients FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can add their own ingredients" ON public.user_ingredients CASCADE;
CREATE POLICY "Users can add their own ingredients"
  ON public.user_ingredients FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own ingredients" ON public.user_ingredients CASCADE;
CREATE POLICY "Users can delete their own ingredients"
  ON public.user_ingredients FOR DELETE
  USING (user_id = auth.uid());

-- Photos policies
DROP POLICY IF EXISTS "Users can view their own photos" ON public.photos CASCADE;
CREATE POLICY "Users can view their own photos"
  ON public.photos FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can add their own photos" ON public.photos CASCADE;
-- Temporarily allow any authenticated user to insert photos (we'll refine security later)
CREATE POLICY "Users can add their own photos"
  ON public.photos FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own photos" ON public.photos CASCADE;
CREATE POLICY "Users can delete their own photos"
  ON public.photos FOR DELETE
  USING (user_id = auth.uid());

-- Function to insert photos (bypasses RLS issues)
CREATE OR REPLACE FUNCTION insert_photo(
  p_user_id UUID,
  p_storage_path TEXT,
  p_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_photo_id UUID;
  v_result JSONB;
BEGIN
  -- Validate that the user_id matches the authenticated user
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'User ID does not match authenticated user';
  END IF;
  
  -- Insert the photo
  INSERT INTO public.photos (user_id, storage_path, url)
  VALUES (p_user_id, p_storage_path, p_url)
  RETURNING id INTO v_photo_id;
  
  -- Return the inserted photo as JSONB
  SELECT row_to_json(p.*)::jsonb INTO v_result
  FROM public.photos p
  WHERE p.id = v_photo_id;
  
  RETURN v_result;
END;
$$;

-- Trigger to automatically update updated_at on events
DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at on user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at on notes
DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get partners with emails and usernames
-- Drop the function first if it exists with a different signature
DROP FUNCTION IF EXISTS get_partners_with_emails(uuid);
CREATE OR REPLACE FUNCTION get_partners_with_emails(p_user_id UUID)
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
    up.profile_picture_url::TEXT
  FROM public.partner_links pl
  JOIN auth.users au ON au.id = pl.partner_id
  LEFT JOIN public.user_profiles up ON up.id = pl.partner_id
  WHERE pl.user_id = p_user_id;
END;
$$;

-- Function to link partners by email
CREATE OR REPLACE FUNCTION link_partner_by_email(
  p_user_id UUID,
  p_partner_email TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id UUID;
BEGIN
  -- Find partner user by email
  SELECT id INTO v_partner_id
  FROM auth.users
  WHERE email = p_partner_email;

  -- If partner not found, return false
  IF v_partner_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Prevent self-linking
  IF v_partner_id = p_user_id THEN
    RETURN FALSE;
  END IF;

  -- Create bidirectional links (ignore if already exists)
  INSERT INTO public.partner_links (user_id, partner_id)
  VALUES (p_user_id, v_partner_id)
  ON CONFLICT (user_id, partner_id) DO NOTHING;

  INSERT INTO public.partner_links (user_id, partner_id)
  VALUES (v_partner_id, p_user_id)
  ON CONFLICT (user_id, partner_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

-- Function to delete user account and all associated data
CREATE OR REPLACE FUNCTION delete_user_account(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete user's partner links (both directions)
  DELETE FROM public.partner_links 
  WHERE user_id = p_user_id OR partner_id = p_user_id;
  
  -- Delete user's topics (cascade will handle notes and topic_members)
  DELETE FROM public.topics WHERE owner_id = p_user_id;
  
  -- Delete user's events
  DELETE FROM public.events WHERE created_by = p_user_id;
  
  -- Delete user's ingredients
  DELETE FROM public.user_ingredients WHERE user_id = p_user_id;
  
  -- Delete user profile
  DELETE FROM public.user_profiles WHERE id = p_user_id;
  
  -- Delete the auth user account directly (SECURITY DEFINER allows this)
  DELETE FROM auth.users WHERE id = p_user_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE WARNING 'Error deleting user account: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Function to delete auth user when profile is deleted
CREATE OR REPLACE FUNCTION delete_auth_user_on_profile_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete the auth user account
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to delete auth user: %', SQLERRM;
    RETURN OLD;
END;
$$;

-- Trigger to automatically delete auth user when profile is deleted
DROP TRIGGER IF EXISTS trigger_delete_auth_user ON public.user_profiles;
CREATE TRIGGER trigger_delete_auth_user
  AFTER DELETE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION delete_auth_user_on_profile_delete();

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS tile_preferences JSONB DEFAULT '{"shared-notes": true, "calendar": true, "recipes": true, "photo-gallery": true}'::jsonb;

-- ============================================
-- TODOS TABLE
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

CREATE OR REPLACE FUNCTION set_todos_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_todos_updated_at_trigger ON public.todos;
CREATE TRIGGER set_todos_updated_at_trigger
BEFORE UPDATE ON public.todos
FOR EACH ROW
EXECUTE FUNCTION set_todos_updated_at();

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their todos" ON public.todos;
DROP POLICY IF EXISTS "Users can insert todos" ON public.todos;
DROP POLICY IF EXISTS "Users can update shared todos" ON public.todos;
DROP POLICY IF EXISTS "Users can delete shared todos" ON public.todos;

CREATE POLICY "Users can view their todos"
  ON public.todos FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.uid() = partner_id OR
    (
      group_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_members.group_id = todos.group_id
        AND group_members.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert todos"
  ON public.todos FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (
      (partner_id IS NULL AND group_id IS NULL) OR
      (partner_id IS NOT NULL AND are_partners(user_id, partner_id)) OR
      (group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_members.group_id = todos.group_id
        AND group_members.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can update shared todos"
  ON public.todos FOR UPDATE
  USING (
    auth.uid() = user_id OR
    auth.uid() = partner_id OR
    (
      group_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_members.group_id = todos.group_id
        AND group_members.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete shared todos"
  ON public.todos FOR DELETE
  USING (
    auth.uid() = user_id OR
    auth.uid() = partner_id OR
    (
      group_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_members.group_id = todos.group_id
        AND group_members.user_id = auth.uid()
      )
    )
  );

-- ============================================
-- SHOPPING ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity TEXT,
  notes TEXT,
  purchased BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopping_items_user_id ON public.shopping_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_partner_id ON public.shopping_items(partner_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_group_id ON public.shopping_items(group_id);

CREATE OR REPLACE FUNCTION set_shopping_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_shopping_items_updated_at_trigger ON public.shopping_items;
CREATE TRIGGER set_shopping_items_updated_at_trigger
BEFORE UPDATE ON public.shopping_items
FOR EACH ROW
EXECUTE FUNCTION set_shopping_items_updated_at();

ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view shopping items" ON public.shopping_items;
DROP POLICY IF EXISTS "Users can insert shopping items" ON public.shopping_items;
DROP POLICY IF EXISTS "Users can update shopping items" ON public.shopping_items;
DROP POLICY IF EXISTS "Users can delete shopping items" ON public.shopping_items;

CREATE POLICY "Users can view shopping items"
  ON public.shopping_items FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.uid() = partner_id OR
    (
      group_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_members.group_id = shopping_items.group_id
        AND group_members.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert shopping items"
  ON public.shopping_items FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (
      (partner_id IS NULL AND group_id IS NULL) OR
      (partner_id IS NOT NULL AND are_partners(user_id, partner_id)) OR
      (group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_members.group_id = shopping_items.group_id
        AND group_members.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can update shopping items"
  ON public.shopping_items FOR UPDATE
  USING (
    auth.uid() = user_id OR
    auth.uid() = partner_id OR
    (
      group_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_members.group_id = shopping_items.group_id
        AND group_members.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete shopping items"
  ON public.shopping_items FOR DELETE
  USING (
    auth.uid() = user_id OR
    auth.uid() = partner_id OR
    (
      group_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_members.group_id = shopping_items.group_id
        AND group_members.user_id = auth.uid()
      )
    )
  );

-- ============================================
-- DOGS TABLE
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

CREATE INDEX IF NOT EXISTS idx_dogs_user_id ON public.dogs(user_id);
CREATE INDEX IF NOT EXISTS idx_dogs_partner_id ON public.dogs(partner_id);

CREATE OR REPLACE FUNCTION set_dogs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_dogs_updated_at_trigger ON public.dogs;
CREATE TRIGGER set_dogs_updated_at_trigger
BEFORE UPDATE ON public.dogs
FOR EACH ROW
EXECUTE FUNCTION set_dogs_updated_at();

ALTER TABLE public.dogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view dogs" ON public.dogs;
DROP POLICY IF EXISTS "Users can insert dogs" ON public.dogs;
DROP POLICY IF EXISTS "Users can update dogs" ON public.dogs;
DROP POLICY IF EXISTS "Users can delete dogs" ON public.dogs;

CREATE POLICY "Users can view dogs"
  ON public.dogs FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.uid() = partner_id
  );

CREATE POLICY "Users can insert dogs"
  ON public.dogs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (partner_id IS NULL OR are_partners(user_id, partner_id))
  );

CREATE POLICY "Users can update dogs"
  ON public.dogs FOR UPDATE
  USING (
    auth.uid() = user_id OR auth.uid() = partner_id
  );

CREATE POLICY "Users can delete dogs"
  ON public.dogs FOR DELETE
  USING (
    auth.uid() = user_id OR auth.uid() = partner_id
  );

-- ============================================
-- DOG MEALS TABLE
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_dog_meals_dog_id ON public.dog_meals(dog_id);
CREATE INDEX IF NOT EXISTS idx_dog_meals_meal_date ON public.dog_meals(meal_date);
CREATE INDEX IF NOT EXISTS idx_dog_meals_dog_date ON public.dog_meals(dog_id, meal_date);

ALTER TABLE public.dog_meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view dog meals" ON public.dog_meals;
DROP POLICY IF EXISTS "Users can insert dog meals" ON public.dog_meals;
DROP POLICY IF EXISTS "Users can update dog meals" ON public.dog_meals;
DROP POLICY IF EXISTS "Users can delete dog meals" ON public.dog_meals;

CREATE POLICY "Users can view dog meals"
  ON public.dog_meals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dogs
      WHERE dogs.id = dog_meals.dog_id
      AND (dogs.user_id = auth.uid() OR dogs.partner_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert dog meals"
  ON public.dog_meals FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.dogs
      WHERE dogs.id = dog_meals.dog_id
      AND (dogs.user_id = auth.uid() OR dogs.partner_id = auth.uid())
    )
  );

CREATE POLICY "Users can update dog meals"
  ON public.dog_meals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.dogs
      WHERE dogs.id = dog_meals.dog_id
      AND (dogs.user_id = auth.uid() OR dogs.partner_id = auth.uid())
    )
  );

CREATE POLICY "Users can delete dog meals"
  ON public.dog_meals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.dogs
      WHERE dogs.id = dog_meals.dog_id
      AND (dogs.user_id = auth.uid() OR dogs.partner_id = auth.uid())
    )
  );

-- ============================================
-- PHOTO ASSIGNMENTS TABLE
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

ALTER TABLE public.photo_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own photo assignments" ON public.photo_assignments;
DROP POLICY IF EXISTS "Users can insert their own photo assignments" ON public.photo_assignments;
DROP POLICY IF EXISTS "Users can update their own photo assignments" ON public.photo_assignments;
DROP POLICY IF EXISTS "Users can delete their own photo assignments" ON public.photo_assignments;

CREATE POLICY "Users can view their own photo assignments"
  ON public.photo_assignments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own photo assignments"
  ON public.photo_assignments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own photo assignments"
  ON public.photo_assignments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photo assignments"
  ON public.photo_assignments FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_photo_assignment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_photo_assignment_timestamp_trigger ON public.photo_assignments;
CREATE TRIGGER update_photo_assignment_timestamp_trigger
BEFORE UPDATE ON public.photo_assignments
FOR EACH ROW
EXECUTE FUNCTION update_photo_assignment_timestamp();

-- ============================================
-- GROUPS AND GROUP MEMBERS TABLES
-- ============================================
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_events_group_id ON public.events(group_id);
CREATE INDEX IF NOT EXISTS idx_notes_group_id ON public.notes(group_id);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Groups policies
DROP POLICY IF EXISTS "Users can view groups they belong to" ON public.groups;
CREATE POLICY "Users can view groups they belong to"
  ON public.groups FOR SELECT
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
CREATE POLICY "Users can create groups"
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Group admins can update groups" ON public.groups;
CREATE POLICY "Group admins can update groups"
  ON public.groups FOR UPDATE
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Group creators can delete groups" ON public.groups;
CREATE POLICY "Group creators can delete groups"
  ON public.groups FOR DELETE
  USING (auth.uid() = created_by);

-- Group members policies
DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;
CREATE POLICY "Users can view group members"
  ON public.group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND (
        groups.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = groups.id
          AND gm.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Group admins can add members" ON public.group_members;
CREATE POLICY "Group admins can add members"
  ON public.group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND (
        groups.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = groups.id
          AND gm.user_id = auth.uid()
          AND gm.role = 'admin'
        )
      )
    )
  );

DROP POLICY IF EXISTS "Group admins can remove members" ON public.group_members;
CREATE POLICY "Group admins can remove members"
  ON public.group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND (
        groups.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = groups.id
          AND gm.user_id = auth.uid()
          AND gm.role = 'admin'
        )
      )
    )
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Group admins can update member roles" ON public.group_members;
CREATE POLICY "Group admins can update member roles"
  ON public.group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = auth.uid()
    )
  );

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

-- Add group_id columns to notes table
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;