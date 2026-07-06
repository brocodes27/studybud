-- 1. Create School Invitations Table
CREATE TABLE IF NOT EXISTS public.school_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
    grade_section_id UUID REFERENCES public.grade_sections(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (school_id, email)
);

-- 1.5 Create submissions storage bucket and policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow users to upload submissions" ON storage.objects;
CREATE POLICY "Allow users to upload submissions"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'submissions');

DROP POLICY IF EXISTS "Allow users to read submissions" ON storage.objects;
CREATE POLICY "Allow users to read submissions"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'submissions');

-- Enable RLS on invitations
ALTER TABLE public.school_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage invitations in their school" ON public.school_invitations;
CREATE POLICY "Admins can manage invitations in their school" ON public.school_invitations
    FOR ALL TO authenticated
    USING (
        school_id = public.fn_my_school_id() 
        AND public.fn_my_role() IN ('org_admin', 'principal')
    );

DROP POLICY IF EXISTS "Members can select invitations in their school" ON public.school_invitations;
CREATE POLICY "Members can select invitations in their school" ON public.school_invitations
    FOR SELECT TO authenticated
    USING (school_id = public.fn_my_school_id());

-- 2. Create Assignment Submissions Table (Gradebook)
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    submission_text TEXT,
    attachment_url TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    grade TEXT,
    feedback TEXT,
    graded_at TIMESTAMPTZ,
    graded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (assignment_id, student_id)
);

-- Enable RLS on submissions
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view and manage their own submissions" ON public.assignment_submissions;
CREATE POLICY "Students can view and manage their own submissions" ON public.assignment_submissions
    FOR ALL TO authenticated
    USING (student_id = auth.uid())
    WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can view and grade class submissions" ON public.assignment_submissions;
CREATE POLICY "Teachers can view and grade class submissions" ON public.assignment_submissions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.assignments a
            JOIN public.classes c ON c.id = a.class_id
            WHERE a.id = assignment_id
            AND c.teacher_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can view all submissions in their school" ON public.assignment_submissions;
CREATE POLICY "Admins can view all submissions in their school" ON public.assignment_submissions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.assignments a
            JOIN public.classes c ON c.id = a.class_id
            JOIN public.user_profiles p ON p.id = c.teacher_id
            WHERE a.id = assignment_id
            AND p.school_id = public.fn_my_school_id()
            AND public.fn_my_role() IN ('org_admin', 'principal')
        )
    );

-- 3. Create RPC helper to create school and admin atomically
CREATE OR REPLACE FUNCTION public.create_school_and_admin(
  p_school_name TEXT,
  p_school_code TEXT,
  p_school_domain TEXT,
  p_address TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_id UUID;
  v_result JSONB;
BEGIN
  -- Insert the school record
  INSERT INTO public.schools (name, school_code, domain, address)
  VALUES (p_school_name, p_school_code, p_school_domain, p_address)
  RETURNING id INTO v_school_id;

  -- Assign membership as org_admin
  INSERT INTO public.memberships (user_id, school_id, role, status)
  VALUES (auth.uid(), v_school_id, 'org_admin', 'active')
  ON CONFLICT (user_id, school_id) DO UPDATE SET role = 'org_admin';

  -- Update profile information
  UPDATE public.user_profiles
  SET school_id = v_school_id,
      account_type = 'school_admin'
  WHERE id = auth.uid();

  SELECT jsonb_build_object('success', true, 'school_id', v_school_id) INTO v_result;
  RETURN v_result;
END;
$$;

-- 4. Create trigger to claim school invitations on signup
CREATE OR REPLACE FUNCTION public.fn_claim_school_invitation_after_insert_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_invite RECORD;
  v_academic_year_id UUID;
BEGIN
  SELECT * INTO v_invite
  FROM public.school_invitations
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    -- Link profile
    UPDATE public.user_profiles
    SET school_id = v_invite.school_id,
        account_type = CASE WHEN v_invite.role = 'teacher' THEN 'teacher' ELSE 'school_student' END
    WHERE id = NEW.id;

    -- Link membership
    INSERT INTO public.memberships (user_id, school_id, role, status)
    VALUES (NEW.id, v_invite.school_id, v_invite.role::public.school_role, 'active')
    ON CONFLICT (user_id, school_id) DO UPDATE SET role = EXCLUDED.role;

    -- Set up teaching assignments if teacher invite
    IF v_invite.role = 'teacher' AND v_invite.grade_section_id IS NOT NULL AND v_invite.subject_id IS NOT NULL THEN
      SELECT id INTO v_academic_year_id
      FROM public.academic_years
      WHERE school_id = v_invite.school_id AND is_active = true
      LIMIT 1;

      IF v_academic_year_id IS NOT NULL THEN
        INSERT INTO public.teaching_assignments (teacher_id, section_id, subject_id, academic_year_id)
        VALUES (NEW.id, v_invite.grade_section_id, v_invite.subject_id, v_academic_year_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    -- Delete invitation record
    DELETE FROM public.school_invitations WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_claim_school_invitation_after_insert ON public.user_profiles;
CREATE TRIGGER tr_claim_school_invitation_after_insert
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_claim_school_invitation_after_insert_profile();

-- 5. Add RLS Policy for school administrators on interventions
DROP POLICY IF EXISTS interventions_select_admin ON public.interventions;
CREATE POLICY interventions_select_admin ON public.interventions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
        SELECT 1 FROM public.classes c
        JOIN public.user_profiles p ON p.id = c.teacher_id
        WHERE c.id = class_id
        AND p.school_id = public.fn_my_school_id()
        AND public.fn_my_role() IN ('org_admin', 'principal')
    )
  );
