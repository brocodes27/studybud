-- Fix production RLS policy bugs without relying on edited historical migrations.

-- 1) Fix class_attendance_sessions policy to use class_members.user_id
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='class_attendance_sessions'
      AND policyname='attendance_sessions_teacher_select'
  ) THEN
    EXECUTE 'DROP POLICY attendance_sessions_teacher_select ON public.class_attendance_sessions';
  END IF;
END $$;
CREATE POLICY attendance_sessions_teacher_select
  ON public.class_attendance_sessions
  FOR SELECT
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.class_members cm
      WHERE cm.class_id = class_attendance_sessions.class_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.parent_student_links psl
      JOIN public.class_members cm
        ON cm.user_id = psl.student_user_id
      WHERE psl.parent_user_id = auth.uid()
        AND psl.status = 'active'
        AND cm.class_id = class_attendance_sessions.class_id
    )
  );
-- 2) Fix question_metadata admin insert policy to use public.user_profiles.is_admin (not public.profiles.role)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='question_metadata'
      AND policyname='qm_insert_admin'
  ) THEN
    EXECUTE 'DROP POLICY qm_insert_admin ON public.question_metadata';
  END IF;
END $$;
CREATE POLICY qm_insert_admin
  ON public.question_metadata
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND COALESCE(up.is_admin, false) = true
    )
  );
