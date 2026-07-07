-- REDEFINE join_class and join_class_by_invite to restrict joins by school email domain
DROP FUNCTION IF EXISTS public.join_class_by_invite(TEXT);
DROP FUNCTION IF EXISTS public.join_class(TEXT);

CREATE OR REPLACE FUNCTION public.join_class(p_class_code TEXT) 
RETURNS TABLE(out_class_id UUID, out_roadmap_id UUID) AS $$
DECLARE 
  v_target_class RECORD; 
  v_new_roadmap_id UUID; 
  v_template_record RECORD; 
  v_test_calendar JSONB; 
  v_t RECORD; 
  v_week_offset INTEGER;
  v_student_email TEXT;
  v_teacher_email TEXT;
  v_student_domain TEXT;
  v_teacher_domain TEXT;
  v_is_public_domain BOOLEAN;
BEGIN
  -- 1. Locate the class
  SELECT * INTO v_target_class FROM public.classes WHERE class_code ILIKE p_class_code;
  IF v_target_class IS NULL THEN RAISE EXCEPTION 'Invalid class code: %', p_class_code; END IF;

  -- 2. Extract domains and enforce school restriction
  SELECT email INTO v_student_email FROM public.user_profiles WHERE id = auth.uid();
  SELECT email INTO v_teacher_email FROM public.user_profiles WHERE id = v_target_class.teacher_id;
  
  v_student_domain := lower(split_part(v_student_email, '@', 2));
  v_teacher_domain := lower(split_part(v_teacher_email, '@', 2));
  
  -- Common public email domains that should bypass the restriction
  v_is_public_domain := v_student_domain IN (
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
    'aol.com', 'icloud.com', 'zoho.com', 'mail.com', 'live.com'
  );
  
  IF NOT v_is_public_domain AND v_student_domain IS NOT NULL AND v_teacher_domain IS NOT NULL THEN
    IF NOT (
      v_student_domain = v_teacher_domain OR
      v_student_domain LIKE '%.' || v_teacher_domain OR
      v_teacher_domain LIKE '%.' || v_student_domain
    ) THEN
      RAISE EXCEPTION 'School mismatch: This class is restricted to members of the teacher''s school';
    END IF;
  END IF;

  -- 3. Add to class_members
  EXECUTE format('INSERT INTO public.class_members (class_id,%I) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    (SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='class_members' AND column_name IN ('user_id','student_id') LIMIT 1)
  ) USING v_target_class.id, auth.uid();
  
  -- 4. Mark old roadmaps inactive
  UPDATE public.student_roadmaps SET is_active=FALSE, updated_at=NOW() WHERE user_id=auth.uid() AND is_active=TRUE;
  
  -- 5. Create roadmap
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
  
  -- 6. Update profile account type
  UPDATE public.user_profiles SET account_type='school_student',updated_at=NOW() WHERE id=auth.uid() AND account_type!='school_student';
  
  RETURN QUERY SELECT v_target_class.id AS out_class_id, v_new_roadmap_id AS out_roadmap_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.join_class_by_invite(p_invite_link TEXT) 
RETURNS TABLE(out_class_id UUID, out_roadmap_id UUID) AS $$
DECLARE 
  v_target_class RECORD;
BEGIN
  SELECT * INTO v_target_class FROM public.classes WHERE invite_link=p_invite_link;
  IF v_target_class IS NULL THEN RAISE EXCEPTION 'Invalid invite link: %', p_invite_link; END IF;
  RETURN QUERY SELECT * FROM public.join_class(v_target_class.class_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
