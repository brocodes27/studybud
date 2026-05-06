CREATE TABLE IF NOT EXISTS public.class_curriculum_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'covered',
  covered_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT,
  source_session_id UUID REFERENCES public.class_attendance_sessions(id) ON DELETE SET NULL,
  evidence_topics TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, week, subject)
);

ALTER TABLE public.class_curriculum_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'class_curriculum_progress'
      AND policyname = 'curriculum_progress_teacher_read_write'
  ) THEN
    CREATE POLICY curriculum_progress_teacher_read_write
      ON public.class_curriculum_progress
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.teacher_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.teacher_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'class_curriculum_progress'
      AND policyname = 'curriculum_progress_student_read'
  ) THEN
    CREATE POLICY curriculum_progress_student_read
      ON public.class_curriculum_progress
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = class_curriculum_progress.class_id AND cm.user_id = auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_curriculum_progress_from_session(
  p_session_id UUID,
  p_extra_topics TEXT[] DEFAULT '{}',
  p_source TEXT DEFAULT 'class_session'
)
RETURNS TABLE(updated_count INTEGER, next_week INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_schedule JSONB;
  v_week JSONB;
  v_subject TEXT;
  v_subject_obj JSONB;
  v_topic TEXT;
  v_subtopics TEXT[];
  v_week_no INTEGER;
  v_evidence TEXT[];
  v_matched_count INTEGER := 0;
  v_next_week INTEGER := 1;
BEGIN
  SELECT cas.*, c.custom_curriculum, c.template_id, ct.weekly_schedule
  INTO v_session
  FROM public.class_attendance_sessions cas
  JOIN public.classes c ON c.id = cas.class_id
  LEFT JOIN public.coaching_templates ct ON ct.id = c.template_id
  WHERE cas.id = p_session_id;

  IF v_session.id IS NULL THEN
    RETURN QUERY SELECT 0, 1;
    RETURN;
  END IF;

  v_evidence := ARRAY(
    SELECT DISTINCT btrim(x)
    FROM unnest(COALESCE(v_session.topics_covered, '{}') || COALESCE(p_extra_topics, '{}')) AS x
    WHERE btrim(COALESCE(x, '')) <> '' AND lower(btrim(x)) <> 'general'
  );

  IF array_length(v_evidence, 1) IS NULL THEN
    RETURN QUERY SELECT 0, COALESCE((SELECT MIN(sr.current_week) FROM public.student_roadmaps sr WHERE sr.class_id = v_session.class_id), 1);
    RETURN;
  END IF;

  v_schedule := COALESCE(
    NULLIF(v_session.weekly_schedule, '[]'::jsonb),
    CASE
      WHEN jsonb_typeof(v_session.custom_curriculum) = 'object' THEN v_session.custom_curriculum->'weekly_schedule'
      WHEN jsonb_typeof(v_session.custom_curriculum) = 'array' THEN v_session.custom_curriculum
      ELSE NULL
    END
  );

  IF v_schedule IS NULL OR jsonb_typeof(v_schedule) <> 'array' THEN
    RETURN QUERY SELECT 0, COALESCE((SELECT MIN(sr.current_week) FROM public.student_roadmaps sr WHERE sr.class_id = v_session.class_id), 1);
    RETURN;
  END IF;

  FOR v_week IN SELECT * FROM jsonb_array_elements(v_schedule) LOOP
    v_week_no := COALESCE((v_week->>'week')::INTEGER, 1);

    FOREACH v_subject IN ARRAY ARRAY['physics', 'chemistry', 'mathematics'] LOOP
      v_subject_obj := CASE
        WHEN v_subject = 'mathematics' THEN COALESCE(v_week->'mathematics', v_week->'maths', v_week->'math')
        ELSE v_week->v_subject
      END;

      IF v_subject_obj IS NULL OR jsonb_typeof(v_subject_obj) <> 'object' THEN
        CONTINUE;
      END IF;

      v_topic := COALESCE(v_subject_obj->>'topic', v_subject_obj->>'title', v_subject_obj->>'name');
      v_subtopics := COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(v_subject_obj->'subtopics') = 'array' THEN v_subject_obj->'subtopics' ELSE '[]'::jsonb END)),
        ARRAY[]::TEXT[]
      );

      IF v_topic IS NULL THEN
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM unnest(v_evidence) e
        WHERE lower(v_topic) LIKE '%' || lower(e) || '%'
           OR lower(e) LIKE '%' || lower(v_topic) || '%'
           OR EXISTS (
             SELECT 1 FROM unnest(v_subtopics) st
             WHERE lower(st) LIKE '%' || lower(e) || '%'
                OR lower(e) LIKE '%' || lower(st) || '%'
           )
      ) THEN
        INSERT INTO public.class_curriculum_progress (
          class_id,
          week,
          subject,
          topic,
          status,
          covered_at,
          source,
          source_session_id,
          evidence_topics,
          updated_at
        ) VALUES (
          v_session.class_id,
          v_week_no,
          v_subject,
          v_topic,
          'covered',
          NOW(),
          p_source,
          p_session_id,
          v_evidence,
          NOW()
        )
        ON CONFLICT (class_id, week, subject)
        DO UPDATE SET
          status = 'covered',
          covered_at = NOW(),
          source = EXCLUDED.source,
          source_session_id = EXCLUDED.source_session_id,
          evidence_topics = ARRAY(SELECT DISTINCT x FROM unnest(class_curriculum_progress.evidence_topics || EXCLUDED.evidence_topics) x),
          updated_at = NOW();

        v_matched_count := v_matched_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  WITH schedule_weeks AS (
    SELECT DISTINCT COALESCE((elem->>'week')::INTEGER, 1) AS week_no
    FROM jsonb_array_elements(v_schedule) elem
  ), covered_weeks AS (
    SELECT DISTINCT week AS week_no
    FROM public.class_curriculum_progress
    WHERE class_id = v_session.class_id AND status = 'covered'
  )
  SELECT COALESCE(MIN(sw.week_no), COALESCE(MAX(cw.week_no), 0) + 1, 1)
  INTO v_next_week
  FROM schedule_weeks sw
  FULL JOIN covered_weeks cw ON cw.week_no = sw.week_no
  WHERE sw.week_no IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM covered_weeks c2 WHERE c2.week_no = sw.week_no
    );

  v_next_week := GREATEST(COALESCE(v_next_week, 1), 1);

  UPDATE public.student_roadmaps sr
  SET current_week = GREATEST(sr.current_week, v_next_week), updated_at = NOW()
  WHERE sr.class_id = v_session.class_id
    AND sr.scope = 'school';

  RETURN QUERY SELECT v_matched_count, v_next_week;
END;
$$;
