-- ============================================
-- School Pilot Schema Hardening (idempotent)
-- ============================================

-- A1) coaching_templates: add missing columns + backfill
ALTER TABLE public.coaching_templates
  ADD COLUMN IF NOT EXISTS institute_name TEXT,
  ADD COLUMN IF NOT EXISTS year_level TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS total_weeks INT,
  ADD COLUMN IF NOT EXISTS weekly_schedule JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='coaching_templates' AND column_name='name'
  ) THEN
    UPDATE public.coaching_templates SET
      institute_name = COALESCE(institute_name, name),
      year_level = COALESCE(year_level, CASE WHEN name ILIKE '%2-year%' OR name ILIKE '%11th + 12th%' THEN '11,12' WHEN name ILIKE '%dropper%' OR name ILIKE '%1-year%' THEN 'Dropper' ELSE NULL END),
      total_weeks = COALESCE(total_weeks, CASE WHEN name ILIKE '%2-year%' THEN 104 WHEN name ILIKE '%1-year%' THEN 52 ELSE 52 END),
      description = COALESCE(description, name),
      is_active = COALESCE(is_active, TRUE)
    WHERE institute_name IS NULL OR total_weeks IS NULL;
  ELSE
    UPDATE public.coaching_templates SET
      institute_name = COALESCE(institute_name, ''),
      is_active = COALESCE(is_active, TRUE)
    WHERE institute_name IS NULL;
  END IF;
END $$;

-- Basic weekly_schedule generator from syllabus_map for templates that lack one
DO $$
DECLARE rec RECORD; syllabus jsonb; subjects TEXT[]; subj TEXT; topics TEXT[]; max_len INT; w INT; week_obj jsonb; schedule jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='coaching_templates' AND column_name='syllabus_map'
  ) THEN RETURN; END IF;
  FOR rec IN SELECT id, syllabus_map FROM public.coaching_templates WHERE (weekly_schedule='[]'::jsonb OR weekly_schedule IS NULL) AND syllabus_map IS NOT NULL AND syllabus_map!='{}'::jsonb LOOP
    syllabus:=rec.syllabus_map;
    SELECT array_agg(key) INTO subjects FROM jsonb_object_keys(syllabus) AS key;
    IF subjects IS NULL THEN CONTINUE; END IF;
    max_len:=0;
    FOREACH subj IN ARRAY subjects LOOP SELECT COALESCE(jsonb_array_length(syllabus->subj),0) INTO w; IF w>max_len THEN max_len:=w; END IF; END LOOP;
    schedule:='[]'::jsonb;
    FOR w IN 1..max_len LOOP
      week_obj:=jsonb_build_object('week',w);
      FOREACH subj IN ARRAY subjects LOOP
        topics:=ARRAY(SELECT jsonb_array_elements_text(syllabus->subj));
        IF array_length(topics,1)>=w THEN
          week_obj:=jsonb_set(week_obj, ARRAY[subj], jsonb_build_object('topic',topics[w],'subtopics',ARRAY[]::TEXT[]));
        END IF;
      END LOOP;
      schedule:=schedule||week_obj;
    END LOOP;
    UPDATE public.coaching_templates SET weekly_schedule=schedule, updated_at=NOW() WHERE id=rec.id;
  END LOOP;
END $$;

