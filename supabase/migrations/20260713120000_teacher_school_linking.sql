-- Teachers must be able to join a campus (by school code) and principals must be able
-- to link an existing teacher email into memberships (or invite if not signed up yet).

CREATE OR REPLACE FUNCTION public.join_school_as_teacher(p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_school_id UUID;
  v_school_name TEXT;
  v_email TEXT;
  v_code TEXT := upper(trim(COALESCE(p_code, '')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_code = '' THEN
    RAISE EXCEPTION 'Enter a school code';
  END IF;

  SELECT s.id, s.name INTO v_school_id, v_school_name
  FROM public.schools s
  WHERE upper(COALESCE(s.code, '')) = v_code
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'No school found for code %', v_code;
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = v_user_id
      AND school_id = v_school_id
      AND role = 'teacher'
      AND status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.school_invitations
    WHERE school_id = v_school_id
      AND lower(email) = v_email
      AND role = 'teacher'
  ) THEN
    RAISE EXCEPTION 'A school administrator must invite this email before teacher access is granted';
  END IF;

  INSERT INTO public.memberships (user_id, school_id, role, status)
  VALUES (v_user_id, v_school_id, 'teacher', 'active')
  ON CONFLICT (user_id, school_id) DO UPDATE
  SET role = 'teacher',
      status = 'active',
      updated_at = NOW();

  UPDATE public.user_profiles
  SET school_id = v_school_id,
      role = 'teacher',
      account_type = 'teacher',
      updated_at = NOW()
  WHERE id = v_user_id;

  DELETE FROM public.school_invitations
  WHERE school_id = v_school_id
    AND lower(email) = v_email
    AND role = 'teacher';

  RETURN jsonb_build_object(
    'success', true,
    'school_id', v_school_id,
    'school_name', v_school_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.link_teacher_to_school(p_school_id UUID, p_email TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_user_id UUID;
  v_full_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_email = '' OR v_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'Enter a valid teacher email';
  END IF;

  IF p_school_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  IF NOT (
    public.fn_is_platform_admin()
    OR public.fn_is_chain_admin_for_school(p_school_id)
    OR (
      public.fn_my_school_id() = p_school_id
      AND public.fn_my_role() IN ('org_admin', 'principal')
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed to add teachers to this school';
  END IF;

  SELECT id, full_name INTO v_user_id, v_full_name
  FROM public.user_profiles
  WHERE lower(email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = v_email
    LIMIT 1;
  END IF;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.memberships (user_id, school_id, role, status)
    VALUES (v_user_id, p_school_id, 'teacher', 'active')
    ON CONFLICT (user_id, school_id) DO UPDATE
    SET role = 'teacher',
        status = 'active',
        updated_at = NOW();

    UPDATE public.user_profiles
    SET school_id = p_school_id,
        role = 'teacher',
        account_type = 'teacher',
        updated_at = NOW()
    WHERE id = v_user_id;

    -- Drop stale invite if any
    DELETE FROM public.school_invitations
    WHERE school_id = p_school_id AND lower(email) = v_email;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'linked',
      'user_id', v_user_id,
      'email', v_email,
      'full_name', v_full_name
    );
  END IF;

  INSERT INTO public.school_invitations (school_id, email, role)
  VALUES (p_school_id, v_email, 'teacher')
  ON CONFLICT (school_id, email) DO UPDATE SET role = 'teacher';

  RETURN jsonb_build_object(
    'success', true,
    'status', 'invited',
    'email', v_email
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_school_teacher_roster(p_school_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.fn_can_access_school(p_school_id) THEN
    RAISE EXCEPTION 'Not allowed to view this school roster';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    COALESCE(p.full_name, '')::TEXT AS full_name,
    COALESCE(p.email, '')::TEXT AS email,
    'active'::TEXT AS status
  FROM public.memberships m
  LEFT JOIN public.user_profiles p ON p.id = m.user_id
  WHERE m.school_id = p_school_id
    AND m.role = 'teacher'
    AND m.status = 'active'
  ORDER BY COALESCE(p.full_name, p.email, m.user_id::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_school_as_teacher(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_teacher_to_school(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_school_teacher_roster(UUID) TO authenticated;

-- Improve public school code lookup (used by teacher signup/onboarding)
-- Must DROP first: return type changed from (id, name) to (id, name, code).
DROP FUNCTION IF EXISTS public.lookup_school_by_code(TEXT);
CREATE OR REPLACE FUNCTION public.lookup_school_by_code(p_code TEXT)
RETURNS TABLE (id UUID, name TEXT, code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.code
  FROM public.schools s
  WHERE upper(COALESCE(s.code, '')) = upper(trim(COALESCE(p_code, '')))
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_school_by_code(TEXT) TO authenticated, anon;
