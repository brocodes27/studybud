-- ============================================
-- School Admin Support
-- ============================================

-- 1) Create schools table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  domain TEXT UNIQUE,
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

-- 4) Update handle_new_user trigger to auto-link by email domain
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
DECLARE
  v_school_id UUID;
  v_school_name TEXT;
  v_domain TEXT;
  v_free_domains TEXT[] := ARRAY['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','mail.com','protonmail.com','yandex.com','zoho.com','aol.com','live.com','msn.com','qq.com','163.com','foxmail.com','rediffmail.com','ymail.com','rocketmail.com','gmx.com','gmx.net','mail.ru','bk.ru','inbox.ru','list.ru','rambler.ru','yandex.ru','ya.ru','tutanota.com','hey.com','fastmail.com','runbox.com','mailbox.org','disroot.org','riseup.net','cock.li','pm.me','proton.me'];
BEGIN
  v_school_name := NEW.raw_user_meta_data->>'school';
  v_domain := split_part(NEW.email, '@', 2);

  -- Auto-link by email domain for institutional emails (skip free providers)
  IF v_domain IS NOT NULL AND v_domain != '' AND NOT (v_domain = ANY(v_free_domains)) THEN
    SELECT id INTO v_school_id FROM public.schools WHERE domain = v_domain LIMIT 1;
    IF v_school_id IS NULL THEN
      INSERT INTO public.schools (name, code, domain)
      VALUES (
        COALESCE(NULLIF(v_school_name,''), v_domain),
        v_domain,
        v_domain
      )
      RETURNING id INTO v_school_id;
    END IF;
  END IF;

  INSERT INTO public.user_profiles (
    id, full_name, grade, school, school_id, email, role, account_type
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'grade',''),
    COALESCE(v_school_name, v_domain),
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
