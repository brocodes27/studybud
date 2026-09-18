-- Material study keeps public questions separate from server-only answer keys.
create table public.curve_material_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  mode text not null check (mode in ('practice', 'checkpoint')),
  topic text not null,
  questions jsonb not null default '[]',
  answers jsonb not null default '{}',
  hints jsonb not null default '[]',
  results jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.curve_material_sessions(user_id, created_at desc);
alter table public.curve_material_sessions enable row level security;
grant select on public.curve_material_sessions to authenticated;
revoke insert, update, delete on public.curve_material_sessions from anon, authenticated;
create policy material_sessions_read_own on public.curve_material_sessions for select to authenticated using ((select auth.uid()) = user_id);

create table public.curve_material_keys (
  session_id uuid primary key references public.curve_material_sessions(id) on delete cascade,
  keys jsonb not null
);
alter table public.curve_material_keys enable row level security;
revoke all on public.curve_material_keys from anon, authenticated;
grant all on public.curve_material_sessions, public.curve_material_keys to service_role;

-- Attempts survive material deletion so failures/deletes cannot reset the AI budget.
create table public.curve_material_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.curve_material_requests(user_id, created_at);
alter table public.curve_material_requests enable row level security;
revoke all on public.curve_material_requests from anon, authenticated;
grant all on public.curve_material_requests to service_role;

create function public.reserve_material_analysis(p_material uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in to study'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if not exists(select 1 from materials where id = p_material and owner_user_id = uid and metadata->>'workspace' = 'curve') then raise exception 'Material unavailable'; end if;
  if (select count(*) from curve_material_requests where user_id = uid and created_at > now() - interval '24 hours') >= 30 then raise exception 'Daily AI limit reached. Continue a saved session or return tomorrow.'; end if;
  delete from curve_material_requests where user_id = uid and created_at < now() - interval '7 days';
  insert into curve_material_requests(user_id) values(uid);
end $$;
revoke all on function public.reserve_material_analysis(uuid) from public;
grant execute on function public.reserve_material_analysis(uuid) to authenticated;

-- Serialize reservations per student so parallel requests cannot bypass the cap.
create function public.reserve_material_session(p_id uuid, p_material uuid, p_mode text, p_topic text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); result uuid;
begin
  if uid is null then raise exception 'Sign in to study'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select id into result from curve_material_sessions where id = p_id and user_id = uid;
  if result is not null then raise exception 'Session already reserved. Return to your library to resume it.'; end if;
  if not exists(select 1 from materials where id = p_material and owner_user_id = uid and metadata->>'workspace' = 'curve') then raise exception 'Material unavailable'; end if;
  perform reserve_material_analysis(p_material);
  insert into curve_material_sessions(id, user_id, material_id, mode, topic) values(p_id, uid, p_material, p_mode, left(p_topic, 200));
  return p_id;
end $$;
revoke all on function public.reserve_material_session(uuid, uuid, text, text) from public;
grant execute on function public.reserve_material_session(uuid, uuid, text, text) to authenticated;

create table public.curve_material_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.curve_material_sessions(id) on delete cascade,
  question_id text not null, reason text not null check (length(reason) between 5 and 2000),
  created_at timestamptz not null default now()
);
alter table public.curve_material_reports enable row level security;
grant select, insert on public.curve_material_reports to authenticated;
grant all on public.curve_material_reports to service_role;
create policy material_reports_own_read on public.curve_material_reports for select to authenticated using ((select auth.uid()) = user_id);
create policy material_reports_own_insert on public.curve_material_reports for insert to authenticated with check ((select auth.uid()) = user_id and exists(select 1 from curve_material_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
