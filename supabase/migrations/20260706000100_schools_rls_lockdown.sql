-- 1) Remove public policies on schools
DROP POLICY IF EXISTS schools_select_all ON public.schools;
DROP POLICY IF EXISTS schools_insert_admin ON public.schools;

-- 2) Create secure SELECT policy using the helper function
CREATE POLICY "Users can view their own school" ON public.schools
    FOR SELECT TO authenticated
    USING (
        id = public.fn_my_school_id()
    );

-- Note: No INSERT policy means INSERTs are only allowed via service_role/super-admin.

-- 3) Create minimal public lookup RPC for join-by-code (marked SECURITY DEFINER to bypass schools SELECT RLS)
CREATE OR REPLACE FUNCTION public.lookup_school_by_code(p_code TEXT)
RETURNS TABLE (id UUID, name TEXT)
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name
  FROM public.schools s
  WHERE s.code = p_code;
END;
$$ LANGUAGE plpgsql;
