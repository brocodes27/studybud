-- Materialize classroom rows from teaching_assignments so teachers see assigned workspaces.
-- Principals cannot INSERT into classes for another teacher under existing RLS, so helpers are DEFINER.

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS teaching_assignment_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'classes_teaching_assignment_id_key'
  ) THEN
    ALTER TABLE public.classes
      ADD CONSTRAINT classes_teaching_assignment_id_key UNIQUE (teaching_assignment_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'classes'
      AND constraint_name = 'classes_teaching_assignment_id_fkey'
  ) THEN
    ALTER TABLE public.classes
      ADD CONSTRAINT classes_teaching_assignment_id_fkey
      FOREIGN KEY (teaching_assignment_id)
      REFERENCES public.teaching_assignments(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_class_for_teaching_assignment(p_assignment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment RECORD;
  v_grade TEXT;
  v_section TEXT;
  v_subject TEXT;
  v_class_id UUID;
  v_class_name TEXT;
  v_class_code TEXT;
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT ta.*
  INTO v_assignment
  FROM public.teaching_assignments ta
  WHERE ta.id = p_assignment_id;

  IF v_assignment.id IS NULL THEN
    RAISE EXCEPTION 'Teaching assignment not found';
  END IF;

  IF NOT (
    v_caller = v_assignment.teacher_id
    OR public.fn_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.grade_sections gs
      WHERE gs.id = v_assignment.section_id
        AND (
          public.fn_is_chain_admin_for_school(gs.school_id)
          OR (
            public.fn_my_school_id() = gs.school_id
            AND public.fn_my_role() IN ('org_admin', 'principal')
          )
        )
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed to create class for this assignment';
  END IF;

  SELECT id INTO v_class_id
  FROM public.classes
  WHERE teaching_assignment_id = p_assignment_id
  LIMIT 1;

  IF v_class_id IS NOT NULL THEN
    RETURN v_class_id;
  END IF;

  SELECT gs.grade, gs.section, s.name
  INTO v_grade, v_section, v_subject
  FROM public.grade_sections gs
  JOIN public.subjects s ON s.id = v_assignment.subject_id
  WHERE gs.id = v_assignment.section_id;

  v_class_name := format(
    'Grade %s-%s · %s',
    COALESCE(v_grade, '?'),
    COALESCE(v_section, '?'),
    COALESCE(v_subject, 'Subject')
  );
  v_class_code := upper(substr(replace(p_assignment_id::text, '-', ''), 1, 8));

  IF EXISTS (SELECT 1 FROM public.classes WHERE class_code = v_class_code) THEN
    v_class_code := v_class_code || substr(md5(p_assignment_id::text), 1, 4);
  END IF;

  SELECT id INTO v_class_id
  FROM public.classes
  WHERE teacher_id = v_assignment.teacher_id
    AND name = v_class_name
  LIMIT 1;

  IF v_class_id IS NOT NULL THEN
    UPDATE public.classes
    SET teaching_assignment_id = p_assignment_id,
        subject = COALESCE(subject, lower(COALESCE(v_subject, 'general')))
    WHERE id = v_class_id;
    RETURN v_class_id;
  END IF;

  INSERT INTO public.classes (teacher_id, name, subject, class_code, teaching_assignment_id)
  VALUES (
    v_assignment.teacher_id,
    v_class_name,
    lower(COALESCE(v_subject, 'general')),
    v_class_code,
    p_assignment_id
  )
  RETURNING id INTO v_class_id;

  RETURN v_class_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_teacher_classes_from_assignments(p_teacher_id UUID DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher UUID := COALESCE(p_teacher_id, auth.uid());
  v_caller UUID := auth.uid();
  v_assignment RECORD;
  v_created INT := 0;
  v_class_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'Teacher id required';
  END IF;

  IF NOT (
    v_caller = v_teacher
    OR public.fn_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = v_teacher
        AND m.status = 'active'
        AND (
          public.fn_is_chain_admin_for_school(m.school_id)
          OR (
            public.fn_my_school_id() = m.school_id
            AND public.fn_my_role() IN ('org_admin', 'principal')
          )
        )
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed to sync classes for this teacher';
  END IF;

  FOR v_assignment IN
    SELECT id FROM public.teaching_assignments WHERE teacher_id = v_teacher
  LOOP
    v_class_id := public.ensure_class_for_teaching_assignment(v_assignment.id);
    IF v_class_id IS NOT NULL THEN
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', v_teacher,
    'classes_ensured', v_created
  );
END;
$$;

-- One-time backfill for existing assignments (migration owner; no auth.uid required)
DO $$
DECLARE
  r RECORD;
  v_grade TEXT;
  v_section TEXT;
  v_subject TEXT;
  v_class_name TEXT;
  v_class_code TEXT;
BEGIN
  FOR r IN
    SELECT ta.id, ta.teacher_id, ta.section_id, ta.subject_id
    FROM public.teaching_assignments ta
    WHERE NOT EXISTS (
      SELECT 1 FROM public.classes c WHERE c.teaching_assignment_id = ta.id
    )
  LOOP
    SELECT gs.grade, gs.section, s.name
    INTO v_grade, v_section, v_subject
    FROM public.grade_sections gs
    JOIN public.subjects s ON s.id = r.subject_id
    WHERE gs.id = r.section_id;

    v_class_name := format(
      'Grade %s-%s · %s',
      COALESCE(v_grade, '?'),
      COALESCE(v_section, '?'),
      COALESCE(v_subject, 'Subject')
    );
    v_class_code := upper(substr(replace(r.id::text, '-', ''), 1, 8));
    IF EXISTS (SELECT 1 FROM public.classes WHERE class_code = v_class_code) THEN
      v_class_code := v_class_code || substr(md5(r.id::text), 1, 4);
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.classes WHERE teacher_id = r.teacher_id AND name = v_class_name
    ) THEN
      UPDATE public.classes
      SET teaching_assignment_id = r.id,
          subject = COALESCE(subject, lower(COALESCE(v_subject, 'general')))
      WHERE teacher_id = r.teacher_id
        AND name = v_class_name
        AND teaching_assignment_id IS NULL;
    ELSE
      INSERT INTO public.classes (teacher_id, name, subject, class_code, teaching_assignment_id)
      VALUES (
        r.teacher_id,
        v_class_name,
        lower(COALESCE(v_subject, 'general')),
        v_class_code,
        r.id
      );
    END IF;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.ensure_class_for_teaching_assignment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_teacher_classes_from_assignments(UUID) TO authenticated;
