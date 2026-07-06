-- SECURITY DEFINER helpers to bypass RLS and avoid recursive calls
CREATE OR REPLACE FUNCTION public.fn_my_school_id()
RETURNS UUID
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (SELECT school_id FROM public.user_profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_my_role()
RETURNS TEXT
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (SELECT role FROM public.user_profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql;
