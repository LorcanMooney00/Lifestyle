-- Create routines feature tables
-- This allows users to create daily routines and track completion
-- Routines can be scheduled for specific days of the week

-- ============================================
-- ROUTINES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  days_of_week JSONB DEFAULT '[]'::jsonb, -- Array of day numbers: 0=Sunday, 1=Monday, ..., 6=Saturday. Empty array = every day
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- If the table already exists, add the days_of_week column
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'routines') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'days_of_week') THEN
      ALTER TABLE public.routines ADD COLUMN days_of_week JSONB DEFAULT '[]'::jsonb;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_routines_user_id ON public.routines(user_id);

-- ============================================
-- ROUTINE ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.routine_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID REFERENCES public.routines(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'routine', -- 'fitness', 'work', 'food', 'routine' (default)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- If the table already exists, add the category column
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'routine_items') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routine_items' AND column_name = 'category') THEN
      ALTER TABLE public.routine_items ADD COLUMN category TEXT DEFAULT 'routine';
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_routine_items_routine_id ON public.routine_items(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_items_order ON public.routine_items(routine_id, order_index);

-- ============================================
-- ROUTINE COMPLETIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.routine_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID REFERENCES public.routines(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  completion_date DATE NOT NULL,
  completed_items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of routine_item IDs that were completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(routine_id, user_id, completion_date)
);

CREATE INDEX IF NOT EXISTS idx_routine_completions_routine_id ON public.routine_completions(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_completions_user_id ON public.routine_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_completions_date ON public.routine_completions(completion_date);
CREATE INDEX IF NOT EXISTS idx_routine_completions_unique ON public.routine_completions(routine_id, user_id, completion_date);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION set_routines_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_routines_updated_at_trigger ON public.routines;
CREATE TRIGGER set_routines_updated_at_trigger
BEFORE UPDATE ON public.routines
FOR EACH ROW
EXECUTE FUNCTION set_routines_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_completions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own routines" ON public.routines;
DROP POLICY IF EXISTS "Users can create routines" ON public.routines;
DROP POLICY IF EXISTS "Users can update their own routines" ON public.routines;
DROP POLICY IF EXISTS "Users can delete their own routines" ON public.routines;

DROP POLICY IF EXISTS "Users can view routine items" ON public.routine_items;
DROP POLICY IF EXISTS "Users can create routine items" ON public.routine_items;
DROP POLICY IF EXISTS "Users can update routine items" ON public.routine_items;
DROP POLICY IF EXISTS "Users can delete routine items" ON public.routine_items;

DROP POLICY IF EXISTS "Users can view their routine completions" ON public.routine_completions;
DROP POLICY IF EXISTS "Users can create routine completions" ON public.routine_completions;
DROP POLICY IF EXISTS "Users can update their routine completions" ON public.routine_completions;
DROP POLICY IF EXISTS "Users can delete their routine completions" ON public.routine_completions;

-- Routines policies
CREATE POLICY "Users can view their own routines"
  ON public.routines FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create routines"
  ON public.routines FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own routines"
  ON public.routines FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own routines"
  ON public.routines FOR DELETE
  USING (user_id = auth.uid());

-- Routine items policies (users can only access items for their own routines)
CREATE POLICY "Users can view routine items"
  ON public.routine_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.routines
      WHERE routines.id = routine_items.routine_id
      AND routines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create routine items"
  ON public.routine_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.routines
      WHERE routines.id = routine_items.routine_id
      AND routines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update routine items"
  ON public.routine_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.routines
      WHERE routines.id = routine_items.routine_id
      AND routines.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.routines
      WHERE routines.id = routine_items.routine_id
      AND routines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete routine items"
  ON public.routine_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.routines
      WHERE routines.id = routine_items.routine_id
      AND routines.user_id = auth.uid()
    )
  );

-- Routine completions policies
CREATE POLICY "Users can view their routine completions"
  ON public.routine_completions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create routine completions"
  ON public.routine_completions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.routines
      WHERE routines.id = routine_completions.routine_id
      AND routines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their routine completions"
  ON public.routine_completions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their routine completions"
  ON public.routine_completions FOR DELETE
  USING (user_id = auth.uid());

