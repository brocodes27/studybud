-- Lightweight event analytics for closed-beta tracking.
-- No external scripts needed — just Supabase.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  user_id uuid references auth.users(id) on delete set null,
  session_id text not null default gen_random_uuid(),
  path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_name_idx on public.analytics_events(event_name);
create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at desc);
alter table public.analytics_events enable row level security;
drop policy if exists "Anyone can insert analytics events" on public.analytics_events;
create policy "Anyone can insert analytics events"
  on public.analytics_events for insert
  to anon, authenticated
  with check (true);
drop policy if exists "Admins can read analytics" on public.analytics_events;
create policy "Admins can read analytics"
  on public.analytics_events for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles where id = auth.uid() and is_admin = true
    )
  );
-- Simple aggregate helper for dashboard queries
create or replace function public.get_funnel_counts(
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  event_name text,
  unique_users bigint,
  total_events bigint
)
language sql
stable
security invoker
as $$
  select
    ae.event_name,
    count(distinct ae.user_id) as unique_users,
    count(*) as total_events
  from public.analytics_events ae
  where ae.created_at between p_start and p_end
  group by ae.event_name
  order by total_events desc;
$$;
