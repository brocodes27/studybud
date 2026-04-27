-- ============================================
-- Allow users to join classes even if they already follow a roadmap
-- If the user already has an active roadmap, new class roadmaps are created inactive
-- so the user can explicitly switch later via the roadmap picker.
-- ============================================

-- Must DROP first because CREATE OR REPLACE cannot change return types.
-- The old functions had RETURNS TABLE(class_id UUID, roadmap_id UUID) which
-- created local variables shadowing the class_members.class_id column.
DROP FUNCTION IF EXISTS public.join_class_by_invite(TEXT);
DROP FUNCTION IF EXISTS public.join_class(TEXT);

CREATE FUNCTION public.join_class(p_class_code TEXT)
RETURNS TABLE(out_class_id UUID, out_roadmap_id UUID) AS $$
DECLARE
    v_target_class RECORD;
    v_new_roadmap_id UUID;
    v_template_record RECORD;
    v_test_calendar JSONB;
    v_t RECORD;
    v_week_offset INTEGER;
    v_user_has_active_roadmap BOOLEAN;
BEGIN
    -- Find the class by its short code (case-insensitive so lowercase typed codes still match)
    SELECT * INTO v_target_class
    FROM public.classes
    WHERE public.classes.class_code ILIKE p_class_code;

    IF v_target_class IS NULL THEN
        RAISE EXCEPTION 'Invalid class code: %', p_class_code;
    END IF;

    -- Insert class membership using EXECUTE to bypass any compile-time column-name ambiguity.
    -- Also dynamically picks the correct column name (user_id vs student_id) in case of schema drift.
    EXECUTE format(
        'INSERT INTO public.class_members (class_id, %I) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        (SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'class_members' AND column_name IN ('user_id', 'student_id') LIMIT 1)
    ) USING v_target_class.id, auth.uid();

    -- Check whether the user already has an active roadmap
    SELECT EXISTS (
        SELECT 1 FROM public.student_roadmaps
        WHERE user_id = auth.uid() AND is_active = TRUE
    ) INTO v_user_has_active_roadmap;

    -- If the class has a linked template, auto-create a student roadmap
    IF v_target_class.template_id IS NOT NULL THEN
        SELECT * INTO v_template_record
        FROM public.coaching_templates
        WHERE public.coaching_templates.id = v_target_class.template_id;

        IF v_template_record IS NOT NULL THEN
            -- Create the student roadmap (inactive if user already has an active one)
            INSERT INTO public.student_roadmaps (
                user_id, template_id, institute_name, batch_name, program,
                year_level, start_date, current_week, is_active, custom_overrides
            )
            VALUES (
                auth.uid(),
                v_target_class.template_id,
                v_target_class.name,
                'Standard',
                v_template_record.program,
                NULL,
                CURRENT_DATE,
                1,
                NOT v_user_has_active_roadmap,
                '{}'
            )
            RETURNING public.student_roadmaps.id INTO v_new_roadmap_id;

            -- Copy test calendar from template
            v_test_calendar := COALESCE(v_template_record.test_calendar, '[]'::jsonb);

            FOR v_t IN SELECT * FROM jsonb_array_elements(v_test_calendar)
            LOOP
                v_week_offset := COALESCE((v_t.value->>'week')::int, 1) - 1;
                INSERT INTO public.upcoming_tests (
                    user_id, roadmap_id, test_name, test_date, test_type,
                    syllabus, duration_minutes, total_marks, status
                )
                VALUES (
                    auth.uid(),
                    v_new_roadmap_id,
                    v_t.value->>'name',
                    CURRENT_DATE + (v_week_offset * 7),
                    COALESCE(v_t.value->>'type', 'phase_test'),
                    v_t.value->>'syllabus',
                    COALESCE((v_t.value->>'duration_minutes')::int, 180),
                    COALESCE((v_t.value->>'total_marks')::int, 300),
                    'upcoming'
                );
            END LOOP;
        END IF;
    ELSIF v_target_class.custom_curriculum IS NOT NULL THEN
        -- Create a bare roadmap with custom curriculum overrides
        INSERT INTO public.student_roadmaps (
            user_id, template_id, institute_name, batch_name, program,
            year_level, start_date, current_week, is_active, custom_overrides
        )
        VALUES (
            auth.uid(),
            NULL,
            v_target_class.name,
            'Custom',
            'JEE',
            NULL,
            CURRENT_DATE,
            1,
            NOT v_user_has_active_roadmap,
            v_target_class.custom_curriculum
        )
        RETURNING public.student_roadmaps.id INTO v_new_roadmap_id;
    END IF;

    RETURN QUERY SELECT v_target_class.id AS out_class_id, v_new_roadmap_id AS out_roadmap_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add teacher-view policy on student_roadmaps so teachers can see roadmaps
--    of students enrolled in their classes (needed for class session logging).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='student_roadmaps' AND policyname='roadmaps_select_teacher'
  ) THEN
    CREATE POLICY roadmaps_select_teacher ON public.student_roadmaps FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.class_members cm
        JOIN public.classes c ON c.id = cm.class_id
        WHERE cm.user_id = public.student_roadmaps.user_id
        AND c.teacher_id = auth.uid()
      )
    );
  END IF;
END $$;

-- join_class_by_invite delegates to join_class
CREATE FUNCTION public.join_class_by_invite(p_invite_link TEXT)
RETURNS TABLE(out_class_id UUID, out_roadmap_id UUID) AS $$
DECLARE
    v_target_class RECORD;
BEGIN
    SELECT * INTO v_target_class
    FROM public.classes
    WHERE public.classes.invite_link = p_invite_link;

    IF v_target_class IS NULL THEN
        RAISE EXCEPTION 'Invalid invite link: %', p_invite_link;
    END IF;

    RETURN QUERY SELECT * FROM public.join_class(v_target_class.class_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Ensure class_sessions has all expected columns (idempotent for tables created before 20260421).
ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS homework_assigned TEXT;
ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS topics_covered TEXT[] DEFAULT '{}';
ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS session_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS roadmap_id UUID REFERENCES public.student_roadmaps(id) ON DELETE CASCADE;
ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. RPC to insert class_sessions — bypasses PostgREST schema cache entirely.
--    The frontend calls this instead of .from('class_sessions').insert() so
--    stale schema caches don't block the insert.
CREATE OR REPLACE FUNCTION public.log_class_sessions(p_rows JSONB)
RETURNS VOID AS $$
DECLARE
  r JSONB;
  v_user_id UUID;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    -- Derive user_id from the roadmap record
    SELECT user_id INTO v_user_id
    FROM public.student_roadmaps
    WHERE id = (r->>'roadmap_id')::UUID;

    INSERT INTO public.class_sessions (
      user_id, roadmap_id, teacher_id, session_date, subject,
      topics_covered, homework_assigned, duration_minutes
    )
    VALUES (
      v_user_id,
      (r->>'roadmap_id')::UUID,
      (r->>'teacher_id')::UUID,
      COALESCE((r->>'session_date')::DATE, CURRENT_DATE),
      r->>'subject',
      ARRAY(SELECT jsonb_array_elements_text(r->'topics_covered')),
      r->>'homework_assigned',
      COALESCE((r->>'duration_minutes')::INTEGER, 0)
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
