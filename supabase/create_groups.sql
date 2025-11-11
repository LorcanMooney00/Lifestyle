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

-- Add group_id columns to existing tables (safely checking if tables exist)
DO $$ 
BEGIN
  -- Add group_id to events table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    ALTER TABLE public.events ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
  END IF;

  -- Add group_id to notes table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notes') THEN
    ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
  END IF;

  -- Add group_id to todos table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'todos') THEN
    ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
  END IF;

  -- Add group_id to shopping_list_items table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shopping_list_items') THEN
    ALTER TABLE public.shopping_list_items ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS on groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Enable RLS on group_members
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Helper function to safely check group membership without recursion
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

-- Groups policies
DROP POLICY IF EXISTS "Users can view groups they belong to" ON public.groups;
CREATE POLICY "Users can view groups they belong to"
  ON public.groups FOR SELECT
  USING (
    auth.uid() = created_by OR public.is_group_member(id)
  );

DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
CREATE POLICY "Users can create groups"
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Group admins can update groups" ON public.groups;
CREATE POLICY "Group admins can update groups"
  ON public.groups FOR UPDATE
  USING (
    auth.uid() = created_by
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
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = auth.uid()
    )
    OR public.is_group_member(group_members.group_id)
  );

DROP POLICY IF EXISTS "Group admins can add members" ON public.group_members;
CREATE POLICY "Group admins can add members"
  ON public.group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Group admins can remove members" ON public.group_members;
CREATE POLICY "Group admins can remove members"
  ON public.group_members FOR DELETE
  USING (
    user_id = auth.uid() OR -- Users can leave groups themselves
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = auth.uid()
    )
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

-- Update events policies to include groups (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    -- Drop old policies
    EXECUTE 'DROP POLICY IF EXISTS "Users can view shared events" ON public.events';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view events shared with groups" ON public.events';
    EXECUTE 'DROP POLICY IF EXISTS "Users can create events" ON public.events';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own events" ON public.events';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own events" ON public.events';
    EXECUTE 'DROP POLICY IF EXISTS "Users can create group events" ON public.events';
    
    -- Create comprehensive SELECT policy that includes partner AND group sharing
    EXECUTE 'CREATE POLICY "Users can view shared events"
      ON public.events FOR SELECT
      USING (
        created_by = auth.uid()
        OR partner_id = auth.uid()
        OR public.is_group_member(group_id)
        OR EXISTS (
          SELECT 1
          FROM public.partner_links
          WHERE (
            partner_links.user_id = auth.uid()
            AND partner_links.partner_id = events.created_by
          ) OR (
            partner_links.partner_id = auth.uid()
            AND partner_links.user_id = events.created_by
          )
        )
      )';

    EXECUTE 'CREATE POLICY "Users can create events"
      ON public.events FOR INSERT
      WITH CHECK (
        created_by = auth.uid()
        AND (group_id IS NULL OR public.is_group_member(group_id))
        AND (partner_id IS NULL OR group_id IS NULL)
      )';
      
    EXECUTE 'CREATE POLICY "Users can update their own events"
      ON public.events FOR UPDATE
      USING (created_by = auth.uid())';
      
    EXECUTE 'CREATE POLICY "Users can delete their own events"
      ON public.events FOR DELETE
      USING (created_by = auth.uid())';
  END IF;
END $$;

-- Update notes policies to include groups (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notes') THEN
    -- Drop old policies
    EXECUTE 'DROP POLICY IF EXISTS "Users can view notes for accessible topics" ON public.notes';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view notes shared with groups" ON public.notes';
    EXECUTE 'DROP POLICY IF EXISTS "Users can create notes in accessible topics" ON public.notes';
    EXECUTE 'DROP POLICY IF EXISTS "Users can create group notes" ON public.notes';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update notes in accessible topics" ON public.notes';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete notes in accessible topics" ON public.notes';
    
    -- Create comprehensive policies that include topics, partners, AND groups
    EXECUTE 'CREATE POLICY "Users can view notes for accessible topics"
      ON public.notes FOR SELECT
      USING (
        created_by = auth.uid() OR
        public.is_group_member(notes.group_id) OR
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
      )';

    EXECUTE 'CREATE POLICY "Users can create notes in accessible topics"
      ON public.notes FOR INSERT
      WITH CHECK (
        created_by = auth.uid() AND
        (
          (group_id IS NULL AND EXISTS (
            SELECT 1 FROM public.topics
            WHERE topics.id = notes.topic_id
            AND (
              topics.owner_id = auth.uid() OR
              EXISTS (
                SELECT 1 FROM public.topic_members
                WHERE topic_members.topic_id = topics.id
                AND topic_members.user_id = auth.uid()
                AND topic_members.role IN (''owner'', ''editor'')
              )
            )
          )) OR
          (group_id IS NOT NULL AND public.is_group_member(notes.group_id))
        )
      )';
      
    EXECUTE 'CREATE POLICY "Users can update notes in accessible topics"
      ON public.notes FOR UPDATE
      USING (
        created_by = auth.uid() OR
        public.is_group_member(notes.group_id) OR
        EXISTS (
          SELECT 1 FROM public.topics
          WHERE topics.id = notes.topic_id
          AND (
            topics.owner_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.topic_members
              WHERE topic_members.topic_id = topics.id
              AND topic_members.user_id = auth.uid()
              AND topic_members.role IN (''owner'', ''editor'')
            )
          )
        )
      )';
      
    EXECUTE 'CREATE POLICY "Users can delete notes in accessible topics"
      ON public.notes FOR DELETE
      USING (
        created_by = auth.uid() OR
        public.is_group_member(notes.group_id) OR
        EXISTS (
          SELECT 1 FROM public.topics
          WHERE topics.id = notes.topic_id
          AND (
            topics.owner_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.topic_members
              WHERE topic_members.topic_id = topics.id
              AND topic_members.user_id = auth.uid()
              AND topic_members.role IN (''owner'', ''editor'')
            )
          )
        )
      )';
  END IF;
