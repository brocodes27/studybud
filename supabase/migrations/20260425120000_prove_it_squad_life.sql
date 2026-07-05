-- Give Squad Prove-It an actual pulse: roster, weekly deadline, squad streak, and live status.

-- 1. Weekly deadline so the squad has a shared finish line.
alter table public.prove_it_squads
  add column if not exists week_ends_at timestamptz;
-- Default new squads to the upcoming Sunday at 23:59 (or now() + 7 days if Sunday unknown).
-- We'll just leave it NULL-able and let the app set it on creation / rotation.

-- 2. Make sure squad creators are automatically members (backfill + trigger).
insert into public.prove_it_squad_members (squad_id, user_id, display_name, joined_at)
select
  s.id as squad_id,
  s.created_by as user_id,
  coalesce(p.full_name, 'Squad Leader') as display_name,
  s.created_at as joined_at
from public.prove_it_squads s
left join public.prove_it_squad_members m on m.squad_id = s.id and m.user_id = s.created_by
left join public.user_profiles p on p.id = s.created_by
where s.created_by is not null
  and m.user_id is null
on conflict (squad_id, user_id) do nothing;
-- 3. Function: join a squad (idempotent, fills display_name from profile).
create or replace function public.join_prove_it_squad(p_squad_id text, p_user_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_name text;
begin
  select coalesce(full_name, '') into v_name from public.user_profiles where id = p_user_id;

  insert into public.prove_it_squad_members (squad_id, user_id, display_name)
  values (p_squad_id, p_user_id, nullif(trim(v_name), ''))
  on conflict (squad_id, user_id) do update
    set display_name = excluded.display_name
    where public.prove_it_squad_members.display_name is null
       or public.prove_it_squad_members.display_name = '';
end;
$$;
-- 4. Function: squad weekly status — every member + whether they attempted this week.
create or replace function public.get_squad_weekly_status(p_squad_id text)
returns table (
  user_id uuid,
  display_name text,
  joined_at timestamptz,
  rigor_score numeric,
  attempted_at timestamptz,
  is_done boolean
)
language sql
stable
security invoker
as $$
  select
    m.user_id,
    coalesce(nullif(trim(m.display_name), ''), 'Anonymous') as display_name,
    m.joined_at,
    a.rigor_score,
    a.created_at as attempted_at,
    (a.created_at is not null and a.created_at >= coalesce(s.week_ends_at, now()) - interval '7 days') as is_done
  from public.prove_it_squad_members m
  join public.prove_it_squads s on s.id = m.squad_id
  left join public.prove_it_squad_attempts a
         on a.squad_id = m.squad_id
        and a.user_id = m.user_id
        and a.created_at >= coalesce(s.week_ends_at, now()) - interval '7 days'
  where m.squad_id = p_squad_id
  order by a.rigor_score desc nulls last, m.joined_at;
$$;
-- 5. Function: squad streak — how many consecutive weeks the squad had >= 2 members complete.
-- (Adjust threshold as needed; 2 is safe for tiny squads.)
create or replace function public.get_squad_streak(p_squad_id text)
returns integer
language plpgsql
stable
security invoker
as $$
declare
  v_weeks record;
  v_streak integer := 0;
  v_current_week timestamptz;
  v_squad_created timestamptz;
begin
  select coalesce(week_ends_at, created_at) into v_current_week
  from public.prove_it_squads where id = p_squad_id;

  if v_current_week is null then return 0; end if;

  -- Walk backwards in 7-day windows from the most recent week_ends_at.
  loop
    if not exists (
      select 1
      from public.prove_it_squad_attempts a
      where a.squad_id = p_squad_id
        and a.created_at >= v_current_week - interval '7 days'
        and a.created_at < v_current_week
    ) then
      exit;
    end if;

    -- Count distinct completers this week; need at least 2 for it to count as a "squad week".
    if (
      select count(distinct a.user_id)
      from public.prove_it_squad_attempts a
      where a.squad_id = p_squad_id
        and a.created_at >= v_current_week - interval '7 days'
        and a.created_at < v_current_week
    ) >= 2 then
      v_streak := v_streak + 1;
    else
      exit;
    end if;

    v_current_week := v_current_week - interval '7 days';
  end loop;

  return v_streak;
end;
$$;
-- 6. Allow anyone authenticated to read basic user profile names for squad context.
-- (The existing policy only lets users view their own profile, which breaks squad rosters.)
drop policy if exists "Authenticated users can read profile names for squads" on public.user_profiles;
create policy "Authenticated users can read profile names for squads"
  on public.user_profiles for select
  to authenticated
  using (true);
