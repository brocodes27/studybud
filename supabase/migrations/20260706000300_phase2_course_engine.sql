-- 1. Create Course Engine tables
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE, -- NULL for global/B2C courses
    name TEXT NOT NULL, -- e.g., "Physics"
    grade TEXT NOT NULL, -- e.g., "Class 10"
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (school_id, name, grade)
);

CREATE TABLE IF NOT EXISTS public.syllabi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (course_id, version)
);

CREATE TABLE IF NOT EXISTS public.chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    syllabus_id UUID NOT NULL REFERENCES public.syllabi(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (syllabus_id, sequence_order)
);

CREATE TABLE IF NOT EXISTS public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (chapter_id, sequence_order)
);

CREATE TABLE IF NOT EXISTS public.subtopics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (topic_id, sequence_order)
);

-- 2. Link classes to Course Engine
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS syllabus_id UUID REFERENCES public.syllabi(id) ON DELETE SET NULL;

-- 3. Create progress tracking tables
CREATE TABLE IF NOT EXISTS public.class_syllabus_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (class_id, topic_id)
);

CREATE TABLE IF NOT EXISTS public.student_syllabus_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, topic_id)
);

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_syllabus_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_syllabus_progress ENABLE ROW LEVEL SECURITY;

-- 4. Define RLS Policies for new tables

-- courses
DROP POLICY IF EXISTS "Select courses" ON public.courses;
CREATE POLICY "Select courses" ON public.courses
    FOR SELECT TO authenticated
    USING (school_id IS NULL OR school_id = public.fn_my_school_id());

DROP POLICY IF EXISTS "Manage courses" ON public.courses;
CREATE POLICY "Manage courses" ON public.courses
    FOR ALL TO authenticated
    USING (school_id = public.fn_my_school_id() AND public.fn_my_role() IN ('org_admin', 'principal'));

-- syllabi
DROP POLICY IF EXISTS "Select syllabi" ON public.syllabi;
CREATE POLICY "Select syllabi" ON public.syllabi
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = course_id 
            AND (c.school_id IS NULL OR c.school_id = public.fn_my_school_id())
        )
    );

DROP POLICY IF EXISTS "Manage syllabi" ON public.syllabi;
CREATE POLICY "Manage syllabi" ON public.syllabi
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = course_id
            AND c.school_id = public.fn_my_school_id()
            AND public.fn_my_role() IN ('org_admin', 'principal')
        )
    );

-- chapters
DROP POLICY IF EXISTS "Select chapters" ON public.chapters;
CREATE POLICY "Select chapters" ON public.chapters
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.syllabi s
            JOIN public.courses c ON c.id = s.course_id
            WHERE s.id = syllabus_id
            AND (c.school_id IS NULL OR c.school_id = public.fn_my_school_id())
        )
    );

DROP POLICY IF EXISTS "Manage chapters" ON public.chapters;
CREATE POLICY "Manage chapters" ON public.chapters
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.syllabi s
            JOIN public.courses c ON c.id = s.course_id
            WHERE s.id = syllabus_id
            AND c.school_id = public.fn_my_school_id()
            AND public.fn_my_role() IN ('org_admin', 'principal')
        )
    );

-- topics
DROP POLICY IF EXISTS "Select topics" ON public.topics;
CREATE POLICY "Select topics" ON public.topics
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.chapters ch
            JOIN public.syllabi s ON s.id = ch.syllabus_id
            JOIN public.courses c ON c.id = s.course_id
            WHERE ch.id = chapter_id
            AND (c.school_id IS NULL OR c.school_id = public.fn_my_school_id())
        )
    );

DROP POLICY IF EXISTS "Manage topics" ON public.topics;
CREATE POLICY "Manage topics" ON public.topics
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.chapters ch
            JOIN public.syllabi s ON s.id = ch.syllabus_id
            JOIN public.courses c ON c.id = s.course_id
            WHERE ch.id = chapter_id
            AND c.school_id = public.fn_my_school_id()
            AND public.fn_my_role() IN ('org_admin', 'principal')
        )
    );

