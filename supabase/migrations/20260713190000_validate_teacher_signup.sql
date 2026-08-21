-- Check teacher invitation eligibility before creating an auth account.
-- The school code is already intentionally discoverable through the signup flow;
-- this returns only a yes/no answer for the supplied email and campus.

CREATE OR REPLACE FUNCTION public.validate_teacher_signup(p_code TEXT, p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := upper(trim(COALESCE(p_code, '')));
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
BEGIN
  IF v_code = '' OR v_email = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.school_invitations invitation
    JOIN public.schools school ON school.id = invitation.school_id
    WHERE upper(COALESCE(school.code, '')) = v_code
      AND lower(invitation.email) = v_email
      AND invitation.role = 'teacher'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_teacher_signup(TEXT, TEXT) TO anon, authenticated;
