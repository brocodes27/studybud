-- ============================================
-- Curve: payments, forecast receipts, and the mastery substrate.
--
-- 1. The legacy `subscriptions` table is only ever ALTERed by migrations
--    (both ALTER statements target a placeholder name), so it is created here
--    for real with the columns the app and webhooks rely on. `is_premium` is
--    added to user_profiles because the AI metering RPC reads it and the
--    column does not exist anywhere.
--
-- 2. curve_forecast_receipts is the screenshot-native share card store,
--    following the mastery_receipts slug pattern so the existing public
--    /m/:slug route can serve it.
--
-- 3. curve_course_topics keys knowledge to a course. The canonical mastery
--    table is student_cognitive_profiles (the BKT engine); course topics
--    become knowledge_components rows so every study surface logs against
--    the same substrate and the forecast can read expected performance from
--    it via curve_mastery_for_enrollment.
--
-- 4. check_ai_budget is hardened: it previously read a non-existent
--    `is_premium` column, which errored for every B2C user, and nothing ever
--    called the quota consumer, so the free cap never moved.
-- ============================================

-- ---------- 1. subscriptions + premium flag ----------

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  plan text not null default 'monthly',
  payment_provider varchar(50) not null default 'dodo',
  subscription_id varchar(255),
  trial_start timestamptz,
  trial_end timestamptz,
  subscription_start timestamptz,
  subscription_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id, status);
-- One active row per user: the webhook upserts on user_id and the app reads
-- a single subscription to derive is_premium.
create unique index if not exists subscriptions_user_uniq
  on public.subscriptions (user_id);
create unique index if not exists subscriptions_provider_id_idx
  on public.subscriptions (subscription_id)
  where subscription_id is not null;

alter table public.user_profiles
  add column if not exists is_premium boolean not null default false;

-- ---------- 2. shareable forecast receipts ----------

create table if not exists public.curve_forecast_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null references public.curve_enrollments(id) on delete cascade,
  slug text not null unique,
  course_code text not null,
  course_title text not null,
  institution_name text,
  projected_letter text not null,
  low_percent numeric(6, 3) not null,
  high_percent numeric(6, 3) not null,
  next_exam_name text,
  days_to_exam integer,
  public_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists curve_forecast_receipts_slug_idx
  on public.curve_forecast_receipts (slug);

-- ---------- 3. course topics -> knowledge components ----------

create table if not exists public.curve_course_topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.curve_courses(id) on delete cascade,
  kc_id uuid references public.knowledge_components(id) on delete set null,
  topic text not null,
  week integer,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (course_id, topic)
);

create index if not exists curve_course_topics_course_idx
  on public.curve_course_topics (course_id);

-- ---------- RLS ----------

alter table public.subscriptions enable row level security;
alter table public.curve_forecast_receipts enable row level security;
alter table public.curve_course_topics enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscriptions'
      and policyname = 'subscriptions_own'
  ) then
    create policy subscriptions_own on public.subscriptions
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_forecast_receipts'
      and policyname = 'curve_forecast_receipts_select'
  ) then
    create policy curve_forecast_receipts_select on public.curve_forecast_receipts
      for select to authenticated
      using (user_id = (select auth.uid()) or public_visible);
  end if;

  -- Anonymous visitors on the public /m/:slug page.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_forecast_receipts'
      and policyname = 'curve_forecast_receipts_select_anon'
  ) then
    create policy curve_forecast_receipts_select_anon on public.curve_forecast_receipts
      for select to anon
      using (public_visible);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_forecast_receipts'
      and policyname = 'curve_forecast_receipts_insert_own'
  ) then
    create policy curve_forecast_receipts_insert_own on public.curve_forecast_receipts
      for insert to authenticated
      with check (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_forecast_receipts'
      and policyname = 'curve_forecast_receipts_delete_own'
  ) then
    create policy curve_forecast_receipts_delete_own on public.curve_forecast_receipts
      for delete to authenticated
      using (user_id = (select auth.uid()));
  end if;

  -- Topics are visible with their course (catalog or own).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_course_topics'
      and policyname = 'curve_course_topics_select'
  ) then
    create policy curve_course_topics_select on public.curve_course_topics
      for select to authenticated
      using (
        exists (
          select 1 from public.curve_courses c
          where c.id = course_id
            and (c.is_catalog or c.created_by = (select auth.uid()))
        )
      );
  end if;
end $$;

grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, insert, delete on public.curve_forecast_receipts to authenticated;
grant select on public.curve_course_topics to authenticated;

-- ---------- 4. hardened AI metering ----------

