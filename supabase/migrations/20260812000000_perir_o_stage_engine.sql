-- PERIR-O stage engine (PRD v2 §2, §5)
--
-- The topic spine already exists: curve_ensure_course_kc() canonicalizes every
-- syllabus topic into knowledge_components and maps it to curve_course_topics
-- with a kc_id and a week number. This migration adds the per-student stage
-- state on top of that spine, plus the two columns the planner needs.
--
-- Deliberately NOT added: a scheduled_on column on curve_course_topics. The
-- lecture date is term_start_on + (week - 1) * 7 and is derived at read time
-- in src/lib/perirO.ts. Storing it would mean rewriting every topic row when a
-- student corrects the term start.

-- ---------- 1. columns the planner needs ----------

alter table public.curve_courses
  add column if not exists term_start_on date;

comment on column public.curve_courses.term_start_on is
  'First day of week 1. Lecture dates for curve_course_topics are derived from '
  'this plus the topic week. Null means topics have no schedule, so the priming '
  'window override never fires for this course (PRD v2 §10).';

alter table public.curve_enrollments
  add column if not exists competitive_mode boolean not null default false;

comment on column public.curve_enrollments.competitive_mode is
  'Student opt-in. One of the two conditions that can unlock Overlearning, the '
  'other being an exam within 14 days. Never unlocks below stage=interleaved.';

-- ---------- 2. per-(enrollment, topic) stage state ----------

create table if not exists public.curve_topic_stage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null references public.curve_enrollments(id) on delete cascade,
  topic_id uuid not null references public.curve_course_topics(id) on delete cascade,
  -- Furthest stage cleared. Monotonic: it never regresses. Decay is expressed
  -- with `remedial`, which keeps the stage map readable and the history honest.
  stage text not null default 'new' check (
    stage in ('new', 'primed', 'encoded', 'referenced', 'retrieved', 'interleaved', 'overlearned')
  ),
  remedial boolean not null default false,
  primed_at timestamptz,
  encoded_at timestamptz,
  referenced_at timestamptz,
  first_retrieved_at timestamptz,
  interleaved_at timestamptz,
  overlearned_at timestamptz,
  -- Index into the spaced-retrieval interval ladder, not a count of sessions.
  retrieval_streak integer not null default 0 check (retrieval_streak >= 0),
  next_retrieval_on date,
  interleave_appearances integer not null default 0 check (interleave_appearances >= 0),
  overlearn_drills integer not null default 0 check (overlearn_drills >= 0),
  -- Median response time on the first overlearning drill. Fluency is scored
  -- against this, so it is written once and never overwritten.
  baseline_response_ms integer,
  updated_at timestamptz not null default now(),
  unique (enrollment_id, topic_id)
);

create index if not exists curve_topic_stage_user_idx
  on public.curve_topic_stage (user_id, stage);

-- The planner's hottest query: everything due today across every subject.
create index if not exists curve_topic_stage_due_idx
  on public.curve_topic_stage (user_id, next_retrieval_on)
  where next_retrieval_on is not null;

-- ---------- 3. append-only session log ----------

create table if not exists public.curve_stage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null references public.curve_enrollments(id) on delete cascade,
  -- Nullable: an interleave set spans several topics and belongs to none.
  topic_id uuid references public.curve_course_topics(id) on delete set null,
  stage_action text not null check (
    stage_action in ('prime', 'encode', 'reference', 'retrieve', 'interleave', 'overlearn')
  ),
  outcome text not null check (
    outcome in ('completed', 'abandoned', 'gate_blocked', 'overridden')
  ),
  duration_sec integer,
  accuracy numeric(4, 3) check (accuracy is null or (accuracy >= 0 and accuracy <= 1)),
  rubric_score numeric(3, 1) check (rubric_score is null or (rubric_score >= 0 and rubric_score <= 5)),
  median_response_ms integer,
  -- Encoding artifacts, primer answers, per-topic interleave breakdown.
  payload jsonb not null default '{}'::jsonb,
  -- False when the student picked this themselves instead of taking the
  -- prescribed action. Powers the stage-correct session rate, which cannot be
  -- reconstructed after the fact.
  was_prescribed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists curve_stage_events_topic_idx
  on public.curve_stage_events (user_id, topic_id, stage_action, created_at desc);

create index if not exists curve_stage_events_metrics_idx
  on public.curve_stage_events (user_id, created_at desc);

-- ---------- 4. course-level primer cache ----------

-- One primer serves every student in the course. This is the main AI cost
-- control in the system, which is why writes are service-role only: a client
-- that could write here could poison another student's priming.
create table if not exists public.curve_stage_primers (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.curve_courses(id) on delete cascade,
  topic_id uuid not null references public.curve_course_topics(id) on delete cascade,
  -- { summary, listenFor[], terms[], prereqCheck, connectsTo }
  content jsonb not null,
  model text,
  created_at timestamptz not null default now(),
  unique (course_id, topic_id)
);

-- ---------- 5. RLS ----------

alter table public.curve_topic_stage enable row level security;
alter table public.curve_stage_events enable row level security;
alter table public.curve_stage_primers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_topic_stage'
      and policyname = 'curve_topic_stage_own'
  ) then
    create policy curve_topic_stage_own on public.curve_topic_stage
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;

  -- Append-only by policy: no update, no delete. The log is the evidence the
  -- gates read from, so a student must not be able to rewrite it.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_stage_events'
      and policyname = 'curve_stage_events_select_own'
  ) then
    create policy curve_stage_events_select_own on public.curve_stage_events
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_stage_events'
      and policyname = 'curve_stage_events_insert_own'
  ) then
    create policy curve_stage_events_insert_own on public.curve_stage_events
      for insert to authenticated
      with check (user_id = (select auth.uid()));
  end if;

  -- Primers are readable by anyone enrolled in that course; only the service
  -- role writes them.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_stage_primers'
      and policyname = 'curve_stage_primers_select_enrolled'
  ) then
    create policy curve_stage_primers_select_enrolled on public.curve_stage_primers
      for select to authenticated
      using (
        exists (
          select 1 from public.curve_enrollments e
          where e.course_id = curve_stage_primers.course_id
            and e.user_id = (select auth.uid())
        )
      );
  end if;
end
$$;

-- ---------- 6. idempotent backfill ----------

-- Creates a stage row at 'new' for every syllabus topic on an enrollment.
-- Called on first load of an enrollment and again whenever a syllabus gains
-- topics. Safe to call repeatedly.
create or replace function public.curve_backfill_topic_stages(p_enrollment_id uuid)
returns integer
language plpgsql
security invoker
as $$
declare
  v_inserted integer;
begin
  insert into public.curve_topic_stage (user_id, enrollment_id, topic_id)
  select e.user_id, e.id, t.id
  from public.curve_enrollments e
  join public.curve_course_topics t on t.course_id = e.course_id
  where e.id = p_enrollment_id
    and e.user_id = (select auth.uid())
  on conflict (enrollment_id, topic_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

grant execute on function public.curve_backfill_topic_stages(uuid) to authenticated;
