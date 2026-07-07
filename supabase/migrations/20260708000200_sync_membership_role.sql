-- Create trigger function to synchronize memberships role after user profile update
CREATE OR REPLACE FUNCTION public.fn_sync_membership_role_after_profile_update()
RETURNS TRIGGER AS $$
DECLARE
  v_role public.school_role;
BEGIN
  -- Determine the matching school_role enum value
  IF NEW.role = 'teacher' OR NEW.account_type = 'teacher' THEN
    v_role := 'teacher'::public.school_role;
  ELSIF NEW.role = 'school_admin' OR NEW.account_type = 'school_admin' THEN
    v_role := 'org_admin'::public.school_role;
  ELSIF NEW.role = 'student' OR NEW.account_type = 'school_student' THEN
    v_role := 'student'::public.school_role;
  ELSE
    v_role := 'student'::public.school_role;
  END IF;

  -- Sync membership record if school_id is available
  IF NEW.school_id IS NOT NULL THEN
    INSERT INTO public.memberships (user_id, school_id, role, status)
    VALUES (NEW.id, NEW.school_id, v_role, 'active')
    ON CONFLICT (user_id, school_id) DO UPDATE 
    SET role = EXCLUDED.role;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to public.user_profiles
DROP TRIGGER IF EXISTS tr_sync_membership_role_after_profile_update ON public.user_profiles;
CREATE TRIGGER tr_sync_membership_role_after_profile_update
AFTER UPDATE OF role, account_type, school_id ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_membership_role_after_profile_update();
