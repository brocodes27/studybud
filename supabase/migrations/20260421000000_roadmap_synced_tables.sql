-- ============================================
-- Roadmap-Synced Preparation OS — Core Tables
-- Idempotent migration: safe to re-run
-- ============================================

-- 1. Coaching Templates (Institute/Batch Blueprints)
CREATE TABLE IF NOT EXISTS public.coaching_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  program TEXT NOT NULL DEFAULT 'JEE',
  test_calendar JSONB DEFAULT '[]',
  syllabus_map JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Student Roadmaps (Active Batch Enrollment)
CREATE TABLE IF NOT EXISTS public.student_roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.coaching_templates(id) ON DELETE SET NULL,
  institute_name TEXT NOT NULL DEFAULT 'Self Study',
  batch_name TEXT NOT NULL DEFAULT 'Standard',
  program TEXT NOT NULL DEFAULT 'JEE',
  year_level INTEGER,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_week INTEGER NOT NULL DEFAULT 1,
  custom_overrides JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_roadmaps_user ON public.student_roadmaps(user_id);
CREATE INDEX IF NOT EXISTS idx_student_roadmaps_active ON public.student_roadmaps(user_id, is_active);

ALTER TABLE public.student_roadmaps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_roadmaps' AND policyname='roadmaps_select_own') THEN
    CREATE POLICY roadmaps_select_own ON public.student_roadmaps FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_roadmaps' AND policyname='roadmaps_insert_own') THEN
    CREATE POLICY roadmaps_insert_own ON public.student_roadmaps FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_roadmaps' AND policyname='roadmaps_update_own') THEN
    CREATE POLICY roadmaps_update_own ON public.student_roadmaps FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Class Sessions (What Was Taught Today)
CREATE TABLE IF NOT EXISTS public.class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES public.student_roadmaps(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subject TEXT NOT NULL,
  topics_covered TEXT[] DEFAULT '{}',
  homework_assigned TEXT,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_sessions_roadmap_date ON public.class_sessions(roadmap_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_sessions_date ON public.class_sessions(session_date DESC);

ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

-- Ensure teacher_id exists (for idempotent re-runs)
ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='class_sessions' AND policyname='class_sessions_select_member') THEN
    CREATE POLICY class_sessions_select_member ON public.class_sessions FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.student_roadmaps sr WHERE sr.id = class_sessions.roadmap_id AND sr.user_id = auth.uid())
      OR teacher_id = auth.uid()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='class_sessions' AND policyname='class_sessions_insert_teacher') THEN
    CREATE POLICY class_sessions_insert_teacher ON public.class_sessions FOR INSERT WITH CHECK (teacher_id = auth.uid());
  END IF;
END $$;

-- 4. Upcoming Tests (Test Calendar)
CREATE TABLE IF NOT EXISTS public.upcoming_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roadmap_id UUID NOT NULL REFERENCES public.student_roadmaps(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  test_date DATE NOT NULL,
  test_type TEXT NOT NULL DEFAULT 'phase_test',
  syllabus TEXT,
  duration_minutes INTEGER DEFAULT 180,
  total_marks INTEGER DEFAULT 300,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upcoming_tests_user ON public.upcoming_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_upcoming_tests_date ON public.upcoming_tests(test_date);
CREATE INDEX IF NOT EXISTS idx_upcoming_tests_roadmap ON public.upcoming_tests(roadmap_id);

ALTER TABLE public.upcoming_tests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='upcoming_tests' AND policyname='tests_select_own') THEN
    CREATE POLICY tests_select_own ON public.upcoming_tests FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='upcoming_tests' AND policyname='tests_insert_own') THEN
    CREATE POLICY tests_insert_own ON public.upcoming_tests FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Student Behavioral Profiles (Living Student-State Model)
CREATE TABLE IF NOT EXISTS public.student_behavioral_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_time TEXT DEFAULT 'evening',
  typical_session_duration_min INTEGER DEFAULT 90,
  weak_subjects TEXT[] DEFAULT '{}',
  strong_subjects TEXT[] DEFAULT '{}',
  stress_signals JSONB DEFAULT '{}',
  backlog_count INTEGER DEFAULT 0,
  missed_days_streak INTEGER DEFAULT 0,
  typical_slump_day TEXT,
  response_to_low_score TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_behavioral_profiles_user ON public.student_behavioral_profiles(user_id);

