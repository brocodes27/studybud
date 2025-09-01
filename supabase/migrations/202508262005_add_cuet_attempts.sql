-- Create CUET attempts and answers tables
-- Requires: existing table cuet_questions(id bigint primary key, subject text, topic text, question text, answer_index int, source text)

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

create policy "cuet_attempts_select_own" on public.cuet_attempts
  for select using (auth.uid() = user_id);
create policy "cuet_attempts_insert_own" on public.cuet_attempts
  for insert with check (auth.uid() = user_id);
create policy "cuet_attempts_update_own" on public.cuet_attempts
  for update using (auth.uid() = user_id);

create index if not exists cuet_attempts_user_id_idx on public.cuet_attempts(user_id);
create index if not exists cuet_attempts_subject_idx on public.cuet_attempts(subject);

-- Answers table
create table if not exists public.cuet_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.cuet_attempts(id) on delete cascade,
  question_id bigint not null references public.cuet_questions(id) on delete cascade,
  selected_index integer,
  correct_index integer,
  is_correct boolean,
  time_spent_ms integer default 0,
  marked_for_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cuet_attempt_answers enable row level security;

create policy "cuet_answers_select_own" on public.cuet_attempt_answers
  for select using (exists (
    select 1 from public.cuet_attempts a where a.id = attempt_id and a.user_id = auth.uid()
  ));
create policy "cuet_answers_upsert_own" on public.cuet_attempt_answers
  for insert with check (exists (
    select 1 from public.cuet_attempts a where a.id = attempt_id and a.user_id = auth.uid()
  ));
create policy "cuet_answers_update_own" on public.cuet_attempt_answers
  for update using (exists (
    select 1 from public.cuet_attempts a where a.id = attempt_id and a.user_id = auth.uid()
  ));

create index if not exists cuet_answers_attempt_id_idx on public.cuet_attempt_answers(attempt_id);
create index if not exists cuet_answers_question_id_idx on public.cuet_attempt_answers(question_id);

-- Trigger to update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

drop trigger if exists trg_cuet_answers_updated_at on public.cuet_attempt_answers;
create trigger trg_cuet_answers_updated_at before update on public.cuet_attempt_answers
for each row execute function public.set_updated_at();