-- C4) user_profiles: account_type + is_admin safety
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'b2c_student';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
DO $$ BEGIN ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_account_type_check CHECK (account_type IN ('b2c_student','school_student','teacher','parent','admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
UPDATE public.user_profiles SET account_type=COALESCE(account_type,CASE WHEN role='teacher' THEN 'teacher' ELSE 'b2c_student' END) WHERE account_type IS NULL;
UPDATE public.user_profiles SET is_admin=COALESCE(is_admin,FALSE) WHERE is_admin IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id,full_name,grade,school,email,role,account_type)
  VALUES (NEW.id,COALESCE(NEW.raw_user_meta_data->>'full_name',''),COALESCE(NEW.raw_user_meta_data->>'grade',''),COALESCE(NEW.raw_user_meta_data->>'school',''),NEW.email,COALESCE(NEW.raw_user_meta_data->>'role','student'),COALESCE(NEW.raw_user_meta_data->>'account_type',CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role','student')='teacher' THEN 'teacher' ELSE 'b2c_student' END));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- A2) student_roadmaps: school vs personal scoping
ALTER TABLE public.student_roadmaps
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS locked_by_school BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_from TEXT;
UPDATE public.student_roadmaps SET scope='personal' WHERE scope IS NULL;
DO $$ BEGIN ALTER TABLE public.student_roadmaps ADD CONSTRAINT student_roadmaps_scope_check CHECK (scope IN ('personal','school')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$
DECLARE v_col TEXT;
BEGIN
  SELECT column_name INTO v_col FROM information_schema.columns WHERE table_schema='public' AND table_name='class_members' AND column_name IN ('user_id','student_id') LIMIT 1;
  IF v_col IS NULL THEN RETURN; END IF;
  EXECUTE format(
    'UPDATE public.student_roadmaps sr SET scope=''school'', class_id=c.id, locked_by_school=TRUE, created_from=COALESCE(created_from,''join_class_backfill'') FROM public.class_members cm JOIN public.classes c ON c.id=cm.class_id WHERE sr.user_id=cm.%I AND sr.scope=''personal'' AND sr.template_id IS NOT NULL AND sr.template_id=c.template_id;',
    v_col
  );
END $$;

-- A3) Partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_school_roadmap ON public.student_roadmaps(user_id) WHERE scope='school' AND is_active=TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_school_roadmap_per_class ON public.student_roadmaps(user_id,class_id) WHERE scope='school';

-- A4) Tighten teacher RLS (handles class_members column drift)
DO $$
DECLARE v_col TEXT;
BEGIN
  SELECT column_name INTO v_col FROM information_schema.columns WHERE table_schema='public' AND table_name='class_members' AND column_name IN ('user_id','student_id') LIMIT 1;
  IF v_col IS NULL THEN RETURN; END IF;
  EXECUTE format('DROP POLICY IF EXISTS roadmaps_select_teacher ON public.student_roadmaps; CREATE POLICY roadmaps_select_teacher ON public.student_roadmaps FOR SELECT USING (scope=''school'' AND EXISTS (SELECT 1 FROM public.class_members cm JOIN public.classes c ON c.id=cm.class_id WHERE cm.%I=public.student_roadmaps.user_id AND c.id=public.student_roadmaps.class_id AND c.teacher_id=auth.uid()));', v_col);
END $$;

-- D) Chapter-based test fields
ALTER TABLE public.test_results ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS chapter_tag TEXT;
ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS chapter_tag TEXT;

-- B1) join_class: canonical school roadmap creator + force activation
DROP FUNCTION IF EXISTS public.join_class_by_invite(TEXT);
DROP FUNCTION IF EXISTS public.join_class(TEXT);
CREATE FUNCTION public.join_class(p_class_code TEXT) RETURNS TABLE(out_class_id UUID, out_roadmap_id UUID) AS $$
DECLARE v_target_class RECORD; v_new_roadmap_id UUID; v_template_record RECORD; v_test_calendar JSONB; v_t RECORD; v_week_offset INTEGER;
BEGIN
  SELECT * INTO v_target_class FROM public.classes WHERE class_code ILIKE p_class_code;
  IF v_target_class IS NULL THEN RAISE EXCEPTION 'Invalid class code: %', p_class_code; END IF;
  EXECUTE format('INSERT INTO public.class_members (class_id,%I) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    (SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='class_members' AND column_name IN ('user_id','student_id') LIMIT 1)
  ) USING v_target_class.id, auth.uid();
  UPDATE public.student_roadmaps SET is_active=FALSE, updated_at=NOW() WHERE user_id=auth.uid() AND is_active=TRUE;
  IF v_target_class.template_id IS NOT NULL THEN
    SELECT * INTO v_template_record FROM public.coaching_templates WHERE id=v_target_class.template_id;
    IF v_template_record IS NOT NULL THEN
      INSERT INTO public.student_roadmaps (user_id,template_id,institute_name,batch_name,program,year_level,start_date,current_week,is_active,custom_overrides,scope,class_id,locked_by_school,created_from)
      VALUES (auth.uid(),v_target_class.template_id,COALESCE(v_template_record.institute_name,v_target_class.name,'School'),'Standard',COALESCE(v_template_record.program,'JEE'),COALESCE(v_template_record.year_level,NULL),CURRENT_DATE,1,TRUE,'{}','school',v_target_class.id,TRUE,'join_class')
      RETURNING public.student_roadmaps.id INTO v_new_roadmap_id;
      v_test_calendar:=COALESCE(v_template_record.test_calendar,'[]'::jsonb);
      FOR v_t IN SELECT * FROM jsonb_array_elements(v_test_calendar) LOOP
        v_week_offset:=COALESCE((v_t.value->>'week')::int,1)-1;
        INSERT INTO public.upcoming_tests (user_id,roadmap_id,test_name,test_date,test_type,syllabus,duration_minutes,total_marks,status)
        VALUES (auth.uid(),v_new_roadmap_id,v_t.value->>'name',CURRENT_DATE+(v_week_offset*7),COALESCE(v_t.value->>'type','phase_test'),v_t.value->>'syllabus',COALESCE((v_t.value->>'duration_minutes')::int,180),COALESCE((v_t.value->>'total_marks')::int,300),'upcoming');
      END LOOP;
    END IF;
  ELSIF v_target_class.custom_curriculum IS NOT NULL THEN
    INSERT INTO public.student_roadmaps (user_id,template_id,institute_name,batch_name,program,year_level,start_date,current_week,is_active,custom_overrides,scope,class_id,locked_by_school,created_from)
    VALUES (auth.uid(),NULL,COALESCE(v_target_class.name,'School'),'Custom','JEE',NULL,CURRENT_DATE,1,TRUE,v_target_class.custom_curriculum,'school',v_target_class.id,TRUE,'join_class')
    RETURNING public.student_roadmaps.id INTO v_new_roadmap_id;
  END IF;
  UPDATE public.user_profiles SET account_type='school_student',updated_at=NOW() WHERE id=auth.uid() AND account_type!='school_student';
  RETURN QUERY SELECT v_target_class.id AS out_class_id, v_new_roadmap_id AS out_roadmap_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION public.join_class_by_invite(p_invite_link TEXT) RETURNS TABLE(out_class_id UUID, out_roadmap_id UUID) AS $$
