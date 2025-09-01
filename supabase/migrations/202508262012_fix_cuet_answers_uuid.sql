-- Ensure cuet_attempts and cuet_attempt_answers exist with correct types
-- Use UUID for cuet_questions.id references

-- Create attempts table if missing
create table if not exists public.cuet_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  config jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  duration_sec integer,
  summary jsonb,
  created_at timestamptz not null default now()
);

alter table public.cuet_attempts enable row level security;

drop policy if exists "cuet_attempts_select_own" on public.cuet_attempts;
create policy "cuet_attempts_select_own" on public.cuet_attempts
  for select using (auth.uid() = user_id);
drop policy if exists "cuet_attempts_insert_own" on public.cuet_attempts;
create policy "cuet_attempts_insert_own" on public.cuet_attempts
  for insert with check (auth.uid() = user_id);
drop policy if exists "cuet_attempts_update_own" on public.cuet_attempts;
create policy "cuet_attempts_update_own" on public.cuet_attempts
  for update using (auth.uid() = user_id);

create index if not exists cuet_attempts_user_id_idx on public.cuet_attempts(user_id);
create index if not exists cuet_attempts_subject_idx on public.cuet_attempts(subject);

-- Create answers table (UUID FK to cuet_questions)
create table if not exists public.cuet_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.cuet_attempts(id) on delete cascade,
  question_id uuid not null references public.cuet_questions(id) on delete cascade,
  selected_index integer,
  correct_index integer,
  is_correct boolean,
  time_spent_ms integer default 0,
  marked_for_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cuet_attempt_answers enable row level security;

drop policy if exists "cuet_answers_select_own" on public.cuet_attempt_answers;
create policy "cuet_answers_select_own" on public.cuet_attempt_answers
  for select using (exists (
    select 1 from public.cuet_attempts a where a.id = attempt_id and a.user_id = auth.uid()
  ));
drop policy if exists "cuet_answers_upsert_own" on public.cuet_attempt_answers;
create policy "cuet_answers_upsert_own" on public.cuet_attempt_answers
  for insert with check (exists (
    select 1 from public.cuet_attempts a where a.id = attempt_id and a.user_id = auth.uid()
  ));
drop policy if exists "cuet_answers_update_own" on public.cuet_attempt_answers;
create policy "cuet_answers_update_own" on public.cuet_attempt_answers
  for update using (exists (
    select 1 from public.cuet_attempts a where a.id = attempt_id and a.user_id = auth.uid()
  ));

create index if not exists cuet_answers_attempt_id_idx on public.cuet_attempt_answers(attempt_id);
create index if not exists cuet_answers_question_id_idx on public.cuet_attempt_answers(question_id);

-- If the answers table exists with wrong type, fix it
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cuet_attempt_answers' and column_name = 'question_id' and data_type <> 'uuid'
  ) then
    -- drop existing fk if present
    if exists (
      select 1 from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_name = kcu.table_name
      where tc.table_schema = 'public' and tc.table_name = 'cuet_attempt_answers' and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'question_id'
    ) then
      alter table public.cuet_attempt_answers drop constraint if exists cuet_attempt_answers_question_id_fkey;
    end if;
    -- convert type
    alter table public.cuet_attempt_answers alter column question_id type uuid using question_id::uuid;
    -- re-add FK
    alter table public.cuet_attempt_answers add constraint cuet_attempt_answers_question_id_fkey foreign key (question_id) references public.cuet_questions(id) on delete cascade;
  end if;
end$$;

-- Trigger for updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

drop trigger if exists trg_cuet_answers_updated_at on public.cuet_attempt_answers;
create trigger trg_cuet_answers_updated_at before update on public.cuet_attempt_answers
for each row execute function public.set_updated_at();
