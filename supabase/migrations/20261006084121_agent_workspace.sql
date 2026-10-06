-- Workspace state is server-written. Existing material/session tables remain authoritative.
create table public.curve_workspace_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  state jsonb not null default '{"artifacts":[],"activeId":null,"plan":null,"checkpointId":null}',
  updated_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz
);
create table public.curve_workspace_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.curve_workspace_threads(id) on delete cascade,
  request_id text not null,
  role text not null check (role in ('user','assistant')),
  content text not null check (length(content) <= 16000),
  created_at timestamptz not null default now(),
  unique(thread_id, request_id, role)
);
create index on public.curve_workspace_messages(thread_id, created_at);
create table public.curve_workspace_actions (
  thread_id uuid not null references public.curve_workspace_threads(id) on delete cascade,
  request_id text not null,
  name text not null,
  status text not null check (status in ('running','completed','failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  primary key(thread_id, request_id)
);
create index on public.curve_workspace_actions(thread_id, created_at);
alter table public.curve_workspace_threads enable row level security;
alter table public.curve_workspace_messages enable row level security;
alter table public.curve_workspace_actions enable row level security;
revoke all on public.curve_workspace_threads, public.curve_workspace_messages, public.curve_workspace_actions from anon, authenticated;
grant select on public.curve_workspace_threads, public.curve_workspace_messages, public.curve_workspace_actions to authenticated;
grant all on public.curve_workspace_threads, public.curve_workspace_messages, public.curve_workspace_actions to service_role;
create policy workspace_thread_read on public.curve_workspace_threads for select to authenticated using ((select auth.uid()) = user_id);
create policy workspace_message_read on public.curve_workspace_messages for select to authenticated using (exists(select 1 from public.curve_workspace_threads t where t.id = thread_id and t.user_id = (select auth.uid())));
create policy workspace_action_read on public.curve_workspace_actions for select to authenticated using (exists(select 1 from public.curve_workspace_threads t where t.id = thread_id and t.user_id = (select auth.uid())));

-- Service-only, invoker function: serialize all mutations per student across tabs/devices.
create or replace function public.claim_workspace_request(
  p_thread uuid,
  p_user uuid,
  p_request uuid,
  p_name text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $func$
declare
  t public.curve_workspace_threads%rowtype;
  prior public.curve_workspace_actions%rowtype;
  cap integer;
  daily_cap integer;
  recent_count integer;
  daily_count integer;
begin
  select * into t from public.curve_workspace_threads where id = p_thread and user_id = p_user for update;
  if not found then
    raise exception 'Workspace not found';
  end if;

  select * into prior from public.curve_workspace_actions where thread_id = p_thread and request_id = p_request::text;
  if prior.status = 'completed' then
    return jsonb_build_object('cached', true, 'result', prior.result);
  end if;

  if t.lease_until > now() then
    raise exception 'An action is still running. Please retry shortly.';
  end if;

  cap := case when p_name = 'voice' then 6 else 60 end;
  select count(*) into recent_count from public.curve_workspace_actions where thread_id = p_thread and name = p_name and created_at > now() - interval '1 minute';
  if recent_count >= cap then
    raise exception 'Too many requests. Please wait a minute.';
  end if;

  if p_name in ('voice', 'message') then
    daily_cap := case when p_name = 'voice' then 60 else 300 end;
    select count(*) into daily_count from public.curve_workspace_actions where thread_id = p_thread and name = p_name and created_at > now() - interval '1 day';
    if daily_count >= daily_cap then
      raise exception 'Daily conversation limit reached. Your saved work is still available.';
    end if;
  end if;

  update public.curve_workspace_threads
  set lease_id = p_request, lease_until = now() + interval '150 seconds'
  where id = p_thread;

  insert into public.curve_workspace_actions(thread_id, request_id, name, status)
  values(p_thread, p_request::text, p_name, 'running')
  on conflict(thread_id, request_id) do update set status = 'running', error = null;

  return jsonb_build_object('cached', false);
end;
$func$;
revoke all on function public.claim_workspace_request(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.claim_workspace_request(uuid,uuid,uuid,text) to service_role;
