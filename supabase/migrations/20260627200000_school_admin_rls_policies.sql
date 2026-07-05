-- ============================================
-- School Admin RLS Policies
-- ============================================

-- 1) Enable school admins to view classes in their school
DROP POLICY IF EXISTS "School admins can view classes in their school" ON public.classes;
CREATE POLICY "School admins can view classes in their school"
    ON public.classes FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles admin
            JOIN public.user_profiles teacher ON teacher.school_id = admin.school_id
            WHERE admin.id = auth.uid()
            AND admin.account_type = 'school_admin'
            AND teacher.id = public.classes.teacher_id
        )
    );

-- 2) Enable school admins to view class memberships in their school
DROP POLICY IF EXISTS "School admins can view class memberships in their school" ON public.class_members;
CREATE POLICY "School admins can view class memberships in their school"
    ON public.class_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles admin
            JOIN public.user_profiles member ON member.school_id = admin.school_id
            WHERE admin.id = auth.uid()
            AND admin.account_type = 'school_admin'
            AND (
                member.id = public.class_members.user_id
                OR EXISTS (
                    SELECT 1 FROM public.classes c
                    WHERE c.id = public.class_members.class_id
                    AND c.teacher_id = member.id
                )
            )
        )
    );
