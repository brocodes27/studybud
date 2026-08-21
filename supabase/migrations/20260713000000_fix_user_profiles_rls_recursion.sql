-- Fix 42P17 infinite recursion on user_profiles SELECT.
-- Cause: profiles_* policies queried class_members/classes, whose school-admin
-- policies re-query user_profiles under RLS.

CREATE OR REPLACE FUNCTION public.fn_can_select_user_profile(p_target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_target_id = auth.uid()
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
    );
$$;

REVOKE ALL ON FUNCTION public.fn_can_select_user_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_can_select_user_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS profiles_teacher_select ON public.user_profiles;
DROP POLICY IF EXISTS profiles_parent_select ON public.user_profiles;
DROP POLICY IF EXISTS profiles_school_member_select ON public.user_profiles;
DROP POLICY IF EXISTS profiles_related_select ON public.user_profiles;

CREATE POLICY profiles_related_select
  ON public.user_profiles FOR SELECT TO authenticated
  USING (public.fn_can_select_user_profile(id));

-- Avoid the same recursion from the other direction: classes/class_members
-- policies should not SELECT user_profiles under RLS.
DROP POLICY IF EXISTS "School admins can view classes in their school" ON public.classes;
CREATE POLICY "School admins can view classes in their school"
  ON public.classes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships admin
      JOIN public.memberships teacher ON teacher.school_id = admin.school_id
      WHERE admin.user_id = auth.uid()
        AND admin.status = 'active'
        AND admin.role IN ('org_admin', 'principal')
        AND teacher.user_id = public.classes.teacher_id
        AND teacher.status = 'active'
    )
  );

DROP POLICY IF EXISTS "School admins can view class memberships in their school" ON public.class_members;
CREATE POLICY "School admins can view class memberships in their school"
  ON public.class_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships admin
      JOIN public.memberships member ON member.school_id = admin.school_id
      WHERE admin.user_id = auth.uid()
        AND admin.status = 'active'
        AND admin.role IN ('org_admin', 'principal')
        AND (
          member.user_id = public.class_members.user_id
          OR EXISTS (
            SELECT 1 FROM public.classes c
            WHERE c.id = public.class_members.class_id
              AND c.teacher_id = member.user_id
          )
        )
        AND member.status = 'active'
    )
  );
