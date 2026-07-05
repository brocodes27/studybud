-- Create exam_plans table (idempotent) with RLS, indexes, and updated_at trigger
-- This migration is safe to re-run.

create table if not exists public.exam_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_name text,
  class text not null,
  subject text not null,
  chapters text not null,
  exam_date date not null,
  plan jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Helpful indexes
create index if not exists idx_exam_plans_user_created_at
  on public.exam_plans(user_id, created_at);
create index if not exists idx_exam_plans_user
  on public.exam_plans(user_id);
create index if not exists idx_exam_plans_exam_date
  on public.exam_plans(exam_date);
-- Enable RLS
alter table public.exam_plans enable row level security;
-- Policies (guard with DO blocks as CREATE POLICY lacks IF NOT EXISTS on some Postgres versions)
-- SELECT own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exam_plans' AND policyname = 'exam_plans_select_own'
  ) THEN
    CREATE POLICY exam_plans_select_own ON public.exam_plans
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
-- INSERT own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exam_plans' AND policyname = 'exam_plans_insert_own'
  ) THEN
    CREATE POLICY exam_plans_insert_own ON public.exam_plans
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
-- UPDATE own (ensure both USING and WITH CHECK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exam_plans' AND policyname = 'exam_plans_update_own'
  ) THEN
    CREATE POLICY exam_plans_update_own ON public.exam_plans
      FOR UPDATE USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
-- DELETE own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exam_plans' AND policyname = 'exam_plans_delete_own'
  ) THEN
    CREATE POLICY exam_plans_delete_own ON public.exam_plans
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
-- Ensure updated_at is maintained on UPDATE
-- Assumes public.set_updated_at() exists (created in an earlier migration). Guard trigger creation.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class rel ON rel.oid = t.tgrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE t.tgname = 'exam_plans_set_updated_at'
      AND nsp.nspname = 'public'
      AND rel.relname = 'exam_plans'
  ) THEN
    CREATE TRIGGER exam_plans_set_updated_at
    BEFORE UPDATE ON public.exam_plans
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
