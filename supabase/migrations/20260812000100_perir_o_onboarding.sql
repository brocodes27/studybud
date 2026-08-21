-- PERIR-O onboarding support (PRD v2 §10, roadmap P1.15).
--
-- A student joining mid-semester has already sat through weeks of lectures.
-- Without a way to say so, every one of those topics sits at 'new' and the
-- planner keeps offering to prime a lecture that happened a month ago — the
-- stage map opens as a wall of debt, which is the fastest way to lose someone
-- in their first minute.
--
-- Marking a week range as already covered moves those topics to 'primed', which
-- routes them to Encoding: exactly right, because attending a lecture is what
-- priming prepares you for, and it is not what encoding is.

create or replace function public.curve_mark_topics_covered(
  p_enrollment_id uuid,
  p_through_week integer
)
returns integer
language plpgsql
security invoker
as $$
declare
  v_updated integer;
begin
  if p_through_week is null or p_through_week < 1 then
    return 0;
  end if;

  -- Make sure the stage rows exist before trying to move them; a course saved
  -- moments ago may not have been planned yet.
  perform public.curve_backfill_topic_stages(p_enrollment_id);

  update public.curve_topic_stage ts
  set stage = 'primed',
      primed_at = coalesce(ts.primed_at, now()),
      updated_at = now()
  from public.curve_course_topics t
  where ts.topic_id = t.id
    and ts.enrollment_id = p_enrollment_id
    and ts.user_id = (select auth.uid())
    -- Only ever moves a topic forward. A topic already past priming keeps the
    -- progress it earned.
    and ts.stage = 'new'
    and t.week is not null
    and t.week <= p_through_week;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

grant execute on function public.curve_mark_topics_covered(uuid, integer) to authenticated;
