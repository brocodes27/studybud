-- ============================================
-- Arete Phase 1: Discovery & Identity Tables
-- ============================================

-- 1. Identity Model Table
CREATE TABLE IF NOT EXISTS public.arete_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interests TEXT[] NOT NULL DEFAULT '{}',
  strengths TEXT[] NOT NULL DEFAULT '{}',
  energy_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,      -- { "peak_hours": "...", "draining_activities": [] }
  avoidance_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { "skipped_tasks": [] }
  snapshot TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_user_identity UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_arete_identities_user ON public.arete_identities(user_id);
-- RLS for Identities
ALTER TABLE public.arete_identities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_identities' AND policyname='arete_identity_select_own'
  ) THEN
    CREATE POLICY arete_identity_select_own ON public.arete_identities
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_identities' AND policyname='arete_identity_insert_own'
  ) THEN
    CREATE POLICY arete_identity_insert_own ON public.arete_identities
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_identities' AND policyname='arete_identity_update_own'
  ) THEN
    CREATE POLICY arete_identity_update_own ON public.arete_identities
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_identities' AND policyname='arete_identity_delete_own'
  ) THEN
    CREATE POLICY arete_identity_delete_own ON public.arete_identities
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
-- 2. Exploration Tasks Table
CREATE TABLE IF NOT EXISTS public.arete_exploration_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  completed BOOLEAN DEFAULT false NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_arete_exploration_tasks_user ON public.arete_exploration_tasks(user_id);
-- RLS for Exploration Tasks
ALTER TABLE public.arete_exploration_tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_exploration_tasks' AND policyname='arete_task_select_own'
  ) THEN
    CREATE POLICY arete_task_select_own ON public.arete_exploration_tasks
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_exploration_tasks' AND policyname='arete_task_insert_own'
  ) THEN
    CREATE POLICY arete_task_insert_own ON public.arete_exploration_tasks
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_exploration_tasks' AND policyname='arete_task_update_own'
  ) THEN
    CREATE POLICY arete_task_update_own ON public.arete_exploration_tasks
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_exploration_tasks' AND policyname='arete_task_delete_own'
  ) THEN
    CREATE POLICY arete_task_delete_own ON public.arete_exploration_tasks
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
-- 3. Reflections Table
CREATE TABLE IF NOT EXISTS public.arete_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_user_reflection_date UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_arete_reflections_user ON public.arete_reflections(user_id);
-- RLS for Reflections
ALTER TABLE public.arete_reflections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_reflections' AND policyname='arete_reflection_select_own'
  ) THEN
    CREATE POLICY arete_reflection_select_own ON public.arete_reflections
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_reflections' AND policyname='arete_reflection_insert_own'
  ) THEN
    CREATE POLICY arete_reflection_insert_own ON public.arete_reflections
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_reflections' AND policyname='arete_reflection_update_own'
  ) THEN
    CREATE POLICY arete_reflection_update_own ON public.arete_reflections
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_reflections' AND policyname='arete_reflection_delete_own'
  ) THEN
    CREATE POLICY arete_reflection_delete_own ON public.arete_reflections
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
-- 4. Triggers for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_arete_identities_updated_at'
  ) THEN
    CREATE TRIGGER trg_arete_identities_updated_at
      BEFORE UPDATE ON public.arete_identities
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_arete_exploration_tasks_updated_at'
  ) THEN
    CREATE TRIGGER trg_arete_exploration_tasks_updated_at
      BEFORE UPDATE ON public.arete_exploration_tasks
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_arete_reflections_updated_at'
  ) THEN
    CREATE TRIGGER trg_arete_reflections_updated_at
      BEFORE UPDATE ON public.arete_reflections
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
