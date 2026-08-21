-- Phase 2 / PRD F2-R1: close the forecast→actual loop.
--
-- curve_scores rows that land on a *final-grade-bearing* component are the
-- ground truth the model is judged against. When such a score is entered we
-- mark every unresolved forecast for the same enrollment+component as
-- "settled" and stash the observed percent so calibration reports can read
-- diff(i) without re-joining the ledger.

-- 1) Track which scores can resolve forecasts. Final-exam and project-grade
--    rows count; homework/quiz do not because they feed intermediate priors.
alter table public.curve_scores
  add column if not exists is_terminal_grade boolean not null default false;

-- 2) Forecasts carry their eventual measured error once a terminal grade
--    lands. Both columns are nullable so existing rows stay valid.
alter table public.curve_forecasts
  add column if not exists settled_at timestamptz,
  add column if not exists measured_percent numeric(6, 3),
  add column if not exists measured_letter text,
  add column if not exists error_pp numeric(6, 3);

-- index used for weekly WVL dashboards: "this week's newly-settled grades"
create index if not exists curve_forecasts_settled_idx
  on public.curve_forecasts (settled_at desc)
  where settled_at is not null;

-- 3) Trigger: after insert on curve_scores, if the score is terminal and the
--    owning component is final/project/exam-class, settle open forecasts.

create or replace function public.curve_settle_forecasts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only settle when the caller marks the score as terminal and the component
  -- is one of the high-stakes kinds. Everything else stays a mid-semester
  -- measurement and must not close prior forecasts.
  if not new.is_terminal_grade then
    return new;
  end if;

  if not exists (
    select 1 from public.curve_grading_components c
     where c.id = new.component_id
       and c.kind in ('final', 'project', 'midterm')
  ) then
    return new;
  end if;

  update public.curve_forecasts f
     set settled_at        = coalesce(new.graded_on::timestamptz, now()),
         measured_percent  = (new.points_earned / nullif(new.points_possible, 0)) * 100,
         measured_letter   = null,             -- resolved by layer-2 on read
         error_pp          = (new.points_earned / nullif(new.points_possible, 0)) * 100
                              - f.projected_percent
   where f.enrollment_id = new.enrollment_id
     and f.settled_at is null;

  return new;
end;
$$;

drop trigger if exists trg_curve_settle_forecasts on public.curve_scores;
create trigger trg_curve_settle_forecasts
  after insert on public.curve_scores
  for each row execute function public.curve_settle_forecasts();

-- 4) RLS: no user write access to settlement columns — the trigger is
--    security definer and runs as the table owner. Students still insert
--    scores normally; forecast rows stay insert-only for them.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'curve_forecasts'
       and policyname = 'Users read own forecasts'
  ) then
    create policy "Users read own forecasts" on public.curve_forecasts
      for select to authenticated
      using (
        exists (
          select 1 from public.curve_enrollments e
           where e.id = enrollment_id and e.user_id = auth.uid()
        )
      );
  end if;
end
$$;
