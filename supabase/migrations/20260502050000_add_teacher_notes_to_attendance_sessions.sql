-- Add teacher notes interpretation columns
ALTER TABLE public.class_attendance_sessions
  ADD COLUMN IF NOT EXISTS teacher_notes TEXT,
  ADD COLUMN IF NOT EXISTS teacher_notes_interpreted TEXT,
  ADD COLUMN IF NOT EXISTS teacher_notes_file_url TEXT;

-- RLS for teacher notes (same as session)
ALTER TABLE public.class_attendance_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'class_attendance_sessions'
    AND policyname = 'attendance_sessions_teacher_notes_update'
  ) THEN
    CREATE POLICY attendance_sessions_teacher_notes_update
      ON public.class_attendance_sessions
      FOR UPDATE
      USING (teacher_id = auth.uid())
      WITH CHECK (teacher_id = auth.uid());
  END IF;
END $$;