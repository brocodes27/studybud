-- Drop function to create schools by normal users
DROP FUNCTION IF EXISTS public.create_school_and_admin(TEXT, TEXT, TEXT, TEXT);

-- Redefine handle_new_user trigger function to disable automatic school creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
DECLARE
  v_school_id UUID;
  v_school_name TEXT;
  v_domain TEXT;
  v_free_domains TEXT[] := ARRAY['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','mail.com','protonmail.com','yandex.com','zoho.com','aol.com','live.com','msn.com','qq.com','163.com','foxmail.com','rediffmail.com','ymail.com','rocketmail.com','gmx.com','gmx.net','mail.ru','bk.ru','inbox.ru','list.ru','rambler.ru','yandex.ru','ya.ru','tutanota.com','hey.com','fastmail.com','runbox.com','mailbox.org','disroot.org','riseup.net','cock.li','pm.me','proton.me'];
BEGIN
  v_school_name := NEW.raw_user_meta_data->>'school';
  v_domain := split_part(NEW.email, '@', 2);

  -- Auto-link by email domain ONLY if the school already exists in the database
  IF v_domain IS NOT NULL AND v_domain != '' AND NOT (v_domain = ANY(v_free_domains)) THEN
    SELECT id INTO v_school_id FROM public.schools WHERE domain = v_domain LIMIT 1;
  END IF;

  -- Insert profile
  INSERT INTO public.user_profiles (
    id, full_name, grade, school, school_id, email, role, account_type
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'grade',''),
    COALESCE(v_school_name, v_domain),
    v_school_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role','student'),
    COALESCE(
      NEW.raw_user_meta_data->>'account_type',
      CASE
        WHEN COALESCE(NEW.raw_user_meta_data->>'role','student') = 'teacher' THEN 'teacher'
        WHEN COALESCE(NEW.raw_user_meta_data->>'role','student') = 'school_admin' THEN 'school_admin'
        ELSE 'b2c_student'
      END
    )
  );

  -- Create school membership link if school was identified
  IF v_school_id IS NOT NULL THEN
    INSERT INTO public.memberships (user_id, school_id, role, status)
    VALUES (
      NEW.id,
      v_school_id,
      (CASE 
        WHEN COALESCE(NEW.raw_user_meta_data->>'role','student') = 'teacher' OR COALESCE(NEW.raw_user_meta_data->>'account_type','') = 'teacher' THEN 'teacher'::public.school_role
        WHEN COALESCE(NEW.raw_user_meta_data->>'role','student') = 'school_admin' OR COALESCE(NEW.raw_user_meta_data->>'account_type','') = 'school_admin' THEN 'org_admin'::public.school_role
        WHEN COALESCE(NEW.raw_user_meta_data->>'role','student') = 'parent' OR COALESCE(NEW.raw_user_meta_data->>'account_type','') = 'parent' THEN 'parent'::public.school_role
        ELSE 'student'::public.school_role
      END),
      'active'
    )
    ON CONFLICT (user_id, school_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
