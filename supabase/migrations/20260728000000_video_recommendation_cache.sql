create table if not exists public.video_recommendation_cache (
  cache_key text primary key,
  query_text text not null,
  recommendations jsonb not null
    check (jsonb_typeof(recommendations) = 'array'),
  mode text not null
    check (mode in ('youtube', 'youtube_search')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_recommendation_cache_expires_at_idx
  on public.video_recommendation_cache (expires_at);

alter table public.video_recommendation_cache enable row level security;

revoke all on table public.video_recommendation_cache from anon, authenticated;

create table if not exists public.video_recommendation_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
    check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.video_recommendation_rate_limits enable row level security;

revoke all on table public.video_recommendation_rate_limits from anon, authenticated;

create or replace function public.consume_video_recommendation_quota(
  p_user_id uuid,
  p_limit integer default 20,
  p_window_seconds integer default 3600
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed boolean;
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 60));
  v_window_seconds integer :=
    greatest(60, least(coalesce(p_window_seconds, 3600), 86400));
begin
  insert into public.video_recommendation_rate_limits (
    user_id,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_user_id, now(), 1, now())
  on conflict (user_id) do update
  set
    window_started_at = case
      when public.video_recommendation_rate_limits.window_started_at
        <= now() - make_interval(secs => v_window_seconds)
      then now()
      else public.video_recommendation_rate_limits.window_started_at
    end,
    request_count = case
      when public.video_recommendation_rate_limits.window_started_at
        <= now() - make_interval(secs => v_window_seconds)
      then 1
      else public.video_recommendation_rate_limits.request_count + 1
    end,
    updated_at = now()
  returning request_count <= v_limit into v_allowed;

  return v_allowed;
end;
$$;

revoke all on function public.consume_video_recommendation_quota(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_video_recommendation_quota(uuid, integer, integer)
  to service_role;
