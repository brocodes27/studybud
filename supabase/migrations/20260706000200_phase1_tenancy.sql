-- 1. Create school_role enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'school_role') THEN
    CREATE TYPE public.school_role AS ENUM ('org_admin', 'principal', 'teacher', 'student', 'parent');
  END IF;
END $$;

-- 2. Create memberships table
CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    role public.school_role NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, school_id)
);

-- Enable RLS
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- 3. Create academic structure tables
CREATE TABLE IF NOT EXISTS public.academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS public.grade_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    grade TEXT NOT NULL,
    section TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (school_id, grade, section)
);

CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS public.teaching_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.grade_sections(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (teacher_id, section_id, subject_id, academic_year_id)
);

-- Enable RLS on academic structures
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teaching_assignments ENABLE ROW LEVEL SECURITY;

-- 4. Create school entitlements table
CREATE TABLE IF NOT EXISTS public.school_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE UNIQUE,
    plan TEXT NOT NULL DEFAULT 'pilot' CHECK (plan IN ('pilot', 'basic', 'premium', 'enterprise')),
    seat_count INTEGER NOT NULL DEFAULT 100,
    features TEXT[] NOT NULL DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.school_entitlements ENABLE ROW LEVEL SECURITY;

-- 5. Backfill existing school links from user_profiles to memberships
INSERT INTO public.memberships (user_id, school_id, role, status)
SELECT 
  id as user_id, 
  school_id,
  (CASE 
    WHEN role = 'teacher' OR account_type = 'teacher' THEN 'teacher'::public.school_role
    WHEN role = 'school_admin' OR account_type = 'school_admin' THEN 'org_admin'::public.school_role
    WHEN role = 'parent' OR account_type = 'parent' THEN 'parent'::public.school_role
    ELSE 'student'::public.school_role
  END) as role,
  'active' as status
FROM public.user_profiles
WHERE school_id IS NOT NULL
ON CONFLICT (user_id, school_id) DO NOTHING;

-- 6. Define/Override RLS Helper Functions to check memberships table
CREATE OR REPLACE FUNCTION public.fn_my_school_id()
RETURNS UUID
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (SELECT school_id FROM public.memberships WHERE user_id = auth.uid() AND status = 'active' LIMIT 1);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_my_role()
RETURNS TEXT
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (SELECT role::text FROM public.memberships WHERE user_id = auth.uid() AND status = 'active' LIMIT 1);
END;
$$ LANGUAGE plpgsql;

-- 7. Define RLS Policies for new tables

-- memberships
DROP POLICY IF EXISTS "Members can select memberships in their school" ON public.memberships;
CREATE POLICY "Members can select memberships in their school" ON public.memberships
    FOR SELECT TO authenticated
    USING (school_id = public.fn_my_school_id());

DROP POLICY IF EXISTS "Admins can manage memberships in their school" ON public.memberships;
CREATE POLICY "Admins can manage memberships in their school" ON public.memberships
    FOR ALL TO authenticated
    USING (
        school_id = public.fn_my_school_id() 
        AND public.fn_my_role() IN ('org_admin', 'principal')
    );

-- academic_years
DROP POLICY IF EXISTS "Members can select academic years in their school" ON public.academic_years;
CREATE POLICY "Members can select academic years in their school" ON public.academic_years
    FOR SELECT TO authenticated
    USING (school_id = public.fn_my_school_id());

DROP POLICY IF EXISTS "Admins can manage academic years in their school" ON public.academic_years;
CREATE POLICY "Admins can manage academic years in their school" ON public.academic_years
    FOR ALL TO authenticated
    USING (
        school_id = public.fn_my_school_id() 
        AND public.fn_my_role() IN ('org_admin', 'principal')
    );

-- grade_sections
DROP POLICY IF EXISTS "Members can select grade sections in their school" ON public.grade_sections;
CREATE POLICY "Members can select grade sections in their school" ON public.grade_sections
    FOR SELECT TO authenticated
    USING (school_id = public.fn_my_school_id());

DROP POLICY IF EXISTS "Admins can manage grade sections in their school" ON public.grade_sections;
CREATE POLICY "Admins can manage grade sections in their school" ON public.grade_sections
    FOR ALL TO authenticated
    USING (
        school_id = public.fn_my_school_id() 
        AND public.fn_my_role() IN ('org_admin', 'principal')
    );

-- subjects
DROP POLICY IF EXISTS "Members can select subjects in their school" ON public.subjects;
CREATE POLICY "Members can select subjects in their school" ON public.subjects
    FOR SELECT TO authenticated
    USING (school_id = public.fn_my_school_id());

DROP POLICY IF EXISTS "Admins can manage subjects in their school" ON public.subjects;
CREATE POLICY "Admins can manage subjects in their school" ON public.subjects
    FOR ALL TO authenticated
    USING (
        school_id = public.fn_my_school_id() 
        AND public.fn_my_role() IN ('org_admin', 'principal')
    );

-- teaching_assignments
DROP POLICY IF EXISTS "Members can select teaching assignments in their school" ON public.teaching_assignments;
CREATE POLICY "Members can select teaching assignments in their school" ON public.teaching_assignments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.grade_sections gs 
            WHERE gs.id = section_id AND gs.school_id = public.fn_my_school_id()
        )
    );

DROP POLICY IF EXISTS "Admins can manage teaching assignments in their school" ON public.teaching_assignments;
CREATE POLICY "Admins can manage teaching assignments in their school" ON public.teaching_assignments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.grade_sections gs 
            WHERE gs.id = section_id 
            AND gs.school_id = public.fn_my_school_id()
            AND public.fn_my_role() IN ('org_admin', 'principal')
        )
    );

-- school_entitlements
DROP POLICY IF EXISTS "Members can select school entitlements" ON public.school_entitlements;
CREATE POLICY "Members can select school entitlements" ON public.school_entitlements
    FOR SELECT TO authenticated
    USING (school_id = public.fn_my_school_id());

DROP POLICY IF EXISTS "Platform admins can manage entitlements" ON public.school_entitlements;
CREATE POLICY "Platform admins can manage entitlements" ON public.school_entitlements
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- 8. Update handle_new_user trigger function to insert into memberships
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

  -- Insert profile
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

  -- Create school membership link if school was identified
  IF v_school_id IS NOT NULL THEN
    INSERT INTO public.memberships (user_id, school_id, role, status)
    VALUES (
      NEW.id,
      v_school_id,
      (CASE 
        WHEN COALESCE(NEW.raw_user_meta_data->>'role','student') = 'teacher' OR COALESCE(NEW.raw_user_meta_data->>'account_type','') = 'teacher' THEN 'teacher'::public.school_role
        WHEN COALESCE(NEW.raw_user_meta_data->>'role','student') = 'school_admin' OR COALESCE(NEW.raw_user_meta_data->>'account_type','') = 'school_admin' THEN 'org_admin'::public.school_role
        WHEN COALESCE(NEW.raw_user_meta_data->>'role','student') = 'parent' OR COALESCE(NEW.raw_user_meta_data->>'account_type','') = 'parent' THEN 'parent'::public.school_role
        ELSE 'student'::public.school_role
      END),
      'active'
    )
    ON CONFLICT (user_id, school_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
