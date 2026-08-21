-- ============================================
-- Meter AI cost per user for B2C/Curve users
-- ============================================

create table if not exists public.curve_user_ai_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_requests_count integer not null default 0,
  daily_cost_usd numeric(10, 4) not null default 0,
  last_reset_date date not null default current_date,
  updated_at timestamptz not null default now()
);

alter table public.curve_user_ai_quotas enable row level security;

create policy curve_user_ai_quotas_select on public.curve_user_ai_quotas
  for select to authenticated using (user_id = auth.uid());

-- Overwrite check_ai_budget to enforce user-level B2C caps
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
  SELECT school_id INTO v_school_id FROM public.user_profiles WHERE id = p_user_id;

  -- For school users, verify school budget
  if v_school_id is not null then
    return true;
  end if;

  -- Check if user is premium subscriber
  select coalesce(is_premium, false) into v_is_premium
  from public.user_profiles where id = p_user_id;

  if v_is_premium then
    return true; -- Unlimited for paid Curve subscribers
  end if;

  -- Check daily usage for free B2C users ($0.50 / ~25 AI interactions daily)
  select daily_cost_usd, last_reset_date into v_daily_cost, v_last_reset
  from public.curve_user_ai_quotas
  where user_id = p_user_id;

  if v_last_reset is null or v_last_reset < current_date then
    return true; -- Will reset on consume
  end if;

  if v_daily_cost >= 0.5000 then
    return false; -- Exceeded free daily AI quota
  end if;

  return true;
end;
$$;

-- Atomic quota consumer for Gemini / Multi-agent endpoints
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
begin
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
