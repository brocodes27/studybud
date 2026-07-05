-- ============================================
-- Class Curriculum, Invite Links, and Join-by-Code
-- Idempotent migration: safe to re-run
-- ============================================

-- 1. Add curriculum and invite columns to classes
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.coaching_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS curriculum_source TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_curriculum JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invite_link TEXT DEFAULT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_invite_link ON public.classes(invite_link) WHERE invite_link IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classes_template_id ON public.classes(template_id);
-- 2. Add class_id to class_sessions to link sessions back to the class
ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_class_sessions_class_id ON public.class_sessions(class_id);
-- 3. Update create_class RPC to accept optional template_id and return invite_link
-- NOTE: Postgres does not allow changing function return types via CREATE OR REPLACE.
-- Drop any existing overload(s) first to avoid "cannot change return type" errors.
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT n.nspname AS schema_name,
               p.proname AS func_name,
               pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'create_class'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.schema_name, r.func_name, r.args);
    END LOOP;
END $$;
CREATE OR REPLACE FUNCTION create_class(p_name TEXT, p_subject TEXT DEFAULT NULL, p_template_id UUID DEFAULT NULL)
RETURNS TABLE(id UUID, class_code TEXT, invite_link TEXT) AS $$
DECLARE
    new_class_id UUID;
    new_class_code TEXT;
    new_invite_link TEXT;
    new_curriculum_source TEXT;
BEGIN
    -- Generate a unique 6-character class code
    LOOP
        new_class_code := (
            SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32 + 1)::int, 1), '')
            FROM generate_series(1, 6)
        );
        IF NOT EXISTS (SELECT 1 FROM public.classes WHERE public.classes.class_code = new_class_code) THEN
            EXIT;
        END IF;
    END LOOP;

    -- Generate a URL-safe invite slug (10 chars)
    LOOP
        new_invite_link := (
            SELECT string_agg(substr('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', floor(random() * 62 + 1)::int, 1), '')
            FROM generate_series(1, 10)
        );
        IF NOT EXISTS (SELECT 1 FROM public.classes WHERE public.classes.invite_link = new_invite_link) THEN
            EXIT;
        END IF;
    END LOOP;

    -- Determine curriculum source
    IF p_template_id IS NOT NULL THEN
        new_curriculum_source := 'template';
    ELSE
        new_curriculum_source := NULL;
    END IF;

    -- Insert the new class
    INSERT INTO public.classes (teacher_id, name, subject, class_code, invite_link, template_id, curriculum_source)
    VALUES (auth.uid(), p_name, p_subject, new_class_code, new_invite_link, p_template_id, new_curriculum_source)
    RETURNING public.classes.id INTO new_class_id;

    RETURN QUERY SELECT new_class_id, new_class_code, new_invite_link;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 4. Update join_class RPC to accept class_code and auto-create student_roadmap
-- NOTE: Postgres does not allow changing function return types via CREATE OR REPLACE.
-- Drop any existing overload(s) first to avoid "cannot change return type" errors.
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT n.nspname AS schema_name,
               p.proname AS func_name,
               pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'join_class'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.schema_name, r.func_name, r.args);
    END LOOP;
END $$;
CREATE OR REPLACE FUNCTION join_class(p_class_code TEXT)
RETURNS TABLE(class_id UUID, roadmap_id UUID) AS $$
DECLARE
    target_class RECORD;
    new_roadmap_id UUID;
    template_record RECORD;
    test_calendar JSONB;
    t RECORD;
    week_offset INTEGER;
BEGIN
    -- Find the class by its short code
    SELECT * INTO target_class
    FROM public.classes
    WHERE public.classes.class_code = p_class_code;

    IF target_class IS NULL THEN
        RAISE EXCEPTION 'Invalid class code: %', p_class_code;
    END IF;

    -- Insert class membership
    INSERT INTO public.class_members (class_id, student_id)
    VALUES (target_class.id, auth.uid())
    ON CONFLICT (class_id, student_id) DO NOTHING;

    -- If the class has a linked template, auto-create a student roadmap
    IF target_class.template_id IS NOT NULL THEN
        SELECT * INTO template_record
        FROM public.coaching_templates
        WHERE public.coaching_templates.id = target_class.template_id;

        IF template_record IS NOT NULL THEN
            -- Create the student roadmap
            INSERT INTO public.student_roadmaps (
                user_id, template_id, institute_name, batch_name, program,
                year_level, start_date, current_week, is_active, custom_overrides
            )
            VALUES (
                auth.uid(),
                target_class.template_id,
                target_class.name,
                'Standard',
                template_record.program,
                NULL,
                CURRENT_DATE,
                1,
                TRUE,
                '{}'
            )
            RETURNING public.student_roadmaps.id INTO new_roadmap_id;

            -- Copy test calendar from template
            test_calendar := COALESCE(template_record.test_calendar, '[]'::jsonb);

            FOR t IN SELECT * FROM jsonb_array_elements(test_calendar)
            LOOP
                week_offset := COALESCE((t.value->>'week')::int, 1) - 1;
                INSERT INTO public.upcoming_tests (
                    user_id, roadmap_id, test_name, test_date, test_type,
                    syllabus, duration_minutes, total_marks, status
                )
                VALUES (
                    auth.uid(),
                    new_roadmap_id,
                    t.value->>'name',
                    CURRENT_DATE + (week_offset * 7),
                    COALESCE(t.value->>'type', 'phase_test'),
                    t.value->>'syllabus',
                    COALESCE((t.value->>'duration_minutes')::int, 180),
                    COALESCE((t.value->>'total_marks')::int, 300),
                    'upcoming'
                );
            END LOOP;
        END IF;
    ELSIF target_class.custom_curriculum IS NOT NULL THEN
        -- Create a bare roadmap with custom curriculum overrides
        INSERT INTO public.student_roadmaps (
            user_id, template_id, institute_name, batch_name, program,
            year_level, start_date, current_week, is_active, custom_overrides
        )
        VALUES (
            auth.uid(),
            NULL,
            target_class.name,
            'Custom',
            'JEE',
            NULL,
            CURRENT_DATE,
            1,
            TRUE,
            target_class.custom_curriculum
        )
        RETURNING public.student_roadmaps.id INTO new_roadmap_id;
    END IF;

    RETURN QUERY SELECT target_class.id, new_roadmap_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 5. Also support joining by invite_link
-- NOTE: Postgres does not allow changing function return types via CREATE OR REPLACE.
-- Drop any existing overload(s) first to avoid "cannot change return type" errors.
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT n.nspname AS schema_name,
               p.proname AS func_name,
               pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'join_class_by_invite'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.schema_name, r.func_name, r.args);
    END LOOP;
END $$;
CREATE OR REPLACE FUNCTION join_class_by_invite(p_invite_link TEXT)
RETURNS TABLE(class_id UUID, roadmap_id UUID) AS $$
DECLARE
    target_class RECORD;
BEGIN
    SELECT * INTO target_class
    FROM public.classes
    WHERE public.classes.invite_link = p_invite_link;

    IF target_class IS NULL THEN
        RAISE EXCEPTION 'Invalid invite link: %', p_invite_link;
    END IF;

    RETURN QUERY SELECT * FROM join_class(target_class.class_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
