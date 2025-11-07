-- RESET SCRIPT: Drop everything and recreate from scratch
-- WARNING: This will delete all data in these tables!
-- Run this in Supabase SQL Editor

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
DROP POLICY IF EXISTS "Users can view notes for accessible topics" ON public.notes CASCADE;
CREATE POLICY "Users can view notes for accessible topics"
  ON public.notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = notes.topic_id
      AND (
        topics.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.topic_members
          WHERE topic_members.topic_id = topics.id
          AND topic_members.user_id = auth.uid()
        ) OR
        are_partners(auth.uid(), topics.owner_id)
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
        ) OR
        are_partners(auth.uid(), topics.owner_id)
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
        ) OR
        are_partners(auth.uid(), topics.owner_id)
      )
    )
  );
*/
-- ============================================
-- END QUICK UPDATE SECTION
-- ============================================

-- ============================================
-- PART 1: DROP EVERYTHING
-- ============================================

-- Drop tables first (CASCADE will automatically drop policies, triggers, and dependent objects)
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.user_ingredients CASCADE;
DROP TABLE IF EXISTS public.recipe_ingredients CASCADE;
DROP TABLE IF EXISTS public.recipes CASCADE;
DROP TABLE IF EXISTS public.notes CASCADE;
DROP TABLE IF EXISTS public.topic_members CASCADE;
DROP TABLE IF EXISTS public.topics CASCADE;
DROP TABLE IF EXISTS public.partner_links CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS is_topic_member(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS are_partners(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partners_with_emails(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS link_partner_by_email(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS delete_user_account(UUID) CASCADE;

-- ============================================
-- PART 2: CREATE EVERYTHING
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Topics table
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Topic members table (for sharing topics with partners)
CREATE TABLE public.topic_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('owner', 'editor', 'viewer')) NOT NULL DEFAULT 'editor',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic_id, user_id)
);

-- Notes table
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  content TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles table (for storing usernames)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partner links table (for linking accounts)
CREATE TABLE public.partner_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, partner_id)
);

-- Events table (for calendar events)
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recipes table
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  prep_time INTEGER,
  cook_time INTEGER,
  servings INTEGER,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recipe ingredients table (many-to-many relationship)
CREATE TABLE public.recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE NOT NULL,
  ingredient_name TEXT NOT NULL,
  amount TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(recipe_id, ingredient_name)
);

-- User ingredients table (tracks what ingredients users have)
CREATE TABLE public.user_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ingredient_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ingredient_name)
);

-- Create indexes for better performance
CREATE INDEX idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX idx_topics_owner_id ON public.topics(owner_id);
CREATE INDEX idx_topic_members_topic_id ON public.topic_members(topic_id);
CREATE INDEX idx_topic_members_user_id ON public.topic_members(user_id);
CREATE INDEX idx_notes_topic_id ON public.notes(topic_id);
CREATE INDEX idx_partner_links_user_id ON public.partner_links(user_id);
CREATE INDEX idx_partner_links_partner_id ON public.partner_links(partner_id);
CREATE INDEX idx_events_event_date ON public.events(event_date);
CREATE INDEX idx_events_created_by ON public.events(created_by);
CREATE INDEX idx_recipes_title ON public.recipes(title);
CREATE INDEX idx_recipe_ingredients_recipe_id ON public.recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient_name ON public.recipe_ingredients(ingredient_name);
CREATE INDEX idx_user_ingredients_user_id ON public.user_ingredients(user_id);
CREATE INDEX idx_user_ingredients_ingredient_name ON public.user_ingredients(ingredient_name);

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

-- ============================================
-- FUNCTIONS (must be created before policies)
-- ============================================

-- Function to check if user is member of topic (bypasses RLS to avoid recursion)
CREATE FUNCTION is_topic_member(p_topic_id UUID, p_user_id UUID)
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
CREATE FUNCTION are_partners(p_user_id UUID, p_partner_id UUID)
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

-- ============================================
-- ROW-LEVEL SECURITY POLICIES
-- ============================================

-- User profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Topics policies
-- Use SECURITY DEFINER function to avoid RLS recursion
CREATE POLICY "Users can view topics they own or are members of"
  ON public.topics FOR SELECT
  USING (
    owner_id = auth.uid() OR
    is_topic_member(id, auth.uid()) OR
    are_partners(auth.uid(), owner_id)
  );

CREATE POLICY "Users can create topics"
  ON public.topics FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update topics they own"
  ON public.topics FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete topics they own"
  ON public.topics FOR DELETE
  USING (owner_id = auth.uid());

-- Topic members policies (fixed to avoid recursion)
-- Only check topics.owner_id directly, don't use EXISTS on topics to avoid recursion
CREATE POLICY "Users can view topic members for accessible topics"
  ON public.topic_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = topic_members.topic_id
      AND topics.owner_id = auth.uid()
    )
  );

CREATE POLICY "Topic owners can add members"
  ON public.topic_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = topic_members.topic_id
      AND topics.owner_id = auth.uid()
    )
  );

CREATE POLICY "Topic owners can update members"
  ON public.topic_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = topic_members.topic_id
      AND topics.owner_id = auth.uid()
    )
  );

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
        )
      )
    )
  );

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

-- Partner links policies
CREATE POLICY "Users can view their own partner links"
  ON public.partner_links FOR SELECT
  USING (user_id = auth.uid() OR partner_id = auth.uid());

CREATE POLICY "Users can create partner links"
  ON public.partner_links FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own partner links"
  ON public.partner_links FOR DELETE
  USING (user_id = auth.uid() OR partner_id = auth.uid());

-- Events policies (shared between partners)
CREATE POLICY "Users can view shared events"
  ON public.events FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.partner_links
      WHERE (partner_links.user_id = auth.uid() AND partner_links.partner_id = events.created_by)
      OR (partner_links.partner_id = auth.uid() AND partner_links.user_id = events.created_by)
    )
  );

CREATE POLICY "Users can create events"
  ON public.events FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own events"
  ON public.events FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own events"
  ON public.events FOR DELETE
  USING (created_by = auth.uid());

-- Recipes policies (public recipes, anyone can view)
CREATE POLICY "Anyone can view recipes"
  ON public.recipes FOR SELECT
  USING (true);

-- Recipe ingredients policies (public, anyone can view)
CREATE POLICY "Anyone can view recipe ingredients"
  ON public.recipe_ingredients FOR SELECT
  USING (true);

-- User ingredients policies (private to user)
CREATE POLICY "Users can view their own ingredients"
  ON public.user_ingredients FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can add their own ingredients"
  ON public.user_ingredients FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own ingredients"
  ON public.user_ingredients FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to get partners with emails and usernames
CREATE FUNCTION get_partners_with_emails(p_user_id UUID)
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

-- Function to link partners by email
CREATE FUNCTION link_partner_by_email(
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
CREATE FUNCTION delete_user_account(p_user_id UUID)
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
  
  -- Delete user profile (this will trigger deletion of auth.users via trigger)
  DELETE FROM public.user_profiles WHERE id = p_user_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Function to delete auth user when profile is deleted
CREATE FUNCTION delete_auth_user_on_profile_delete()
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
CREATE TRIGGER trigger_delete_auth_user
  AFTER DELETE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION delete_auth_user_on_profile_delete();

-- Function to automatically update updated_at timestamp
CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on user_profiles
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at on notes
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at on events
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

