-- ============================================
-- School Admin Support
-- ============================================

-- 1) Create schools table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Idempotent policy creation (PostgreSQL doesn't support CREATE POLICY IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schools' AND policyname = 'schools_select_all'
  ) THEN
    CREATE POLICY schools_select_all ON public.schools FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schools' AND policyname = 'schools_insert_admin'
  ) THEN
    CREATE POLICY schools_insert_admin ON public.schools FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- 2) Add school_id to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;

-- 3) Update account_type check to include school_admin
DO $$ BEGIN
  ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_account_type_check;
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_account_type_check
      CHECK (account_type IN ('b2c_student','school_student','teacher','parent','admin','school_admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4) Update handle_new_user trigger to support school_admin
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
DECLARE v_school_id UUID; v_school_name TEXT;
BEGIN
  v_school_name := NEW.raw_user_meta_data->>'school';
  -- Look up or create school if school name is provided
  IF v_school_name IS NOT NULL AND v_school_name != '' THEN
    SELECT id INTO v_school_id FROM public.schools WHERE name ILIKE v_school_name LIMIT 1;
    IF v_school_id IS NULL THEN
      INSERT INTO public.schools (name, code)
      VALUES (v_school_name, lower(regexp_replace(v_school_name, '[^a-zA-Z0-9]', '', 'g')) || '_' || substr(md5(random()::text), 1, 6))
      RETURNING id INTO v_school_id;
    END IF;
  END IF;

  INSERT INTO public.user_profiles (
    id, full_name, grade, school, school_id, email, role, account_type
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'grade',''),
    v_school_name,
    v_school_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role','student'),
    COALESCE(
      NEW.raw_user_meta_data->>'account_type',
      CASE
        WHEN COALESCE(NEW.raw_user_meta_data->>'role','student') = 'teacher' THEN 'teacher'
        WHEN COALESCE(NEW.raw_user_meta_data->>'role','student') = 'school_admin' THEN 'school_admin'
        ELSE 'b2c_student'
      END
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