-- is_premium column now exists (see above), and the profile row is no longer
-- assumed to exist. School users keep the school budget path untouched.
create or replace function public.check_ai_budget(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_school_id uuid;
  v_is_premium boolean := false;
  v_daily_cost numeric(10, 4) := 0;
  v_last_reset date;
begin
  select school_id into v_school_id from public.user_profiles where id = p_user_id;

  -- School users are governed by the school entitlement budget.
  if v_school_id is not null then
    return true;
  end if;

  -- Paid Curve subscribers get unlimited access.
  select coalesce(is_premium, false) into v_is_premium
  from public.user_profiles where id = p_user_id;
  if v_is_premium then
    return true;
  end if;

  -- Free B2C users get a daily cost cap ($0.50 approximates ~25 chat turns).
  select daily_cost_usd, last_reset_date into v_daily_cost, v_last_reset
  from public.curve_user_ai_quotas
  where user_id = p_user_id;

  if v_last_reset is null or v_last_reset < current_date then
    return true; -- new day, quota resets on the next consume
  end if;

  return v_daily_cost < 0.5000;
end;
$$;

-- Atomic quota consumer. Skips school users so the school budget path stays
-- untouched and their usage does not pollute the B2C quota rows.
create or replace function public.consume_user_ai_quota(
  p_user_id uuid,
  p_estimated_cost numeric default 0.0100
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_allowed boolean;
  v_school_id uuid;
begin
  select school_id into v_school_id from public.user_profiles where id = p_user_id;
  if v_school_id is not null then
    return true;
  end if;

  v_allowed := public.check_ai_budget(p_user_id);
  if not v_allowed then
    return false;
  end if;

  insert into public.curve_user_ai_quotas (user_id, daily_requests_count, daily_cost_usd, last_reset_date)
  values (p_user_id, 1, p_estimated_cost, current_date)
  on conflict (user_id) do update set
    daily_requests_count = case
      when curve_user_ai_quotas.last_reset_date < current_date then 1
      else curve_user_ai_quotas.daily_requests_count + 1
    end,
    daily_cost_usd = case
      when curve_user_ai_quotas.last_reset_date < current_date then p_estimated_cost
      else curve_user_ai_quotas.daily_cost_usd + p_estimated_cost
    end,
    last_reset_date = current_date,
    updated_at = now();

  return true;
end;
$$;

grant execute on function public.check_ai_budget(uuid) to authenticated;
grant execute on function public.consume_user_ai_quota(uuid, numeric) to authenticated;

-- ---------- 5. course topic mastery helpers ----------

-- Resolves (creating if needed) the knowledge component for a course topic,
-- then links it to the course. Only the course owner or any authenticated
-- user (for catalog courses) may create topics for that course.
create or replace function public.curve_ensure_course_kc(
  p_course_id uuid,
  p_topic text,
  p_week integer default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_course_code text;
  v_kc_id uuid;
begin
  if p_topic is null or length(trim(p_topic)) = 0 then
    return null;
  end if;

  select course_code into v_course_code
  from public.curve_courses
  where id = p_course_id
    and (is_catalog or created_by = (select auth.uid()));

  if v_course_code is null then
    raise exception 'course_not_accessible';
  end if;

  select id into v_kc_id
  from public.knowledge_components
  where subject = v_course_code and lower(topic) = lower(trim(p_topic))
  limit 1;

  if v_kc_id is null then
    insert into public.knowledge_components (subject, topic, metadata)
    values (v_course_code, trim(p_topic), jsonb_build_object('source', 'curve_syllabus', 'course_id', p_course_id))
    returning id into v_kc_id;
  end if;

  insert into public.curve_course_topics (course_id, kc_id, topic, week)
  values (p_course_id, v_kc_id, trim(p_topic), p_week)
  on conflict (course_id, topic) do update set
    kc_id = excluded.kc_id,
    week = coalesce(excluded.week, curve_course_topics.week);

  return v_kc_id;
end;
$$;

-- Mastery summary for one of the caller's enrollments: how many topics the
-- course has, how many have BKT profiles, the average p_mastery over profiled
-- topics, and total interactions. The caller must own the enrollment (RLS
-- applies; curve_enrollments is per-student).
create or replace function public.curve_mastery_for_enrollment(p_enrollment_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_course_id uuid;
  v_total_topics integer := 0;
  v_profiled_topics integer := 0;
  v_total_interactions integer := 0;
  v_avg_mastery numeric := 0;
  v_own boolean;
begin
  select exists (
    select 1 from public.curve_enrollments e
    where e.id = p_enrollment_id and e.user_id = (select auth.uid())
  ) into v_own;

  if not v_own then
    raise exception 'enrollment_not_accessible';
  end if;

  select course_id into v_course_id
  from public.curve_enrollments where id = p_enrollment_id;

  select
    count(*)::integer,
    count(scp.id)::integer,
    coalesce(sum(scp.interaction_count), 0)::integer,
    coalesce(avg(scp.p_mastery), 0)::numeric
  into v_total_topics, v_profiled_topics, v_total_interactions, v_avg_mastery
  from public.curve_course_topics t
  left join public.student_cognitive_profiles scp
    on scp.kc_id = t.kc_id and scp.user_id = (select auth.uid())
  where t.course_id = v_course_id;

  return jsonb_build_object(
    'course_id', v_course_id,
    'topics', v_total_topics,
    'profiled_topics', v_profiled_topics,
    'total_interactions', v_total_interactions,
    'avg_mastery', round(coalesce(v_avg_mastery, 0), 4)
  );
end;
$$;

grant execute on function public.curve_ensure_course_kc(uuid, text, integer) to authenticated;
grant execute on function public.curve_mastery_for_enrollment(uuid) to authenticated;

-- ---------- 5. webhook sources ----------

-- dodo-webhook marks processed events in processed_webhooks; widen the
-- source constraint to admit Dodo alongside the legacy school gateways
-- (stripe is kept in the union for forward compatibility).
alter table public.processed_webhooks
  drop constraint if exists processed_webhooks_source_check;

alter table public.processed_webhooks
  add constraint processed_webhooks_source_check
  check (source in ('dodo', 'paypal', 'razorpay', 'stripe'));

notify pgrst, 'reload schema';
