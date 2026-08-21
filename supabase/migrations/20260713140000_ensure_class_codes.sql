-- Ensure every class has a shareable class_code, including rows created earlier without one.

CREATE OR REPLACE FUNCTION public.fn_generate_class_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.classes WHERE class_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

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

  SELECT id INTO v_class_id
  FROM public.classes
  WHERE teaching_assignment_id = p_assignment_id
  LIMIT 1;

  IF v_class_id IS NOT NULL THEN
    UPDATE public.classes
    SET
      name = COALESCE(NULLIF(name, ''), v_class_name),
      subject = COALESCE(NULLIF(subject, ''), lower(COALESCE(v_subject, 'general'))),
      class_code = COALESCE(NULLIF(class_code, ''), public.fn_generate_class_code())
    WHERE id = v_class_id;
    RETURN v_class_id;
  END IF;

  SELECT id INTO v_class_id
  FROM public.classes
  WHERE teacher_id = v_assignment.teacher_id
    AND name = v_class_name
  LIMIT 1;

  IF v_class_id IS NOT NULL THEN
    UPDATE public.classes
    SET
      teaching_assignment_id = p_assignment_id,
      subject = COALESCE(NULLIF(subject, ''), lower(COALESCE(v_subject, 'general'))),
      class_code = COALESCE(NULLIF(class_code, ''), public.fn_generate_class_code())
    WHERE id = v_class_id;
    RETURN v_class_id;
  END IF;

  v_class_code := public.fn_generate_class_code();

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

-- Backfill missing/blank codes on existing classes
UPDATE public.classes
SET class_code = public.fn_generate_class_code()
WHERE class_code IS NULL OR btrim(class_code) = '';

GRANT EXECUTE ON FUNCTION public.fn_generate_class_code() TO authenticated;