ALTER TABLE public.student_behavioral_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_behavioral_profiles' AND policyname='profiles_select_own') THEN
    CREATE POLICY profiles_select_own ON public.student_behavioral_profiles FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_behavioral_profiles' AND policyname='profiles_insert_own') THEN
    CREATE POLICY profiles_insert_own ON public.student_behavioral_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_behavioral_profiles' AND policyname='profiles_update_own') THEN
    CREATE POLICY profiles_update_own ON public.student_behavioral_profiles FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 6. Daily Prescriptions (AI-Generated Nightly Plan)
CREATE TABLE IF NOT EXISTS public.daily_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roadmap_id UUID REFERENCES public.student_roadmaps(id) ON DELETE CASCADE,
  prescription_date DATE NOT NULL,
  context_snapshot JSONB DEFAULT '{}',
  tasks JSONB DEFAULT '[]',
  implementation_intentions JSONB DEFAULT '[]',
  total_estimated_minutes INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, prescription_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_prescriptions_user_date ON public.daily_prescriptions(user_id, prescription_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_prescriptions_roadmap ON public.daily_prescriptions(roadmap_id);

ALTER TABLE public.daily_prescriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_prescriptions' AND policyname='prescriptions_select_own') THEN
    CREATE POLICY prescriptions_select_own ON public.daily_prescriptions FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_prescriptions' AND policyname='prescriptions_insert_own') THEN
    CREATE POLICY prescriptions_insert_own ON public.daily_prescriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_prescriptions' AND policyname='prescriptions_update_own') THEN
    CREATE POLICY prescriptions_update_own ON public.daily_prescriptions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 7. Test Results (Parsed Answer Sheets)
CREATE TABLE IF NOT EXISTS public.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  test_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist on idempotent re-runs (must come BEFORE indexes)
ALTER TABLE public.test_results ADD COLUMN IF NOT EXISTS roadmap_id UUID REFERENCES public.student_roadmaps(id) ON DELETE CASCADE;
ALTER TABLE public.test_results ADD COLUMN IF NOT EXISTS score_obtained INTEGER DEFAULT 0;
ALTER TABLE public.test_results ADD COLUMN IF NOT EXISTS score_total INTEGER DEFAULT 100;
ALTER TABLE public.test_results ADD COLUMN IF NOT EXISTS weak_topics JSONB DEFAULT '[]';
ALTER TABLE public.test_results ADD COLUMN IF NOT EXISTS failure_mode TEXT;
ALTER TABLE public.test_results ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'analyzed' CHECK (status IN ('pending', 'analyzed', 'corrected'));

CREATE INDEX IF NOT EXISTS idx_test_results_user ON public.test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_test_results_roadmap ON public.test_results(roadmap_id);

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='test_results' AND policyname='test_results_select_own') THEN
    CREATE POLICY test_results_select_own ON public.test_results FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='test_results' AND policyname='test_results_insert_own') THEN
    CREATE POLICY test_results_insert_own ON public.test_results FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 8. Correction Sprints (Post-Test Repair Plans)
CREATE TABLE IF NOT EXISTS public.correction_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist on idempotent re-runs (must come BEFORE indexes)
ALTER TABLE public.correction_sprints ADD COLUMN IF NOT EXISTS roadmap_id UUID REFERENCES public.student_roadmaps(id) ON DELETE CASCADE;
ALTER TABLE public.correction_sprints ADD COLUMN IF NOT EXISTS test_result_id UUID REFERENCES public.test_results(id) ON DELETE SET NULL;
ALTER TABLE public.correction_sprints ADD COLUMN IF NOT EXISTS sprint_name TEXT;
ALTER TABLE public.correction_sprints ADD COLUMN IF NOT EXISTS estimated_days INTEGER DEFAULT 3;
ALTER TABLE public.correction_sprints ADD COLUMN IF NOT EXISTS sprint_tasks JSONB DEFAULT '[]';
ALTER TABLE public.correction_sprints ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned'));
ALTER TABLE public.correction_sprints ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_correction_sprints_user ON public.correction_sprints(user_id);
CREATE INDEX IF NOT EXISTS idx_correction_sprints_active ON public.correction_sprints(user_id, status);
CREATE INDEX IF NOT EXISTS idx_correction_sprints_roadmap ON public.correction_sprints(roadmap_id);

ALTER TABLE public.correction_sprints ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='correction_sprints' AND policyname='sprints_select_own') THEN
    CREATE POLICY sprints_select_own ON public.correction_sprints FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='correction_sprints' AND policyname='sprints_insert_own') THEN
    CREATE POLICY sprints_insert_own ON public.correction_sprints FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='correction_sprints' AND policyname='sprints_update_own') THEN
    CREATE POLICY sprints_update_own ON public.correction_sprints FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
