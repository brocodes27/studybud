-- Ensure task_completions table exists with created_at and helpful indexes/RLS
-- This migration is idempotent and safe to run if the table already exists.

-- Create table if missing
create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.exam_plans(id) on delete cascade,
  day_number integer not null check (day_number >= 1),
  task_type text,
  created_at timestamptz not null default now()
);

-- Add created_at if the table existed without it
alter table public.task_completions
  add column if not exists created_at timestamptz;

-- Backfill created_at where null
update public.task_completions
  set created_at = now()
  where created_at is null;

-- Enforce not null and default on created_at
alter table public.task_completions
  alter column created_at set default now();

alter table public.task_completions
  alter column created_at set not null;

-- De-duplicate existing rows before adding unique index
-- Keep the earliest created_at (then lowest id) per (user_id, plan_id, day_number)
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, plan_id, day_number
      order by created_at asc, id asc
    ) as rn
  from public.task_completions
)
delete from public.task_completions t
using ranked r
where t.id = r.id and r.rn > 1;

-- Helpful uniqueness to prevent duplicates per user/plan/day
-- Use a unique index (idempotent) rather than a named constraint for IF NOT EXISTS behavior
create unique index if not exists idx_task_completions_unique_user_plan_day
  on public.task_completions(user_id, plan_id, day_number);

-- Additional indexes for common queries
create index if not exists idx_task_completions_user_created_at
  on public.task_completions(user_id, created_at);

create index if not exists idx_task_completions_plan_day
  on public.task_completions(plan_id, day_number);

create index if not exists idx_task_completions_user
  on public.task_completions(user_id);

create index if not exists idx_task_completions_plan
  on public.task_completions(plan_id);

-- Enable RLS and policies (idempotent)
alter table public.task_completions enable row level security;

-- CREATE POLICY does not support IF NOT EXISTS in Postgres, so guard with DO blocks
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_completions'
      and policyname = 'task_completions_select_own'
  ) then
    create policy task_completions_select_own on public.task_completions
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_completions'
      and policyname = 'task_completions_insert_own'
  ) then
    create policy task_completions_insert_own on public.task_completions
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_completions'
      and policyname = 'task_completions_update_own'
  ) then
    create policy task_completions_update_own on public.task_completions
      for update using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_completions'
      and policyname = 'task_completions_delete_own'
  ) then
    create policy task_completions_delete_own on public.task_completions
      for delete using (auth.uid() = user_id);
  end if;
end $$;
