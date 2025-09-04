-- Curriculum data model
-- Tables: curriculum_plans, monthly_curricula, curriculum_tasks
-- Includes RLS, helpful indexes, and updated_at trigger

create table if not exists public.curriculum_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  aim text not null check (aim in ('cbse','jee')),
  class_level text,
  subjects text[] default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_curriculum_plans_user on public.curriculum_plans(user_id);
create index if not exists idx_curriculum_plans_user_active on public.curriculum_plans(user_id, is_active);

alter table public.curriculum_plans enable row level security;

-- Policies for curriculum_plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='curriculum_plans' AND policyname='curriculum_plans_select_own'
  ) THEN
    CREATE POLICY curriculum_plans_select_own ON public.curriculum_plans FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='curriculum_plans' AND policyname='curriculum_plans_insert_own'
  ) THEN
    CREATE POLICY curriculum_plans_insert_own ON public.curriculum_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='curriculum_plans' AND policyname='curriculum_plans_update_own'
  ) THEN
    CREATE POLICY curriculum_plans_update_own ON public.curriculum_plans FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='curriculum_plans' AND policyname='curriculum_plans_delete_own'
  ) THEN
    CREATE POLICY curriculum_plans_delete_own ON public.curriculum_plans FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Monthly curricula, one row per month per curriculum
create table if not exists public.monthly_curricula (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  curriculum_id uuid not null references public.curriculum_plans(id) on delete cascade,
  month_start date not null,
  month_end date not null,
  plan jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_curricula_unique unique(curriculum_id, month_start)
);

create index if not exists idx_monthly_curricula_user_month on public.monthly_curricula(user_id, month_start);
create index if not exists idx_monthly_curricula_curriculum on public.monthly_curricula(curriculum_id);

alter table public.monthly_curricula enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='monthly_curricula' AND policyname='monthly_curricula_select_own'
  ) THEN
    CREATE POLICY monthly_curricula_select_own ON public.monthly_curricula FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='monthly_curricula' AND policyname='monthly_curricula_insert_own'
  ) THEN
    CREATE POLICY monthly_curricula_insert_own ON public.monthly_curricula FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='monthly_curricula' AND policyname='monthly_curricula_update_own'
  ) THEN
    CREATE POLICY monthly_curricula_update_own ON public.monthly_curricula FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='monthly_curricula' AND policyname='monthly_curricula_delete_own'
  ) THEN
    CREATE POLICY monthly_curricula_delete_own ON public.monthly_curricula FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Curriculum tasks: daily tasks derived from monthly curricula and exam plans
create table if not exists public.curriculum_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  curriculum_id uuid not null references public.curriculum_plans(id) on delete cascade,
  source text not null default 'monthly' check (source in ('monthly','exam','manual')),
  plan_id uuid references public.exam_plans(id) on delete cascade,
  task_date date not null,
  subject text,
  title text,
  description text,
  status text not null default 'pending' check (status in ('pending','completed','skipped','rescheduled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_curriculum_tasks_user_date on public.curriculum_tasks(user_id, task_date);
create index if not exists idx_curriculum_tasks_curriculum_date on public.curriculum_tasks(curriculum_id, task_date);
create index if not exists idx_curriculum_tasks_plan on public.curriculum_tasks(plan_id);
create index if not exists idx_curriculum_tasks_status on public.curriculum_tasks(status);

alter table public.curriculum_tasks enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='curriculum_tasks' AND policyname='curriculum_tasks_select_own'
  ) THEN
    CREATE POLICY curriculum_tasks_select_own ON public.curriculum_tasks FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='curriculum_tasks' AND policyname='curriculum_tasks_insert_own'
  ) THEN
    CREATE POLICY curriculum_tasks_insert_own ON public.curriculum_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='curriculum_tasks' AND policyname='curriculum_tasks_update_own'
  ) THEN
    CREATE POLICY curriculum_tasks_update_own ON public.curriculum_tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='curriculum_tasks' AND policyname='curriculum_tasks_delete_own'
  ) THEN
    CREATE POLICY curriculum_tasks_delete_own ON public.curriculum_tasks FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Triggers for updated_at on all three tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE t.tgname='curriculum_plans_set_updated_at' AND n.nspname='public' AND c.relname='curriculum_plans'
  ) THEN
    CREATE TRIGGER curriculum_plans_set_updated_at BEFORE UPDATE ON public.curriculum_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE t.tgname='monthly_curricula_set_updated_at' AND n.nspname='public' AND c.relname='monthly_curricula'
  ) THEN
    CREATE TRIGGER monthly_curricula_set_updated_at BEFORE UPDATE ON public.monthly_curricula FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE t.tgname='curriculum_tasks_set_updated_at' AND n.nspname='public' AND c.relname='curriculum_tasks'
  ) THEN
    CREATE TRIGGER curriculum_tasks_set_updated_at BEFORE UPDATE ON public.curriculum_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
