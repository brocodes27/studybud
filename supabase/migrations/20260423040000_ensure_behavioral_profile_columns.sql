-- ============================================
-- Ensure student_behavioral_profiles has all
-- expected columns, even if the table was
-- created by an older migration with a
-- reduced schema.
--
-- Safe/idempotent: ADD COLUMN IF NOT EXISTS.
-- ============================================

-- Guarantee the table exists (no-op if already present)
CREATE TABLE IF NOT EXISTS public.student_behavioral_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Bring all expected columns into existence
ALTER TABLE public.student_behavioral_profiles
  ADD COLUMN IF NOT EXISTS preferred_time TEXT DEFAULT 'evening',
  ADD COLUMN IF NOT EXISTS typical_session_duration_min INTEGER DEFAULT 90,
  ADD COLUMN IF NOT EXISTS weak_subjects TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS strong_subjects TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stress_signals JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS backlog_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missed_days_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS typical_slump_day TEXT,
  ADD COLUMN IF NOT EXISTS response_to_low_score TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure the unique constraint on user_id exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.student_behavioral_profiles'::regclass
      AND contype = 'u'
      AND conname = 'student_behavioral_profiles_user_id_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'student_behavioral_profiles'
      AND indexname = 'student_behavioral_profiles_user_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.student_behavioral_profiles
        ADD CONSTRAINT student_behavioral_profiles_user_id_key UNIQUE (user_id);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- already covered by another unique index
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_behavioral_profiles_user
  ON public.student_behavioral_profiles(user_id);

-- Force PostgREST to reload its schema cache so the new columns
-- are visible immediately (fixes PGRST204 errors).
NOTIFY pgrst, 'reload schema';