-- subtopics
DROP POLICY IF EXISTS "Select subtopics" ON public.subtopics;
CREATE POLICY "Select subtopics" ON public.subtopics
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.topics t
            JOIN public.chapters ch ON ch.id = t.chapter_id
            JOIN public.syllabi s ON s.id = ch.syllabus_id
            JOIN public.courses c ON c.id = s.course_id
            WHERE t.id = topic_id
            AND (c.school_id IS NULL OR c.school_id = public.fn_my_school_id())
        )
    );

DROP POLICY IF EXISTS "Manage subtopics" ON public.subtopics;
CREATE POLICY "Manage subtopics" ON public.subtopics
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.topics t
            JOIN public.chapters ch ON ch.id = t.chapter_id
            JOIN public.syllabi s ON s.id = ch.syllabus_id
            JOIN public.courses c ON c.id = s.course_id
            WHERE t.id = topic_id
            AND c.school_id = public.fn_my_school_id()
            AND public.fn_my_role() IN ('org_admin', 'principal')
        )
    );

-- class_syllabus_progress
DROP POLICY IF EXISTS "Select class progress" ON public.class_syllabus_progress;
CREATE POLICY "Select class progress" ON public.class_syllabus_progress
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.classes c
            WHERE c.id = class_id
            AND (c.teacher_id = auth.uid() OR EXISTS (
                SELECT 1 FROM public.class_members cm WHERE cm.class_id = c.id AND (cm.student_id = auth.uid() OR cm.user_id = auth.uid())
            ))
        )
    );

DROP POLICY IF EXISTS "Manage class progress" ON public.class_syllabus_progress;
CREATE POLICY "Manage class progress" ON public.class_syllabus_progress
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.classes c
            WHERE c.id = class_id
            AND c.teacher_id = auth.uid()
        )
    );

-- student_syllabus_progress
DROP POLICY IF EXISTS "Select student progress" ON public.student_syllabus_progress;
CREATE POLICY "Select student progress" ON public.student_syllabus_progress
    FOR SELECT TO authenticated
    USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Manage student progress" ON public.student_syllabus_progress;
CREATE POLICY "Manage student progress" ON public.student_syllabus_progress
    FOR ALL TO authenticated
    USING (student_id = auth.uid());

-- 5. Create RPC database function to insert parsed hierarchies
CREATE OR REPLACE FUNCTION public.insert_scanned_curriculum_hierarchy(
    p_class_id UUID,
    p_weekly_schedule JSONB
)
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
  v_class_name TEXT;
  v_subject TEXT;
  v_teacher_id UUID;
  v_school_id UUID;
  v_course_id UUID;
  v_syllabus_id UUID;
  v_week_item JSONB;
  v_subject_item JSONB;
  v_subtopic_text JSONB;
  v_chapter_id UUID;
  v_topic_id UUID;
  v_week_num INT;
  v_subtopic_num INT;
  v_result JSONB;
