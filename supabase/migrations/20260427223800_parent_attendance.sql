-- Parent dashboard + teacher-managed class attendance

CREATE TABLE IF NOT EXISTS public.class_attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subject TEXT,
  topics_covered TEXT[] DEFAULT '{}',
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, session_date)
);

CREATE TABLE IF NOT EXISTS public.class_attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_session_id UUID NOT NULL REFERENCES public.class_attendance_sessions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused', 'left_early')),
  minutes_late INTEGER DEFAULT 0,
  notes TEXT,
  marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(attendance_session_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.parent_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'parent',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  invite_code TEXT UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(parent_user_id, student_user_id)
);

ALTER TABLE public.student_behavioral_profiles ADD COLUMN IF NOT EXISTS attendance_rate_30d NUMERIC DEFAULT 1;
ALTER TABLE public.student_behavioral_profiles ADD COLUMN IF NOT EXISTS consecutive_absences INTEGER DEFAULT 0;
ALTER TABLE public.student_behavioral_profiles ADD COLUMN IF NOT EXISTS late_arrival_count_30d INTEGER DEFAULT 0;
ALTER TABLE public.student_behavioral_profiles ADD COLUMN IF NOT EXISTS last_absent_at DATE;
ALTER TABLE public.student_behavioral_profiles ADD COLUMN IF NOT EXISTS attendance_risk_level TEXT DEFAULT 'low' CHECK (attendance_risk_level IN ('low', 'medium', 'high'));

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_class_date ON public.class_attendance_sessions(class_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_records_class_student ON public.class_attendance_records(class_id, student_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_parent ON public.parent_student_links(parent_user_id, status);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_student ON public.parent_student_links(student_user_id, status);

ALTER TABLE public.class_attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='class_attendance_sessions' AND policyname='attendance_sessions_teacher_select') THEN
    CREATE POLICY attendance_sessions_teacher_select ON public.class_attendance_sessions FOR SELECT USING (
      teacher_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = class_attendance_sessions.class_id AND cm.student_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        JOIN public.class_members cm ON cm.student_id = psl.student_user_id
        WHERE psl.parent_user_id = auth.uid()
          AND psl.status = 'active'
          AND cm.class_id = class_attendance_sessions.class_id
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='class_attendance_sessions' AND policyname='attendance_sessions_teacher_write') THEN
    CREATE POLICY attendance_sessions_teacher_write ON public.class_attendance_sessions FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='class_attendance_records' AND policyname='attendance_records_select_related') THEN
    CREATE POLICY attendance_records_select_related ON public.class_attendance_records FOR SELECT USING (
      student_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_attendance_records.class_id AND c.teacher_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.parent_student_links psl WHERE psl.parent_user_id = auth.uid() AND psl.student_user_id = class_attendance_records.student_id AND psl.status = 'active')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='class_attendance_records' AND policyname='attendance_records_teacher_write') THEN
    CREATE POLICY attendance_records_teacher_write ON public.class_attendance_records FOR ALL USING (
      EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_attendance_records.class_id AND c.teacher_id = auth.uid())
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_attendance_records.class_id AND c.teacher_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='parent_student_links' AND policyname='parent_links_select_related') THEN
    CREATE POLICY parent_links_select_related ON public.parent_student_links FOR SELECT USING (parent_user_id = auth.uid() OR student_user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='parent_student_links' AND policyname='parent_links_parent_insert') THEN
    CREATE POLICY parent_links_parent_insert ON public.parent_student_links FOR INSERT WITH CHECK (parent_user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='parent_student_links' AND policyname='parent_links_update_related') THEN
    CREATE POLICY parent_links_update_related ON public.parent_student_links FOR UPDATE USING (parent_user_id = auth.uid() OR student_user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_student_attendance_summary(p_student_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE(
  total_sessions INTEGER,
  present_count INTEGER,
  absent_count INTEGER,
  late_count INTEGER,
  attendance_rate NUMERIC,
  consecutive_absences INTEGER,
  last_absent_at DATE
) AS $$
DECLARE
  v_start_date DATE := CURRENT_DATE - GREATEST(p_days, 1);
BEGIN
  RETURN QUERY
  WITH rows AS (
    SELECT ar.status, s.session_date
    FROM public.class_attendance_records ar
    JOIN public.class_attendance_sessions s ON s.id = ar.attendance_session_id
    WHERE ar.student_id = p_student_id
      AND s.session_date >= v_start_date
  ), ordered AS (
    SELECT status, session_date, row_number() OVER (ORDER BY session_date DESC) rn
    FROM rows
  ), first_non_absent AS (
    SELECT COALESCE(MIN(rn), 999999) rn FROM ordered WHERE status <> 'absent'
  )
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE status IN ('present', 'late', 'left_early'))::INTEGER,
    COUNT(*) FILTER (WHERE status = 'absent')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'late')::INTEGER,
    CASE WHEN COUNT(*) = 0 THEN 1 ELSE ROUND((COUNT(*) FILTER (WHERE status IN ('present', 'late', 'left_early'))::NUMERIC / COUNT(*)::NUMERIC), 2) END,
    COUNT(*) FILTER (WHERE ordered.rn < (SELECT rn FROM first_non_absent) AND status = 'absent')::INTEGER,
    MAX(session_date) FILTER (WHERE status = 'absent')
  FROM ordered;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.refresh_student_attendance_profile(p_student_id UUID)
