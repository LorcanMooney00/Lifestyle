-- Database Schema for Lifestyle Shared Notes App
-- This is the clean schema file - use reset.sql to drop and recreate everything
-- Run this ONLY if you want to create tables without dropping existing ones first

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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_topics_owner_id ON public.topics(owner_id);
CREATE INDEX IF NOT EXISTS idx_topic_members_topic_id ON public.topic_members(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_members_user_id ON public.topic_members(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_topic_id ON public.notes(topic_id);
CREATE INDEX IF NOT EXISTS idx_partner_links_user_id ON public.partner_links(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_links_partner_id ON public.partner_links(partner_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events(created_by);

-- Enable Row-Level Security on all tables
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

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

-- Topics policies
-- Use SECURITY DEFINER function to avoid RLS recursion
DROP POLICY IF EXISTS "Users can view topics they own or are members of" ON public.topics CASCADE;
CREATE POLICY "Users can view topics they own or are members of"
  ON public.topics FOR SELECT
  USING (
    owner_id = auth.uid() OR
    is_topic_member(id, auth.uid())
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
        )
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
        )
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
        )
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
DROP POLICY IF EXISTS "Users can view shared events" ON public.events CASCADE;
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

-- Function to check if user is member of topic (bypasses RLS to avoid recursion)
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

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on notes
DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at on events
DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