END $$;

-- Update todos policies to include groups (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'todos') THEN
    -- Drop old policies
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their todos" ON public.todos';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view todos shared with groups" ON public.todos';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert todos" ON public.todos';
    EXECUTE 'DROP POLICY IF EXISTS "Users can create group todos" ON public.todos';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update shared todos" ON public.todos';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete shared todos" ON public.todos';
    
    -- Create comprehensive policies for user, partner, and group sharing
    EXECUTE 'CREATE POLICY "Users can view their todos"
      ON public.todos FOR SELECT
      USING (
        user_id = auth.uid()
        OR partner_id = auth.uid()
        OR public.is_group_member(group_id)
      )';

    EXECUTE 'CREATE POLICY "Users can insert todos"
      ON public.todos FOR INSERT
      WITH CHECK (
        user_id = auth.uid()
        AND (group_id IS NULL OR public.is_group_member(group_id))
        AND (partner_id IS NULL OR group_id IS NULL)
      )';
      
    EXECUTE 'CREATE POLICY "Users can update shared todos"
      ON public.todos FOR UPDATE
      USING (
        user_id = auth.uid()
        OR partner_id = auth.uid()
        OR public.is_group_member(group_id)
      )';
      
    EXECUTE 'CREATE POLICY "Users can delete shared todos"
      ON public.todos FOR DELETE
      USING (
        user_id = auth.uid()
        OR partner_id = auth.uid()
        OR public.is_group_member(group_id)
      )';
  END IF;
END $$;

-- Update shopping_list_items policies to include groups (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shopping_list_items') THEN
    -- Drop old policies
    EXECUTE 'DROP POLICY IF EXISTS "Users can view shopping items" ON public.shopping_list_items';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view shopping items shared with groups" ON public.shopping_list_items';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert shopping items" ON public.shopping_list_items';
    EXECUTE 'DROP POLICY IF EXISTS "Users can create group shopping items" ON public.shopping_list_items';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update shopping items" ON public.shopping_list_items';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete shopping items" ON public.shopping_list_items';
    
    -- Create comprehensive policies for user, partner, and group sharing
    EXECUTE 'CREATE POLICY "Users can view shopping items"
      ON public.shopping_list_items FOR SELECT
      USING (
        user_id = auth.uid()
        OR partner_id = auth.uid()
        OR public.is_group_member(group_id)
      )';

    EXECUTE 'CREATE POLICY "Users can insert shopping items"
      ON public.shopping_list_items FOR INSERT
      WITH CHECK (
        user_id = auth.uid()
        AND (group_id IS NULL OR public.is_group_member(group_id))
        AND (partner_id IS NULL OR group_id IS NULL)
      )';
      
    EXECUTE 'CREATE POLICY "Users can update shopping items"
      ON public.shopping_list_items FOR UPDATE
      USING (
        user_id = auth.uid()
        OR partner_id = auth.uid()
        OR public.is_group_member(group_id)
      )';
      
    EXECUTE 'CREATE POLICY "Users can delete shopping items"
      ON public.shopping_list_items FOR DELETE
      USING (
        user_id = auth.uid()
        OR partner_id = auth.uid()
        OR public.is_group_member(group_id)
      )';
  END IF;
END $$;

-- Create indexes for better performance (safely)
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    CREATE INDEX IF NOT EXISTS idx_events_group_id ON public.events(group_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notes') THEN
    CREATE INDEX IF NOT EXISTS idx_notes_group_id ON public.notes(group_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'todos') THEN
    CREATE INDEX IF NOT EXISTS idx_todos_group_id ON public.todos(group_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shopping_list_items') THEN
    CREATE INDEX IF NOT EXISTS idx_shopping_list_items_group_id ON public.shopping_list_items(group_id);
  END IF;
END $$;

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

