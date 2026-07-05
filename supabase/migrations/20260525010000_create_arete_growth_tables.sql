-- ============================================
-- Arete Phase 2: Structure & Growth Tables
-- ============================================

-- 1. Growth Profiles Table
CREATE TABLE IF NOT EXISTS public.arete_growth_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clarity_score INTEGER NOT NULL DEFAULT 50 CHECK (clarity_score >= 0 AND clarity_score <= 100),
  difficulty_zone NUMERIC NOT NULL DEFAULT 1.0,
  flow_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_user_growth UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_arete_growth_profiles_user ON public.arete_growth_profiles(user_id);
-- RLS for Growth Profiles
ALTER TABLE public.arete_growth_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_growth_profiles' AND policyname='arete_growth_select_own'
  ) THEN
    CREATE POLICY arete_growth_select_own ON public.arete_growth_profiles
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_growth_profiles' AND policyname='arete_growth_insert_own'
  ) THEN
    CREATE POLICY arete_growth_insert_own ON public.arete_growth_profiles
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_growth_profiles' AND policyname='arete_growth_update_own'
  ) THEN
    CREATE POLICY arete_growth_update_own ON public.arete_growth_profiles
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_growth_profiles' AND policyname='arete_growth_delete_own'
  ) THEN
    CREATE POLICY arete_growth_delete_own ON public.arete_growth_profiles
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
-- 2. Daily Paths Table
CREATE TABLE IF NOT EXISTS public.arete_daily_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  briefing_message TEXT NOT NULL,
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { id, title, description, completed, feedback }
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_user_daily_path UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_arete_daily_paths_user ON public.arete_daily_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_arete_daily_paths_date ON public.arete_daily_paths(date);
-- RLS for Daily Paths
ALTER TABLE public.arete_daily_paths ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_daily_paths' AND policyname='arete_path_select_own'
  ) THEN
    CREATE POLICY arete_path_select_own ON public.arete_daily_paths
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_daily_paths' AND policyname='arete_path_insert_own'
  ) THEN
    CREATE POLICY arete_path_insert_own ON public.arete_daily_paths
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_daily_paths' AND policyname='arete_path_update_own'
  ) THEN
    CREATE POLICY arete_path_update_own ON public.arete_daily_paths
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='arete_daily_paths' AND policyname='arete_path_delete_own'
  ) THEN
    CREATE POLICY arete_path_delete_own ON public.arete_daily_paths
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
-- 3. Triggers for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_arete_growth_profiles_updated_at'
  ) THEN
    CREATE TRIGGER trg_arete_growth_profiles_updated_at
      BEFORE UPDATE ON public.arete_growth_profiles
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_arete_daily_paths_updated_at'
  ) THEN
    CREATE TRIGGER trg_arete_daily_paths_updated_at
      BEFORE UPDATE ON public.arete_daily_paths
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
