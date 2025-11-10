-- Create photo_assignments table to persist widget assignments
CREATE TABLE IF NOT EXISTS public.photo_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  widget_index INTEGER NOT NULL,
  photo_id UUID REFERENCES public.photos(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, widget_index)
);

-- Enable RLS
ALTER TABLE public.photo_assignments ENABLE ROW LEVEL SECURITY;

-- Policies
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

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_photo_assignments_user_widget 
  ON public.photo_assignments(user_id, widget_index);

-- Trigger to update updated_at timestamp
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

