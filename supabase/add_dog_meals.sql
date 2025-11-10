-- ============================================
-- Create dog_meals table for tracking feeding status
-- ============================================
-- Copy and paste this into Supabase SQL Editor to add dog meal tracking:

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_dog_meals_dog_id ON public.dog_meals(dog_id);
CREATE INDEX IF NOT EXISTS idx_dog_meals_meal_date ON public.dog_meals(meal_date);
CREATE INDEX IF NOT EXISTS idx_dog_meals_dog_date ON public.dog_meals(dog_id, meal_date);

-- Enable Row-Level Security
ALTER TABLE public.dog_meals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view dog meals" ON public.dog_meals;
DROP POLICY IF EXISTS "Users can insert dog meals" ON public.dog_meals;
DROP POLICY IF EXISTS "Users can update dog meals" ON public.dog_meals;
DROP POLICY IF EXISTS "Users can delete dog meals" ON public.dog_meals;

-- Policies: Users can view/modify meals for dogs they own or share with partners
CREATE POLICY "Users can view dog meals"
  ON public.dog_meals FOR SELECT
  USING (
    -- Can view if they own the dog or are a partner
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
  )
  WITH CHECK (
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

