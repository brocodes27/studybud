-- Research runs independently of the browser; only the worker writes results.
alter table public.curve_workspace_threads
  add column research_enabled boolean not null default true,
  add column research_next_at timestamptz not null default now();
create table public.curve_workspace_research (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  status text not null check (status in ('running','ready','failed')),
  attempts integer not null default 1,
  artifacts jsonb not null default '[]',
  error text,
  updated_at timestamptz not null default now(),
  unique(user_id, day)
);
alter table public.curve_workspace_research enable row level security;
revoke all on public.curve_workspace_research from public, anon, authenticated;
grant select on public.curve_workspace_research to authenticated;
grant all on public.curve_workspace_research to service_role;
create policy research_read_own on public.curve_workspace_research for select to authenticated
  using ((select auth.uid()) = user_id);
create index workspace_research_due on public.curve_workspace_threads(research_next_at) where research_enabled;

create or replace function public.claim_workspace_research()
returns jsonb language plpgsql security invoker set search_path = public as $$
declare t public.curve_workspace_threads%rowtype; j public.curve_workspace_research%rowtype;
begin
  select * into t from public.curve_workspace_threads w
  where w.research_enabled and w.research_next_at <= now()
    and not exists(select 1 from public.curve_workspace_research r where r.user_id=w.user_id and r.day=current_date
      and (r.status='ready' or r.attempts >= 3 or (r.status='running' and r.updated_at > now()-interval '15 minutes')))
  order by w.research_next_at for update skip locked limit 1;
  if not found then return null; end if;
  insert into public.curve_workspace_research(user_id, day, status) values(t.user_id,current_date,'running')
    on conflict(user_id,day) do update set status='running', attempts=curve_workspace_research.attempts+1, error=null, updated_at=now()
    returning * into j;
  update public.curve_workspace_threads set research_next_at=now()+interval '16 minutes' where id=t.id;
  return to_jsonb(j);
end; $$;
revoke all on function public.claim_workspace_research() from public, anon, authenticated;
grant execute on function public.claim_workspace_research() to service_role;

-- Configure project_url and workspace_research_secret in Vault, and matching
-- WORKSPACE_RESEARCH_SECRET in Edge Function secrets before enabling the worker.
-- Existing installations already use pg_cron/pg_net; missing extensions are explicit.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('workspace-daily-research', '* * * * *', $job$
  select net.http_post(
    url := p.decrypted_secret || '/functions/v1/workspace-research',
    headers := jsonb_build_object('Content-Type','application/json','X-Research-Secret',s.decrypted_secret),
    body := '{}'::jsonb, timeout_milliseconds := 1000
  ) from vault.decrypted_secrets p cross join vault.decrypted_secrets s
  where p.name='project_url' and s.name='workspace_research_secret';
$job$);