BEGIN
  -- Fetch class info
  SELECT name, subject, teacher_id 
  FROM public.classes 
  WHERE id = p_class_id 
  INTO v_class_name, v_subject, v_teacher_id;
  
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  -- Fetch school ID of the teacher
  SELECT school_id 
  FROM public.user_profiles 
  WHERE id = v_teacher_id 
  INTO v_school_id;

  -- Create or look up course
  INSERT INTO public.courses (school_id, name, grade)
  VALUES (
    v_school_id, 
    COALESCE(v_subject, 'General'), 
    COALESCE(p_weekly_schedule->>'detected_class', 'Standard')
  )
  ON CONFLICT (school_id, name, grade) DO UPDATE 
  SET name = EXCLUDED.name 
  RETURNING id INTO v_course_id;

  -- Create new syllabus version
  INSERT INTO public.syllabi (course_id, version, is_active)
  VALUES (
    v_course_id, 
    (SELECT COALESCE(MAX(version), 0) + 1 FROM public.syllabi WHERE course_id = v_course_id), 
    true
  )
  RETURNING id INTO v_syllabus_id;

  -- Link class to course and syllabus
  UPDATE public.classes 
  SET course_id = v_course_id, 
      syllabus_id = v_syllabus_id,
      curriculum_source = 'file',
      custom_curriculum = p_weekly_schedule
  WHERE id = p_class_id;

  -- Populate hierarchy
  FOR v_week_item IN SELECT * FROM jsonb_array_elements(p_weekly_schedule->'weekly_schedule') LOOP
    v_week_num := (v_week_item->>'week')::INT;
    v_subject_item := NULL;

    -- Pick first defined subject key
    IF v_week_item ? 'physics' THEN
      v_subject_item := v_week_item->'physics';
    ELSIF v_week_item ? 'chemistry' THEN
      v_subject_item := v_week_item->'chemistry';
    ELSIF v_week_item ? 'mathematics' THEN
      v_subject_item := v_week_item->'mathematics';
    ELSIF v_week_item ? 'social_science' THEN
      v_subject_item := v_week_item->'social_science';
    END IF;

    IF v_subject_item IS NOT NULL AND v_subject_item->>'topic' IS NOT NULL AND v_subject_item->>'topic' != '' THEN
      -- Create chapter
      INSERT INTO public.chapters (syllabus_id, name, sequence_order)
      VALUES (v_syllabus_id, v_subject_item->>'topic', v_week_num)
      ON CONFLICT (syllabus_id, sequence_order) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_chapter_id;

      -- Create main topic
      INSERT INTO public.topics (chapter_id, name, sequence_order)
      VALUES (v_chapter_id, v_subject_item->>'topic', 1)
      ON CONFLICT (chapter_id, sequence_order) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_topic_id;

      -- Create subtopics
      v_subtopic_num := 1;
      IF v_subject_item ? 'subtopics' AND jsonb_typeof(v_subject_item->'subtopics') = 'array' THEN
        FOR v_subtopic_text IN SELECT * FROM jsonb_array_elements(v_subject_item->'subtopics') LOOP
          INSERT INTO public.subtopics (topic_id, name, sequence_order)
          VALUES (v_topic_id, v_subtopic_text#>>'{}', v_subtopic_num)
          ON CONFLICT (topic_id, sequence_order) DO UPDATE SET name = EXCLUDED.name;
          v_subtopic_num := v_subtopic_num + 1;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  SELECT jsonb_build_object('success', true, 'course_id', v_course_id, 'syllabus_id', v_syllabus_id) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 6. Refactor update_curriculum_progress_from_session function to support structured course engine
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
  v_evidence TEXT[];
  v_matched_count INTEGER := 0;
  v_next_week INTEGER := 1;
  v_topic RECORD;
  v_match BOOLEAN;
  v_schedule JSONB;
  v_week JSONB;
  v_subject TEXT;
  v_subject_obj JSONB;
  v_fallback_topic TEXT;
  v_subtopics TEXT[];
  v_week_no INTEGER;
BEGIN
  -- 1. Fetch the class session info
  SELECT cas.*, c.syllabus_id, c.custom_curriculum, c.template_id, ct.weekly_schedule
  FROM public.class_attendance_sessions cas
  JOIN public.classes c ON c.id = cas.class_id
  LEFT JOIN public.coaching_templates ct ON ct.id = c.template_id
  WHERE cas.id = p_session_id
  INTO v_session;

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
    -- Return current week or 1
    SELECT COALESCE(MIN(sr.current_week), 1)
    INTO v_next_week
    FROM public.student_roadmaps sr
    WHERE sr.class_id = v_session.class_id;
    
    RETURN QUERY SELECT 0, v_next_week;
    RETURN;
  END IF;

  -- 2. Check if class has structured syllabus linked
  IF v_session.syllabus_id IS NOT NULL THEN
    -- Loop through all topics in this syllabus
    FOR v_topic IN 
      SELECT t.id, t.name, ch.sequence_order as week_no
      FROM public.topics t
      JOIN public.chapters ch ON ch.id = t.chapter_id
      WHERE ch.syllabus_id = v_session.syllabus_id
    LOOP
      v_match := FALSE;
      -- Check if topic name matches evidence
      IF EXISTS (
        SELECT 1 FROM unnest(v_evidence) e
        WHERE lower(v_topic.name) LIKE '%' || lower(e) || '%'
           OR lower(e) LIKE '%' || lower(v_topic.name) || '%'
      ) THEN
        v_match := TRUE;
      ELSE
        -- Check if any subtopics match
        IF EXISTS (
          SELECT 1 FROM public.subtopics st
          WHERE st.topic_id = v_topic.id
            AND EXISTS (
              SELECT 1 FROM unnest(v_evidence) e
              WHERE lower(st.name) LIKE '%' || lower(e) || '%'
                 OR lower(e) LIKE '%' || lower(st.name) || '%'
            )
        ) THEN
          v_match := TRUE;
        END IF;
      END IF;

      IF v_match THEN
        -- Insert or update progress in class_syllabus_progress
        INSERT INTO public.class_syllabus_progress (class_id, topic_id, status, completed_at)
        VALUES (v_session.class_id, v_topic.id, 'completed', NOW())
        ON CONFLICT (class_id, topic_id)
        DO UPDATE SET
          status = 'completed',
          completed_at = NOW(),
          created_at = NOW();

        v_matched_count := v_matched_count + 1;
      END IF;
    END LOOP;

    -- Calculate next week (first week/chapter that has incomplete topics)
    SELECT COALESCE(MIN(ch.sequence_order), 1)
    INTO v_next_week
    FROM public.chapters ch
    WHERE ch.syllabus_id = v_session.syllabus_id
      AND EXISTS (
        SELECT 1 FROM public.topics t
        WHERE t.chapter_id = ch.id
          AND NOT EXISTS (
            SELECT 1 FROM public.class_syllabus_progress csp
            WHERE csp.class_id = v_session.class_id
              AND csp.topic_id = t.id
              AND csp.status = 'completed'
          )
      );

    v_next_week := GREATEST(COALESCE(v_next_week, 1), 1);

    -- Advance student roadmap
    UPDATE public.student_roadmaps sr
    SET current_week = GREATEST(sr.current_week, v_next_week), updated_at = NOW()
    WHERE sr.class_id = v_session.class_id
      AND sr.scope = 'school';

    RETURN QUERY SELECT v_matched_count, v_next_week;
    RETURN;
  ELSE
    -- 3. Fallback: Legacy JSONB weekly schedule logic
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

      FOREACH v_subject IN ARRAY ARRAY['physics', 'chemistry', 'mathematics', 'social_science'] LOOP
        v_subject_obj := CASE
          WHEN v_subject = 'mathematics' THEN COALESCE(v_week->'mathematics', v_week->'maths', v_week->'math')
          ELSE v_week->v_subject
        END;

        IF v_subject_obj IS NULL OR jsonb_typeof(v_subject_obj) <> 'object' THEN
          CONTINUE;
        END IF;

        v_fallback_topic := COALESCE(v_subject_obj->>'topic', v_subject_obj->>'title', v_subject_obj->>'name');
        v_subtopics := COALESCE(
          ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(v_subject_obj->'subtopics') = 'array' THEN v_subject_obj->'subtopics' ELSE '[]'::jsonb END)),
          ARRAY[]::TEXT[]
        );

        IF v_fallback_topic IS NULL THEN
          CONTINUE;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM unnest(v_evidence) e
          WHERE lower(v_fallback_topic) LIKE '%' || lower(e) || '%'
             OR lower(e) LIKE '%' || lower(v_fallback_topic) || '%'
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
            v_fallback_topic,
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

    -- Calculate next week
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
  END IF;
