-- ============================================
-- Curve: US college course model.
--
-- The existing schema has no notion of a college course: no weighted
-- grading components, no letter scale, no credit hours, no term. This adds
-- that layer under a curve_ prefix so it sits alongside the school closed
-- loop and the India product without touching either.
--
-- Courses are shared catalog rows so that a campus can be pre-loaded with
-- real syllabi before any student signs up, which is also what makes the
-- per-professor forecast priors possible later.
-- ============================================

create table if not exists public.curve_courses (
  id uuid primary key default gen_random_uuid(),
  institution_name text,
  course_code text not null,
  title text not null,
  instructor_name text,
  term text not null,
  credit_hours numeric(4, 2) not null default 3 check (credit_hours > 0),
  -- null means the app falls back to the standard plus/minus scale
  grade_scale jsonb check (grade_scale is null or jsonb_typeof(grade_scale) = 'object'),
  syllabus_storage_path text,
  -- curated rows are the pre-loaded catalog; student uploads are not
  is_catalog boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep the curated catalog free of duplicate offerings.
create unique index if not exists curve_courses_catalog_offering_idx
  on public.curve_courses (
    lower(course_code),
    lower(term),
    coalesce(lower(instructor_name), '')
  )
  where is_catalog;

create index if not exists curve_courses_lookup_idx
  on public.curve_courses (lower(course_code), lower(term));

create index if not exists curve_courses_created_by_idx
  on public.curve_courses (created_by);

create table if not exists public.curve_grading_components (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.curve_courses(id) on delete cascade,
  name text not null,
  kind text not null default 'other' check (
    kind in ('homework', 'quiz', 'midterm', 'final', 'project', 'lab', 'participation', 'other')
  ),
  -- percent of the final grade
  weight numeric(6, 3) not null check (weight > 0 and weight <= 100),
  drop_lowest integer not null default 0 check (drop_lowest >= 0),
  due_on date,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists curve_grading_components_course_idx
  on public.curve_grading_components (course_id, position);

create table if not exists public.curve_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.curve_courses(id) on delete cascade,
  credit_hours numeric(4, 2) not null default 3 check (credit_hours > 0),
  target_letter text,
  tone text not null default 'violet' check (tone in ('violet', 'amber', 'mint', 'blush')),
  status text not null default 'active' check (status in ('active', 'completed', 'dropped')),
  -- reported once the course ends; the outcome label that trains calibration
  final_percent numeric(6, 3),
  final_letter text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists curve_enrollments_user_idx
  on public.curve_enrollments (user_id, status);

create table if not exists public.curve_scores (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.curve_enrollments(id) on delete cascade,
  component_id uuid not null references public.curve_grading_components(id) on delete cascade,
  label text,
  points_earned numeric(8, 3) not null check (points_earned >= 0),
  points_possible numeric(8, 3) not null check (points_possible > 0),
  graded_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists curve_scores_enrollment_idx
  on public.curve_scores (enrollment_id, component_id);

-- Every forecast is retained with its horizon so calibration error can be
-- measured against the reported final grade. This is both the product truth
-- metric and the marketing asset, so it is captured from the first forecast.
create table if not exists public.curve_forecasts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.curve_enrollments(id) on delete cascade,
  projected_percent numeric(6, 3) not null,
  low_percent numeric(6, 3) not null,
  high_percent numeric(6, 3) not null,
  projected_letter text not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  graded_weight numeric(6, 3) not null default 0,
  -- days remaining until the next graded component at time of forecast
  horizon_days integer,
  created_at timestamptz not null default now()
);

create index if not exists curve_forecasts_enrollment_idx
  on public.curve_forecasts (enrollment_id, created_at desc);

-- ---------- updated_at triggers ----------

create or replace function public.curve_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_curve_courses_updated_at') then
    create trigger trg_curve_courses_updated_at
      before update on public.curve_courses
      for each row execute function public.curve_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_curve_enrollments_updated_at') then
    create trigger trg_curve_enrollments_updated_at
      before update on public.curve_enrollments
      for each row execute function public.curve_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_curve_scores_updated_at') then
    create trigger trg_curve_scores_updated_at
      before update on public.curve_scores
      for each row execute function public.curve_set_updated_at();
  end if;
end $$;

-- ---------- RLS ----------

alter table public.curve_courses enable row level security;
alter table public.curve_grading_components enable row level security;
alter table public.curve_enrollments enable row level security;
alter table public.curve_scores enable row level security;
alter table public.curve_forecasts enable row level security;

do $$
begin
  -- Courses: the curated catalog is readable by everyone signed in; a student
  -- can additionally see and edit the ad-hoc courses they created themselves.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_courses'
      and policyname = 'curve_courses_select'
  ) then
    create policy curve_courses_select on public.curve_courses
      for select to authenticated
      using (is_catalog or created_by = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_courses'
      and policyname = 'curve_courses_insert_own'
  ) then
    create policy curve_courses_insert_own on public.curve_courses
      for insert to authenticated
      with check (created_by = (select auth.uid()) and is_catalog = false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_courses'
      and policyname = 'curve_courses_update_own'
  ) then
    create policy curve_courses_update_own on public.curve_courses
      for update to authenticated
      using (created_by = (select auth.uid()) and is_catalog = false)
      with check (created_by = (select auth.uid()) and is_catalog = false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_courses'
      and policyname = 'curve_courses_delete_own'
  ) then
    create policy curve_courses_delete_own on public.curve_courses
      for delete to authenticated
      using (created_by = (select auth.uid()) and is_catalog = false);
  end if;

  -- Grading components inherit visibility from their course.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_grading_components'
      and policyname = 'curve_components_select'
  ) then
    create policy curve_components_select on public.curve_grading_components
      for select to authenticated
      using (
        exists (
          select 1 from public.curve_courses c
          where c.id = course_id
            and (c.is_catalog or c.created_by = (select auth.uid()))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_grading_components'
      and policyname = 'curve_components_write_own_course'
  ) then
    create policy curve_components_write_own_course on public.curve_grading_components
      for all to authenticated
      using (
        exists (
          select 1 from public.curve_courses c
          where c.id = course_id and c.created_by = (select auth.uid()) and c.is_catalog = false
        )
      )
      with check (
        exists (
          select 1 from public.curve_courses c
          where c.id = course_id and c.created_by = (select auth.uid()) and c.is_catalog = false
        )
      );
  end if;

  -- Enrollments, scores and forecasts are strictly per-student.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_enrollments'
      and policyname = 'curve_enrollments_own'
  ) then
    create policy curve_enrollments_own on public.curve_enrollments
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_scores'
      and policyname = 'curve_scores_own'
  ) then
    create policy curve_scores_own on public.curve_scores
      for all to authenticated
      using (
        exists (
          select 1 from public.curve_enrollments e
          where e.id = enrollment_id and e.user_id = (select auth.uid())
        )
      )
      with check (
        exists (
          select 1 from public.curve_enrollments e
          where e.id = enrollment_id and e.user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'curve_forecasts'
      and policyname = 'curve_forecasts_own'
  ) then
    create policy curve_forecasts_own on public.curve_forecasts
      for all to authenticated
      using (
        exists (
          select 1 from public.curve_enrollments e
          where e.id = enrollment_id and e.user_id = (select auth.uid())
        )
      )
      with check (
        exists (
          select 1 from public.curve_enrollments e
          where e.id = enrollment_id and e.user_id = (select auth.uid())
        )
      );
  end if;
end $$;

grant select, insert, update, delete on public.curve_courses to authenticated;
grant select, insert, update, delete on public.curve_grading_components to authenticated;
grant select, insert, update, delete on public.curve_enrollments to authenticated;
grant select, insert, update, delete on public.curve_scores to authenticated;
grant select, insert, update, delete on public.curve_forecasts to authenticated;

notify pgrst, 'reload schema';