RETURNS VOID AS $$
DECLARE
  v_summary RECORD;
BEGIN
  SELECT * INTO v_summary FROM public.get_student_attendance_summary(p_student_id, 30);

  INSERT INTO public.student_behavioral_profiles (
    user_id,
    attendance_rate_30d,
    consecutive_absences,
    late_arrival_count_30d,
    last_absent_at,
    attendance_risk_level
  ) VALUES (
    p_student_id,
    COALESCE(v_summary.attendance_rate, 1),
    COALESCE(v_summary.consecutive_absences, 0),
    COALESCE(v_summary.late_count, 0),
    v_summary.last_absent_at,
    CASE
      WHEN COALESCE(v_summary.consecutive_absences, 0) >= 3 OR COALESCE(v_summary.attendance_rate, 1) < 0.7 THEN 'high'
      WHEN COALESCE(v_summary.consecutive_absences, 0) >= 1 OR COALESCE(v_summary.attendance_rate, 1) < 0.85 THEN 'medium'
      ELSE 'low'
    END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    attendance_rate_30d = EXCLUDED.attendance_rate_30d,
    consecutive_absences = EXCLUDED.consecutive_absences,
    late_arrival_count_30d = EXCLUDED.late_arrival_count_30d,
    last_absent_at = EXCLUDED.last_absent_at,
    attendance_risk_level = EXCLUDED.attendance_risk_level,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_behavioral_profiles' AND policyname='behavior_profiles_parent_select') THEN
    CREATE POLICY behavior_profiles_parent_select ON public.student_behavioral_profiles FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        WHERE psl.parent_user_id = auth.uid()
          AND psl.student_user_id = student_behavioral_profiles.user_id
          AND psl.status = 'active'
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='test_results' AND policyname='test_results_parent_select') THEN
    CREATE POLICY test_results_parent_select ON public.test_results FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        WHERE psl.parent_user_id = auth.uid()
          AND psl.student_user_id = test_results.user_id
          AND psl.status = 'active'
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_prescriptions' AND policyname='daily_prescriptions_parent_select') THEN
    CREATE POLICY daily_prescriptions_parent_select ON public.daily_prescriptions FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        WHERE psl.parent_user_id = auth.uid()
          AND psl.student_user_id = daily_prescriptions.user_id
          AND psl.status = 'active'
      )
    );
  END IF;
END $$;