END;
$$;

-- 7. Add BEFORE INSERT OR UPDATE trigger to automatically parse custom_curriculum
CREATE OR REPLACE FUNCTION public.fn_parse_classes_curriculum_before_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_school_id UUID;
  v_course_id UUID;
  v_syllabus_id UUID;
  v_week_item JSONB;
  v_subject_item JSONB;
  v_subtopic_text JSONB;
  v_chapter_id UUID;
  v_topic_id UUID;
  v_week_num INT;
  v_subtopic_num INT;
BEGIN
  -- Only execute if custom_curriculum is updated/inserted and syllabus_id is not set
  IF NEW.custom_curriculum IS NOT NULL AND NEW.syllabus_id IS NULL THEN
    -- Fetch school ID
    SELECT school_id 
    FROM public.user_profiles 
    WHERE id = NEW.teacher_id 
    INTO v_school_id;

    -- Create or look up course
    INSERT INTO public.courses (school_id, name, grade)
    VALUES (
      v_school_id, 
      COALESCE(NEW.subject, 'General'), 
      COALESCE(NEW.custom_curriculum->>'detected_class', 'Standard')
    )
    ON CONFLICT (school_id, name, grade) DO UPDATE 
    SET name = EXCLUDED.name 
    RETURNING id INTO v_course_id;

    -- Create new syllabus version
    INSERT INTO public.syllabi (course_id, version, is_active)
    VALUES (
      v_course_id, 
      (SELECT COALESCE(MAX(version), 0) + 1 FROM public.syllabi WHERE course_id = v_course_id), 
      true
    )
    RETURNING id INTO v_syllabus_id;

    -- Assign to class record
    NEW.course_id := v_course_id;
    NEW.syllabus_id := v_syllabus_id;

    -- Populate hierarchy if weekly_schedule exists
    IF NEW.custom_curriculum ? 'weekly_schedule' AND jsonb_typeof(NEW.custom_curriculum->'weekly_schedule') = 'array' THEN
      FOR v_week_item IN SELECT * FROM jsonb_array_elements(NEW.custom_curriculum->'weekly_schedule') LOOP
        v_week_num := (v_week_item->>'week')::INT;
        v_subject_item := NULL;

        IF v_week_item ? 'physics' THEN
          v_subject_item := v_week_item->'physics';
        ELSIF v_week_item ? 'chemistry' THEN
          v_subject_item := v_week_item->'chemistry';
        ELSIF v_week_item ? 'mathematics' THEN
          v_subject_item := v_week_item->'mathematics';
        ELSIF v_week_item ? 'social_science' THEN
          v_subject_item := v_week_item->'social_science';
        END IF;

        IF v_subject_item IS NOT NULL AND v_subject_item->>'topic' IS NOT NULL AND v_subject_item->>'topic' != '' THEN
          -- Create chapter
          INSERT INTO public.chapters (syllabus_id, name, sequence_order)
          VALUES (v_syllabus_id, v_subject_item->>'topic', v_week_num)
          ON CONFLICT (syllabus_id, sequence_order) DO UPDATE SET name = EXCLUDED.name
          RETURNING id INTO v_chapter_id;

          -- Create main topic
          INSERT INTO public.topics (chapter_id, name, sequence_order)
          VALUES (v_chapter_id, v_subject_item->>'topic', 1)
          ON CONFLICT (chapter_id, sequence_order) DO UPDATE SET name = EXCLUDED.name
          RETURNING id INTO v_topic_id;

          -- Create subtopics
          v_subtopic_num := 1;
          IF v_subject_item ? 'subtopics' AND jsonb_typeof(v_subject_item->'subtopics') = 'array' THEN
            FOR v_subtopic_text IN SELECT * FROM jsonb_array_elements(v_subject_item->'subtopics') LOOP
              INSERT INTO public.subtopics (topic_id, name, sequence_order)
              VALUES (v_topic_id, v_subtopic_text#>>'{}', v_subtopic_num)
              ON CONFLICT (topic_id, sequence_order) DO UPDATE SET name = EXCLUDED.name;
              v_subtopic_num := v_subtopic_num + 1;
            END LOOP;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_parse_classes_curriculum_before ON public.classes;
CREATE TRIGGER tr_parse_classes_curriculum_before
  BEFORE INSERT OR UPDATE OF custom_curriculum
  ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_parse_classes_curriculum_before_trigger();

