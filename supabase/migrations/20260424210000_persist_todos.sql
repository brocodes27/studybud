-- ============================================
-- Persist TodoTracker to Supabase
-- Replaces localStorage-only storage with cross-device sync.
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  category TEXT NOT NULL DEFAULT 'regular' CHECK (category IN ('urgent', 'regular', 'backlog')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_todos_user ON public.user_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_todos_completed ON public.user_todos(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_user_todos_category ON public.user_todos(user_id, category);
-- Updated_at auto-maintenance
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_todos_updated_at'
  ) THEN
    CREATE TRIGGER trg_user_todos_updated_at
      BEFORE UPDATE ON public.user_todos
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
-- RLS
ALTER TABLE public.user_todos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_todos' AND policyname='user_todos_select_own'
  ) THEN
    CREATE POLICY user_todos_select_own ON public.user_todos FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_todos' AND policyname='user_todos_insert_own'
  ) THEN
    CREATE POLICY user_todos_insert_own ON public.user_todos FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_todos' AND policyname='user_todos_update_own'
  ) THEN
    CREATE POLICY user_todos_update_own ON public.user_todos FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_todos' AND policyname='user_todos_delete_own'
  ) THEN
    CREATE POLICY user_todos_delete_own ON public.user_todos FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
