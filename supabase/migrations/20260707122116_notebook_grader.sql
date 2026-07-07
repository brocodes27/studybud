-- ============================================
-- Notebook Grader Machine: control-plane schema
-- (grading_sessions / grading_pages + storage + RLS + realtime)
-- ============================================

-- 1) Grading sessions: one per student notebook / exam-sheet sitting.
--    The laptop (Grader Console) writes `command` + bumps `command_seq`;
--    the device agent on grader.local observes UPDATEs via Realtime.
CREATE TABLE IF NOT EXISTS public.grading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  device_id TEXT NOT NULL,
  test_name TEXT NOT NULL DEFAULT 'Notebook Check',
  question_paper JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'capturing'
    CHECK (status IN ('capturing','paused','checking','graded','failed','cancelled')),
  command TEXT,
  command_seq INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  result JSONB DEFAULT '{}',
  test_result_id UUID REFERENCES public.test_results(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grading_sessions_device ON public.grading_sessions(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grading_sessions_teacher ON public.grading_sessions(teacher_id, created_at DESC);

-- 2) Captured pages manifest
CREATE TABLE IF NOT EXISTS public.grading_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.grading_sessions(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  ocr_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_grading_pages_session ON public.grading_pages(session_id, page_number);

-- 3) RLS
ALTER TABLE public.grading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_pages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='grading_sessions' AND policyname='grading_sessions_teacher_all') THEN
    CREATE POLICY grading_sessions_teacher_all ON public.grading_sessions
      FOR ALL TO authenticated
      USING (auth.uid() = teacher_id)
      WITH CHECK (auth.uid() = teacher_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='grading_sessions' AND policyname='grading_sessions_student_select') THEN
    CREATE POLICY grading_sessions_student_select ON public.grading_sessions
      FOR SELECT TO authenticated
      USING (auth.uid() = student_user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='grading_sessions' AND policyname='grading_sessions_service_all') THEN
    CREATE POLICY grading_sessions_service_all ON public.grading_sessions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='grading_pages' AND policyname='grading_pages_teacher_select') THEN
    CREATE POLICY grading_pages_teacher_select ON public.grading_pages
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.grading_sessions s WHERE s.id = session_id AND s.teacher_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='grading_pages' AND policyname='grading_pages_service_all') THEN
    CREATE POLICY grading_pages_service_all ON public.grading_pages
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4) updated_at maintenance (only if the shared trigger fn exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'set_updated_at') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'grading_sessions_set_updated_at') THEN
      CREATE TRIGGER grading_sessions_set_updated_at BEFORE UPDATE ON public.grading_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
  END IF;
END $$;

-- 5) Realtime: laptop <-> device control plane
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'grading_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.grading_sessions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'grading_pages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.grading_pages;
  END IF;
END $$;

-- 6) Storage bucket for captured notebook page scans
INSERT INTO storage.buckets (id, name, public)
VALUES ('notebook-scans', 'notebook-scans', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated can view notebook scans'
  ) THEN
    CREATE POLICY "Authenticated can view notebook scans"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'notebook-scans');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated can upload notebook scans'
  ) THEN
    CREATE POLICY "Authenticated can upload notebook scans"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'notebook-scans');
  END IF;
END $$;

-- 7) Teacher visibility of appended results in the class dashboard.
--    (Verified: no existing teacher SELECT policy on public.test_results.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='test_results' AND policyname='test_results_select_teacher') THEN
    CREATE POLICY test_results_select_teacher ON public.test_results
      FOR SELECT TO authenticated
      USING (
        class_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.classes c
          WHERE c.id = test_results.class_id AND c.teacher_id = auth.uid()
        )
      );
  END IF;
END $$;