DECLARE v_target_class RECORD;
BEGIN
  SELECT * INTO v_target_class FROM public.classes WHERE invite_link=p_invite_link;
  IF v_target_class IS NULL THEN RAISE EXCEPTION 'Invalid invite link: %', p_invite_link; END IF;
  RETURN QUERY SELECT * FROM public.join_class(v_target_class.class_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B2) set_active_roadmap: admin/teacher switcher
CREATE OR REPLACE FUNCTION public.set_active_roadmap(p_roadmap_id UUID) RETURNS VOID AS $$
DECLARE v_target RECORD; v_user_id UUID; v_caller_is_admin BOOLEAN; v_caller_is_teacher_of_class BOOLEAN;
BEGIN
  SELECT * INTO v_target FROM public.student_roadmaps WHERE id=p_roadmap_id;
  IF v_target IS NULL THEN RAISE EXCEPTION 'Roadmap not found'; END IF;
  v_user_id:=v_target.user_id;
  IF auth.uid()=v_user_id THEN
    IF v_target.locked_by_school THEN RAISE EXCEPTION 'This roadmap is locked by the school. Contact your teacher or admin to switch.'; END IF;
  ELSE
    SELECT COALESCE(is_admin,FALSE) INTO v_caller_is_admin FROM public.user_profiles WHERE id=auth.uid();
    SELECT EXISTS(SELECT 1 FROM public.classes WHERE id=v_target.class_id AND teacher_id=auth.uid()) INTO v_caller_is_teacher_of_class;
    IF NOT v_caller_is_admin AND NOT v_caller_is_teacher_of_class THEN RAISE EXCEPTION 'Only the student, their class teacher, or an admin can switch roadmaps'; END IF;
    IF v_target.locked_by_school AND NOT v_caller_is_admin THEN RAISE EXCEPTION 'This roadmap is locked by the school. Only admins can override.'; END IF;
  END IF;
  UPDATE public.student_roadmaps SET is_active=FALSE,updated_at=NOW() WHERE user_id=v_user_id AND is_active=TRUE AND id!=p_roadmap_id AND scope=v_target.scope;
  UPDATE public.student_roadmaps SET is_active=TRUE,updated_at=NOW() WHERE id=p_roadmap_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B4) log_class_sessions: accept class_id in JSON and store it
DROP FUNCTION IF EXISTS public.log_class_sessions(JSONB);
CREATE OR REPLACE FUNCTION public.log_class_sessions(p_rows JSONB) RETURNS VOID AS $$
DECLARE r JSONB; v_user_id UUID; v_class_id UUID;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    SELECT user_id INTO v_user_id FROM public.student_roadmaps WHERE id=(r->>'roadmap_id')::UUID;
    v_class_id:=COALESCE((r->>'class_id')::UUID,(SELECT class_id FROM public.student_roadmaps WHERE id=(r->>'roadmap_id')::UUID));
    INSERT INTO public.class_sessions (user_id,roadmap_id,class_id,teacher_id,session_date,subject,topics_covered,homework_assigned,duration_minutes)
    VALUES (v_user_id,(r->>'roadmap_id')::UUID,v_class_id,(r->>'teacher_id')::UUID,COALESCE((r->>'session_date')::DATE,CURRENT_DATE),r->>'subject',ARRAY(SELECT jsonb_array_elements_text(r->'topics_covered')),r->>'homework_assigned',COALESCE((r->>'duration_minutes')::INTEGER,0));
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
