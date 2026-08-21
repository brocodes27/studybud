-- School leaders are provisioned by an authorized higher-level account.
-- Public auth metadata must never grant teacher, principal, school-admin, or
-- chain-head access. Invitation triggers promote the freshly-created baseline
-- profile only when an authorized invitation exists.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    full_name,
    grade,
    school,
    school_id,
    email,
    role,
    account_type
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'grade', ''),
    COALESCE(NEW.raw_user_meta_data->>'school', ''),
    NULL,
    NEW.email,
    'student',
    'b2c_student'
  );

  RETURN NEW;
END;
$$;

-- Email confirmation can leave the browser without a session immediately after
-- signup. Claim the invitation in the profile trigger and use the already
-- validated school code only to select the intended authorized teacher invite.
CREATE OR REPLACE FUNCTION public.fn_claim_school_invitation_after_insert_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_academic_year_id UUID;
  v_membership_role public.school_role;
  v_account_type TEXT;
  v_requested_code TEXT;
  v_target_school_id TEXT;
BEGIN
  SELECT
    upper(trim(COALESCE(raw_user_meta_data->>'school_code', ''))),
    COALESCE(
      raw_app_meta_data->>'pending_provisioned_school_id',
      raw_user_meta_data->>'provisioned_school_id',
      ''
    )
  INTO v_requested_code, v_target_school_id
  FROM auth.users
  WHERE id = NEW.id;

  SELECT invitation.* INTO v_invite
  FROM public.school_invitations invitation
  JOIN public.schools school ON school.id = invitation.school_id
  WHERE lower(invitation.email) = lower(NEW.email)
    AND (
      (
        COALESCE(v_requested_code, '') <> ''
        AND invitation.role = 'teacher'
        AND upper(COALESCE(school.code, '')) = v_requested_code
      )
      OR (
        COALESCE(v_requested_code, '') = ''
        AND COALESCE(v_target_school_id, '') <> ''
        AND school.id::text = v_target_school_id
        AND invitation.role = 'org_admin'
      )
    )
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
    ON CONFLICT (user_id, school_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = 'active';

    IF v_invite.role = 'teacher'
      AND v_invite.grade_section_id IS NOT NULL
      AND v_invite.subject_id IS NOT NULL
    THEN
      SELECT id INTO v_academic_year_id
      FROM public.academic_years
      WHERE school_id = v_invite.school_id
        AND is_active = true
      LIMIT 1;

      IF v_academic_year_id IS NOT NULL THEN
        INSERT INTO public.teaching_assignments (
          teacher_id,
          section_id,
          subject_id,
          academic_year_id
        )
        VALUES (
          NEW.id,
          v_invite.grade_section_id,
          v_invite.subject_id,
          v_academic_year_id
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    DELETE FROM public.school_invitations WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Chain-head invitations are likewise bound to the chain selected by the
-- platform administrator. Never fall back to the oldest invitation by email.
CREATE OR REPLACE FUNCTION public.fn_claim_chain_invitation_after_insert_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_first_school UUID;
  v_target_chain_id TEXT;
BEGIN
  SELECT COALESCE(
    raw_app_meta_data->>'pending_provisioned_chain_id',
    raw_user_meta_data->>'provisioned_chain_id',
    ''
  )
  INTO v_target_chain_id
  FROM auth.users
  WHERE id = NEW.id;

  SELECT * INTO v_invite
  FROM public.chain_invitations
  WHERE lower(email) = lower(NEW.email)
    AND COALESCE(v_target_chain_id, '') <> ''
    AND chain_id::text = v_target_chain_id
  LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    INSERT INTO public.chain_memberships (user_id, chain_id, role, status)
    VALUES (NEW.id, v_invite.chain_id, v_invite.role, 'active')
    ON CONFLICT (user_id, chain_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = 'active';

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
$$;

-- Tighten the existing provisioning RPC inputs. Authorization remains enforced
-- by the chain/school tenancy checks in these RPCs.
CREATE OR REPLACE FUNCTION public.admin_invite_school_admin(p_school_id UUID, p_email TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
BEGIN
  IF NOT (
    public.fn_is_platform_admin()
    OR public.fn_is_chain_admin_for_school(p_school_id)
  ) THEN
    RAISE EXCEPTION 'Not allowed to invite principals for this school';
  END IF;

  IF p_school_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.schools WHERE id = p_school_id
  ) THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;

  INSERT INTO public.school_invitations (school_id, email, role)
  VALUES (p_school_id, v_email, 'org_admin')
  ON CONFLICT (school_id, email) DO UPDATE SET role = 'org_admin';

  RETURN jsonb_build_object('success', true, 'email', v_email);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_invite_chain_admin(p_chain_id UUID, p_email TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
BEGIN
  IF NOT public.fn_is_platform_admin() THEN
    RAISE EXCEPTION 'Only platform admins can invite chain heads';
  END IF;

  IF p_chain_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.school_chains WHERE id = p_chain_id
  ) THEN
    RAISE EXCEPTION 'Chain not found';
  END IF;

  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;

  INSERT INTO public.chain_invitations (chain_id, email, role)
  VALUES (p_chain_id, v_email, 'chain_admin')
  ON CONFLICT (chain_id, email) DO UPDATE SET role = 'chain_admin';

  RETURN jsonb_build_object('success', true, 'email', v_email);
END;
$$;

-- A sign-in may refresh auth state more than once. Accept only the single
-- tenant target placed in protected auth metadata by the provisioning function.
CREATE OR REPLACE FUNCTION public.claim_pending_invitations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID := auth.uid();
  v_invite RECORD;
  v_membership_role public.school_role;
  v_account_type TEXT;
  v_first_school UUID;
  v_academic_year_id UUID;
  v_target_school_id TEXT;
  v_target_chain_id TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    lower(COALESCE(profile.email, auth_user.email)),
    COALESCE(
      auth_user.raw_app_meta_data->>'pending_provisioned_school_id',
      auth_user.raw_user_meta_data->>'provisioned_school_id',
      ''
    ),
    COALESCE(
      auth_user.raw_app_meta_data->>'pending_provisioned_chain_id',
      auth_user.raw_user_meta_data->>'provisioned_chain_id',
      ''
    )
  INTO v_email, v_target_school_id, v_target_chain_id
  FROM auth.users auth_user
  LEFT JOIN public.user_profiles profile ON profile.id = auth_user.id
  WHERE auth_user.id = v_user_id;

  IF COALESCE(v_target_chain_id, '') <> '' THEN
    SELECT * INTO v_invite
    FROM public.chain_invitations
    WHERE lower(email) = v_email
      AND chain_id::text = v_target_chain_id
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF FOUND THEN
      INSERT INTO public.chain_memberships (user_id, chain_id, role, status)
      VALUES (v_user_id, v_invite.chain_id, v_invite.role, 'active')
      ON CONFLICT (user_id, chain_id) DO UPDATE
      SET role = EXCLUDED.role,
          status = 'active';

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

      RETURN jsonb_build_object(
        'school_invites_claimed', 0,
        'chain_invites_claimed', 1
      );
    END IF;
  END IF;

  IF COALESCE(v_target_school_id, '') <> '' THEN
    SELECT * INTO v_invite
    FROM public.school_invitations
    WHERE lower(email) = v_email
      AND school_id::text = v_target_school_id
      AND role = 'org_admin'
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF FOUND THEN
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

      INSERT INTO public.memberships (user_id, school_id, role, status)
      VALUES (v_user_id, v_invite.school_id, v_membership_role, 'active')
      ON CONFLICT (user_id, school_id) DO UPDATE
      SET role = EXCLUDED.role,
          status = 'active';

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
      WHERE id = v_user_id;

      IF v_invite.role = 'teacher'
        AND v_invite.grade_section_id IS NOT NULL
        AND v_invite.subject_id IS NOT NULL
      THEN
        SELECT id INTO v_academic_year_id
        FROM public.academic_years
        WHERE school_id = v_invite.school_id
          AND is_active = true
        LIMIT 1;

        IF v_academic_year_id IS NOT NULL THEN
          INSERT INTO public.teaching_assignments (
            teacher_id,
            section_id,
            subject_id,
            academic_year_id
          )
          VALUES (
            v_user_id,
            v_invite.grade_section_id,
            v_invite.subject_id,
            v_academic_year_id
          )
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;

      DELETE FROM public.school_invitations WHERE id = v_invite.id;

      RETURN jsonb_build_object(
        'school_invites_claimed', 1,
        'chain_invites_claimed', 0
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'school_invites_claimed', 0,
    'chain_invites_claimed', 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pending_invitations() TO authenticated;
