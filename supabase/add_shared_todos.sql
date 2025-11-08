-- Shared To-Do List table and policies
-- Run this in Supabase SQL editor before deploying the feature

-- Create table
CREATE TABLE IF NOT EXISTS public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON public.todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_partner_id ON public.todos(partner_id);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON public.todos(completed);

-- Trigger to keep updated_at fresh
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

-- Enable RLS
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their todos" ON public.todos;
CREATE POLICY "Users can view their todos"
  ON public.todos FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.uid() = partner_id
  );

DROP POLICY IF EXISTS "Users can insert todos" ON public.todos;
CREATE POLICY "Users can insert todos"
  ON public.todos FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (partner_id IS NULL OR are_partners(user_id, partner_id))
  );

DROP POLICY IF EXISTS "Users can update shared todos" ON public.todos;
CREATE POLICY "Users can update shared todos"
  ON public.todos FOR UPDATE
  USING (
    auth.uid() = user_id OR auth.uid() = partner_id
  )
  WITH CHECK (
    (auth.uid() = user_id AND (partner_id IS NULL OR are_partners(user_id, partner_id))) OR
    (auth.uid() = partner_id AND are_partners(user_id, partner_id))
  );

DROP POLICY IF EXISTS "Users can delete shared todos" ON public.todos;
CREATE POLICY "Users can delete shared todos"
  ON public.todos FOR DELETE
  USING (
    auth.uid() = user_id OR auth.uid() = partner_id
  );

