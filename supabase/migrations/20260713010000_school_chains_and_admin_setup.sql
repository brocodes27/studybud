-- School chains + platform/chain/school admin tenancy
-- Platform-first: only platform admins create chains/schools.

-- 1) Chains
CREATE TABLE IF NOT EXISTS public.school_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.school_chains ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS chain_id UUID REFERENCES public.school_chains(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schools_chain_id ON public.schools(chain_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chain_role') THEN
    CREATE TYPE public.chain_role AS ENUM ('chain_admin');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.chain_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain_id UUID NOT NULL REFERENCES public.school_chains(id) ON DELETE CASCADE,
  role public.chain_role NOT NULL DEFAULT 'chain_admin',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, chain_id)
);

ALTER TABLE public.chain_memberships ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chain_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL REFERENCES public.school_chains(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.chain_role NOT NULL DEFAULT 'chain_admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, email)
);

ALTER TABLE public.chain_invitations ENABLE ROW LEVEL SECURITY;

-- 2) Helpers
CREATE OR REPLACE FUNCTION public.fn_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND COALESCE(is_admin, false) = true
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_my_chain_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(chain_id),
    ARRAY[]::uuid[]
  )
  FROM public.chain_memberships
  WHERE user_id = auth.uid() AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.fn_can_access_school(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.fn_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.school_id = p_school_id
        AND m.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.schools s
      JOIN public.chain_memberships cm
        ON cm.chain_id = s.chain_id
       AND cm.user_id = auth.uid()
       AND cm.status = 'active'
      WHERE s.id = p_school_id
        AND s.chain_id IS NOT NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.fn_is_chain_admin_for_school(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.schools s
    JOIN public.chain_memberships cm
      ON cm.chain_id = s.chain_id
     AND cm.user_id = auth.uid()
     AND cm.status = 'active'
     AND cm.role = 'chain_admin'
    WHERE s.id = p_school_id
      AND s.chain_id IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.fn_is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_my_chain_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_can_access_school(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_is_chain_admin_for_school(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_my_chain_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_can_access_school(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_is_chain_admin_for_school(uuid) TO authenticated;

-- The selected campus is server-visible so RLS helpers and the UI use the same tenant.
CREATE TABLE IF NOT EXISTS public.user_active_school_context (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_active_school_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS active_school_context_self_select ON public.user_active_school_context;
CREATE POLICY active_school_context_self_select
  ON public.user_active_school_context FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_active_school_context(p_school_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_school_id IS NULL THEN
    DELETE FROM public.user_active_school_context WHERE user_id = auth.uid();
    RETURN;
  END IF;

  IF NOT public.fn_can_access_school(p_school_id) THEN
    RAISE EXCEPTION 'Not allowed to select this school';
  END IF;

  INSERT INTO public.user_active_school_context (user_id, school_id, updated_at)
  VALUES (auth.uid(), p_school_id, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET school_id = EXCLUDED.school_id,
      updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_my_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT context.school_id
      FROM public.user_active_school_context context
      WHERE context.user_id = auth.uid()
        AND public.fn_can_access_school(context.school_id)
      LIMIT 1
    ),
    (
      SELECT membership.school_id
      FROM public.memberships membership
      WHERE membership.user_id = auth.uid()
        AND membership.status = 'active'
      ORDER BY membership.created_at
      LIMIT 1
    )
  );
$$;

REVOKE ALL ON FUNCTION public.set_active_school_context(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_school_context(UUID) TO authenticated;

-- Extend profile visibility for chain admins (SECURITY DEFINER — no RLS recursion)
CREATE OR REPLACE FUNCTION public.fn_can_select_user_profile(p_target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_target_id = auth.uid()
    OR public.fn_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE (cm.user_id = p_target_id OR cm.student_id = p_target_id)
        AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.parent_student_links psl
      WHERE psl.parent_user_id = auth.uid()
        AND psl.student_user_id = p_target_id
        AND psl.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.memberships requester
      JOIN public.memberships target ON target.school_id = requester.school_id
      WHERE requester.user_id = auth.uid()
        AND requester.status = 'active'
        AND requester.role IN ('org_admin', 'principal')
        AND target.user_id = p_target_id
        AND target.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.memberships target
      JOIN public.schools s ON s.id = target.school_id
      JOIN public.chain_memberships cm
        ON cm.chain_id = s.chain_id
       AND cm.user_id = auth.uid()
       AND cm.status = 'active'
      WHERE target.user_id = p_target_id
        AND target.status = 'active'
        AND s.chain_id IS NOT NULL
    );
$$;

-- 3) RLS: chains
DROP POLICY IF EXISTS school_chains_select ON public.school_chains;
CREATE POLICY school_chains_select
  ON public.school_chains FOR SELECT TO authenticated
  USING (
    public.fn_is_platform_admin()
    OR id = ANY (public.fn_my_chain_ids())
  );

DROP POLICY IF EXISTS school_chains_manage ON public.school_chains;
CREATE POLICY school_chains_manage
  ON public.school_chains FOR ALL TO authenticated
  USING (public.fn_is_platform_admin())
  WITH CHECK (public.fn_is_platform_admin());

DROP POLICY IF EXISTS chain_memberships_select ON public.chain_memberships;
CREATE POLICY chain_memberships_select
  ON public.chain_memberships FOR SELECT TO authenticated
  USING (
    public.fn_is_platform_admin()
    OR user_id = auth.uid()
    OR chain_id = ANY (public.fn_my_chain_ids())
  );

DROP POLICY IF EXISTS chain_memberships_manage ON public.chain_memberships;
CREATE POLICY chain_memberships_manage
  ON public.chain_memberships FOR ALL TO authenticated
  USING (public.fn_is_platform_admin())
  WITH CHECK (public.fn_is_platform_admin());

DROP POLICY IF EXISTS chain_invitations_select ON public.chain_invitations;
CREATE POLICY chain_invitations_select
  ON public.chain_invitations FOR SELECT TO authenticated
  USING (
    public.fn_is_platform_admin()
    OR chain_id = ANY (public.fn_my_chain_ids())
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS chain_invitations_manage ON public.chain_invitations;
CREATE POLICY chain_invitations_manage
  ON public.chain_invitations FOR ALL TO authenticated
  USING (public.fn_is_platform_admin())
  WITH CHECK (public.fn_is_platform_admin());

-- 4) Schools access
DROP POLICY IF EXISTS "Users can view their own school" ON public.schools;
DROP POLICY IF EXISTS schools_select_accessible ON public.schools;
CREATE POLICY schools_select_accessible
  ON public.schools FOR SELECT TO authenticated
  USING (public.fn_can_access_school(id));

DROP POLICY IF EXISTS schools_manage_platform ON public.schools;
CREATE POLICY schools_manage_platform
  ON public.schools FOR ALL TO authenticated
  USING (public.fn_is_platform_admin())
  WITH CHECK (public.fn_is_platform_admin());

-- Entitlements
DROP POLICY IF EXISTS "Members can select school entitlements" ON public.school_entitlements;
DROP POLICY IF EXISTS "Platform admins can manage entitlements" ON public.school_entitlements;
DROP POLICY IF EXISTS school_entitlements_select ON public.school_entitlements;
CREATE POLICY school_entitlements_select
  ON public.school_entitlements FOR SELECT TO authenticated
  USING (public.fn_can_access_school(school_id));

DROP POLICY IF EXISTS school_entitlements_manage ON public.school_entitlements;
CREATE POLICY school_entitlements_manage
  ON public.school_entitlements FOR ALL TO authenticated
  USING (public.fn_is_platform_admin())
  WITH CHECK (public.fn_is_platform_admin());

-- Memberships: chain heads can see members across their campuses
DROP POLICY IF EXISTS "Members can select memberships in their school" ON public.memberships;
CREATE POLICY "Members can select memberships in their school" ON public.memberships
  FOR SELECT TO authenticated
  USING (public.fn_can_access_school(school_id));

DROP POLICY IF EXISTS "Admins can manage memberships in their school" ON public.memberships;
CREATE POLICY "Admins can manage memberships in their school" ON public.memberships
  FOR ALL TO authenticated
  USING (
    public.fn_is_platform_admin()
    OR public.fn_is_chain_admin_for_school(school_id)
    OR (
      school_id = public.fn_my_school_id()
      AND public.fn_my_role() IN ('org_admin', 'principal')
    )
  )
  WITH CHECK (
    public.fn_is_platform_admin()
    OR public.fn_is_chain_admin_for_school(school_id)
    OR (
      school_id = public.fn_my_school_id()
      AND public.fn_my_role() IN ('org_admin', 'principal')
    )
  );

-- Academic structure SELECT for chain access; manage for campus/chain/platform admins
DROP POLICY IF EXISTS "Members can select academic years in their school" ON public.academic_years;
CREATE POLICY "Members can select academic years in their school" ON public.academic_years
  FOR SELECT TO authenticated
  USING (public.fn_can_access_school(school_id));

DROP POLICY IF EXISTS "Admins can manage academic years in their school" ON public.academic_years;
CREATE POLICY "Admins can manage academic years in their school" ON public.academic_years
  FOR ALL TO authenticated
  USING (
    public.fn_is_platform_admin()
    OR public.fn_is_chain_admin_for_school(school_id)
    OR (
      school_id = public.fn_my_school_id()
      AND public.fn_my_role() IN ('org_admin', 'principal')
    )
  )
  WITH CHECK (
    public.fn_is_platform_admin()
    OR public.fn_is_chain_admin_for_school(school_id)
    OR (
      school_id = public.fn_my_school_id()
      AND public.fn_my_role() IN ('org_admin', 'principal')
    )
  );

DROP POLICY IF EXISTS "Members can select grade sections in their school" ON public.grade_sections;
CREATE POLICY "Members can select grade sections in their school" ON public.grade_sections
  FOR SELECT TO authenticated
  USING (public.fn_can_access_school(school_id));

DROP POLICY IF EXISTS "Admins can manage grade sections in their school" ON public.grade_sections;
CREATE POLICY "Admins can manage grade sections in their school" ON public.grade_sections
  FOR ALL TO authenticated
  USING (
    public.fn_is_platform_admin()
    OR public.fn_is_chain_admin_for_school(school_id)
    OR (
      school_id = public.fn_my_school_id()
      AND public.fn_my_role() IN ('org_admin', 'principal')
    )
  )
  WITH CHECK (
    public.fn_is_platform_admin()
    OR public.fn_is_chain_admin_for_school(school_id)
    OR (
      school_id = public.fn_my_school_id()
      AND public.fn_my_role() IN ('org_admin', 'principal')
    )
  );

DROP POLICY IF EXISTS "Members can select subjects in their school" ON public.subjects;
CREATE POLICY "Members can select subjects in their school" ON public.subjects
  FOR SELECT TO authenticated
  USING (public.fn_can_access_school(school_id));

DROP POLICY IF EXISTS "Admins can manage subjects in their school" ON public.subjects;
CREATE POLICY "Admins can manage subjects in their school" ON public.subjects
  FOR ALL TO authenticated
  USING (
    public.fn_is_platform_admin()
    OR public.fn_is_chain_admin_for_school(school_id)
    OR (
      school_id = public.fn_my_school_id()
      AND public.fn_my_role() IN ('org_admin', 'principal')
    )
  )
  WITH CHECK (
    public.fn_is_platform_admin()
    OR public.fn_is_chain_admin_for_school(school_id)
    OR (
      school_id = public.fn_my_school_id()
      AND public.fn_my_role() IN ('org_admin', 'principal')
    )
  );

-- Teaching assignments: section belongs to accessible school
DROP POLICY IF EXISTS "Members can select teaching assignments in their school" ON public.teaching_assignments;
CREATE POLICY "Members can select teaching assignments in their school" ON public.teaching_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.grade_sections gs
      WHERE gs.id = section_id AND public.fn_can_access_school(gs.school_id)
    )
  );

DROP POLICY IF EXISTS "Admins can manage teaching assignments in their school" ON public.teaching_assignments;
CREATE POLICY "Admins can manage teaching assignments in their school" ON public.teaching_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.grade_sections gs
      WHERE gs.id = section_id
        AND (
          public.fn_is_platform_admin()
          OR public.fn_is_chain_admin_for_school(gs.school_id)
          OR (
            gs.school_id = public.fn_my_school_id()
            AND public.fn_my_role() IN ('org_admin', 'principal')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grade_sections gs
      WHERE gs.id = section_id
        AND (
          public.fn_is_platform_admin()
          OR public.fn_is_chain_admin_for_school(gs.school_id)
          OR (
            gs.school_id = public.fn_my_school_id()
            AND public.fn_my_role() IN ('org_admin', 'principal')
          )
        )
    )
  );

-- Invitations: widen role + chain access
ALTER TABLE public.school_invitations DROP CONSTRAINT IF EXISTS school_invitations_role_check;
ALTER TABLE public.school_invitations
  ADD CONSTRAINT school_invitations_role_check
  CHECK (role IN ('teacher', 'student', 'org_admin'));

DROP POLICY IF EXISTS "Admins can manage invitations in their school" ON public.school_invitations;
CREATE POLICY "Admins can manage invitations in their school" ON public.school_invitations
  FOR ALL TO authenticated
  USING (
    public.fn_is_platform_admin()
    OR public.fn_is_chain_admin_for_school(school_id)
    OR (
      school_id = public.fn_my_school_id()
      AND public.fn_my_role() IN ('org_admin', 'principal')
    )
  )
  WITH CHECK (
    public.fn_is_platform_admin()
    OR public.fn_is_chain_admin_for_school(school_id)
    OR (
      school_id = public.fn_my_school_id()
      AND public.fn_my_role() IN ('org_admin', 'principal')
    )
  );

DROP POLICY IF EXISTS "Members can select invitations in their school" ON public.school_invitations;
CREATE POLICY "Members can select invitations in their school" ON public.school_invitations
  FOR SELECT TO authenticated
  USING (
    public.fn_can_access_school(school_id)
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- Claim school invitations (including org_admin)
CREATE OR REPLACE FUNCTION public.fn_claim_school_invitation_after_insert_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_invite RECORD;
  v_academic_year_id UUID;
  v_membership_role public.school_role;
  v_account_type TEXT;
BEGIN
  SELECT * INTO v_invite
  FROM public.school_invitations
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    IF v_invite.role = 'org_admin' THEN
      v_membership_role := 'org_admin'::public.school_role;
      v_account_type := 'school_admin';
    ELSIF v_invite.role = 'teacher' THEN
      v_membership_role := 'teacher'::public.school_role;
      v_account_type := 'teacher';
    ELSE
      v_membership_role := 'student'::public.school_role;
      v_account_type := 'school_student';
    END IF;

    UPDATE public.user_profiles
    SET school_id = v_invite.school_id,
        account_type = v_account_type,
        role = CASE
          WHEN v_invite.role = 'org_admin' THEN 'org_admin'
          WHEN v_invite.role = 'teacher' THEN 'teacher'
          ELSE 'student'
        END,
        onboarding_completed = CASE
          WHEN v_invite.role = 'org_admin' THEN true
          ELSE COALESCE(onboarding_completed, false)
        END
    WHERE id = NEW.id;

    INSERT INTO public.memberships (user_id, school_id, role, status)
    VALUES (NEW.id, v_invite.school_id, v_membership_role, 'active')
    ON CONFLICT (user_id, school_id) DO UPDATE SET role = EXCLUDED.role, status = 'active';

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

    DELETE FROM public.school_invitations WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Claim chain invitations
CREATE OR REPLACE FUNCTION public.fn_claim_chain_invitation_after_insert_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_invite RECORD;
  v_first_school UUID;
BEGIN
  SELECT * INTO v_invite
  FROM public.chain_invitations
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    INSERT INTO public.chain_memberships (user_id, chain_id, role, status)
    VALUES (NEW.id, v_invite.chain_id, v_invite.role, 'active')
    ON CONFLICT (user_id, chain_id) DO UPDATE SET role = EXCLUDED.role, status = 'active';

    SELECT id INTO v_first_school
    FROM public.schools
    WHERE chain_id = v_invite.chain_id
    ORDER BY created_at ASC NULLS LAST, name ASC
    LIMIT 1;

    UPDATE public.user_profiles
    SET account_type = 'school_admin',
        role = 'chain_admin',
        school_id = COALESCE(school_id, v_first_school),
        onboarding_completed = true
    WHERE id = NEW.id;

    DELETE FROM public.chain_invitations WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_claim_chain_invitation_after_insert ON public.user_profiles;
CREATE TRIGGER tr_claim_chain_invitation_after_insert
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_claim_chain_invitation_after_insert_profile();

-- Also claim for existing users who sign in after invite (idempotent helper)
CREATE OR REPLACE FUNCTION public.claim_pending_invitations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID := auth.uid();
  v_school_claimed INT := 0;
  v_chain_claimed INT := 0;
  v_invite RECORD;
  v_membership_role public.school_role;
  v_account_type TEXT;
  v_first_school UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM public.user_profiles WHERE id = v_user_id;
  IF v_email IS NULL OR v_email = '' THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  END IF;

  FOR v_invite IN
    SELECT * FROM public.school_invitations WHERE lower(email) = lower(v_email)
  LOOP
    IF v_invite.role = 'org_admin' THEN
      v_membership_role := 'org_admin'::public.school_role;
      v_account_type := 'school_admin';
    ELSIF v_invite.role = 'teacher' THEN
      v_membership_role := 'teacher'::public.school_role;
      v_account_type := 'teacher';
    ELSE
      v_membership_role := 'student'::public.school_role;
      v_account_type := 'school_student';
    END IF;

    UPDATE public.user_profiles
    SET school_id = v_invite.school_id,
        account_type = v_account_type,
        role = CASE
          WHEN v_invite.role = 'org_admin' THEN 'org_admin'
          WHEN v_invite.role = 'teacher' THEN 'teacher'
          ELSE 'student'
        END,
        onboarding_completed = CASE
          WHEN v_invite.role IN ('org_admin') THEN true
          ELSE onboarding_completed
        END
    WHERE id = v_user_id;

    INSERT INTO public.memberships (user_id, school_id, role, status)
    VALUES (v_user_id, v_invite.school_id, v_membership_role, 'active')
    ON CONFLICT (user_id, school_id) DO UPDATE SET role = EXCLUDED.role, status = 'active';

    DELETE FROM public.school_invitations WHERE id = v_invite.id;
    v_school_claimed := v_school_claimed + 1;
  END LOOP;

  FOR v_invite IN
    SELECT * FROM public.chain_invitations WHERE lower(email) = lower(v_email)
  LOOP
    INSERT INTO public.chain_memberships (user_id, chain_id, role, status)
    VALUES (v_user_id, v_invite.chain_id, v_invite.role, 'active')
    ON CONFLICT (user_id, chain_id) DO UPDATE SET role = EXCLUDED.role, status = 'active';

    SELECT id INTO v_first_school
    FROM public.schools
    WHERE chain_id = v_invite.chain_id
    ORDER BY created_at ASC NULLS LAST, name ASC
    LIMIT 1;

    UPDATE public.user_profiles
    SET account_type = 'school_admin',
        role = 'chain_admin',
        school_id = COALESCE(school_id, v_first_school),
        onboarding_completed = true
    WHERE id = v_user_id;

    DELETE FROM public.chain_invitations WHERE id = v_invite.id;
    v_chain_claimed := v_chain_claimed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'school_invites_claimed', v_school_claimed,
    'chain_invites_claimed', v_chain_claimed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pending_invitations() TO authenticated;

-- 5) Platform RPCs
CREATE OR REPLACE FUNCTION public.admin_create_school_chain(p_name TEXT, p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.fn_is_platform_admin() THEN
    RAISE EXCEPTION 'Only platform admins can create school chains';
  END IF;

  INSERT INTO public.school_chains (name, code)
  VALUES (trim(p_name), upper(trim(p_code)))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'chain_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_school(
  p_name TEXT,
  p_code TEXT,
  p_domain TEXT,
  p_chain_id UUID,
  p_plan TEXT DEFAULT 'pilot',
  p_seat_count INTEGER DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_plan TEXT := COALESCE(NULLIF(trim(p_plan), ''), 'pilot');
BEGIN
  IF NOT public.fn_is_platform_admin() THEN
    RAISE EXCEPTION 'Only platform admins can create schools';
  END IF;

  IF v_plan NOT IN ('pilot', 'basic', 'premium', 'enterprise') THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;

  IF p_chain_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.school_chains WHERE id = p_chain_id) THEN
    RAISE EXCEPTION 'Chain not found';
  END IF;

  INSERT INTO public.schools (name, code, domain, chain_id)
  VALUES (trim(p_name), NULLIF(upper(trim(p_code)), ''), NULLIF(lower(trim(p_domain)), ''), p_chain_id)
  RETURNING id INTO v_id;

  INSERT INTO public.school_entitlements (school_id, plan, seat_count)
  VALUES (v_id, v_plan, GREATEST(COALESCE(p_seat_count, 100), 1))
  ON CONFLICT (school_id) DO UPDATE
  SET plan = EXCLUDED.plan,
      seat_count = EXCLUDED.seat_count,
      updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'school_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_invite_chain_admin(p_chain_id UUID, p_email TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
BEGIN
  IF NOT public.fn_is_platform_admin() THEN
    RAISE EXCEPTION 'Only platform admins can invite chain heads';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.school_chains WHERE id = p_chain_id) THEN
    RAISE EXCEPTION 'Chain not found';
  END IF;

  INSERT INTO public.chain_invitations (chain_id, email, role)
  VALUES (p_chain_id, v_email, 'chain_admin')
  ON CONFLICT (chain_id, email) DO UPDATE SET role = 'chain_admin';

  RETURN jsonb_build_object('success', true, 'email', v_email);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_invite_school_admin(p_school_id UUID, p_email TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
BEGIN
  IF NOT (
    public.fn_is_platform_admin()
    OR public.fn_is_chain_admin_for_school(p_school_id)
  ) THEN
    RAISE EXCEPTION 'Not allowed to invite school admins for this school';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  INSERT INTO public.school_invitations (school_id, email, role)
  VALUES (p_school_id, v_email, 'org_admin')
  ON CONFLICT (school_id, email) DO UPDATE SET role = 'org_admin';

  RETURN jsonb_build_object('success', true, 'email', v_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_school_chain(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_school(TEXT, TEXT, TEXT, UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_invite_chain_admin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_invite_school_admin(UUID, TEXT) TO authenticated;

-- Chain-aware metrics select (additive policies)
DROP POLICY IF EXISTS learning_metrics_chain_select ON public.learning_session_metrics;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'learning_session_metrics'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY learning_metrics_chain_select
        ON public.learning_session_metrics FOR SELECT TO authenticated
        USING (
          public.fn_is_platform_admin()
          OR EXISTS (
            SELECT 1
            FROM public.memberships student
            WHERE student.user_id = learning_session_metrics.user_id
              AND student.status = 'active'
              AND public.fn_is_chain_admin_for_school(student.school_id)
          )
        )
    $policy$;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
