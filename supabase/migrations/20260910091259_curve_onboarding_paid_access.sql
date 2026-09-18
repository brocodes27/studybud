create table public.curve_study_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal text not null check (goal in ('exam','understand','routine')),
  courses text[] not null check (cardinality(courses) between 1 and 12 and length(array_to_string(courses, '')) <= 960),
  exam_date date,
  daily_minutes integer not null check (daily_minutes in (10,20,30,45)),
  completed boolean not null default false
);
alter table public.curve_study_preferences enable row level security;
revoke all on public.curve_study_preferences from public, anon, authenticated;
grant select, insert, update on public.curve_study_preferences to authenticated;
grant all on public.curve_study_preferences to service_role;
create policy preferences_own on public.curve_study_preferences for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Only payment services may grant or change paid access.
revoke insert, update, delete, truncate, references, trigger on public.subscriptions from public, anon, authenticated;
grant select on public.subscriptions to authenticated;
create function public.curve_has_paid_access() returns boolean
language sql stable security invoker set search_path = public as $$
  select exists(select 1 from public.subscriptions where user_id = auth.uid()
    and status = 'active' and coalesce(subscription_end, current_period_end) > now()
    and coalesce(subscription_start, current_period_start, created_at) <= now());
$$;
revoke all on function public.curve_has_paid_access() from public, anon, authenticated;
grant execute on function public.curve_has_paid_access() to authenticated, service_role;

-- Restrictive policies intersect existing owner policies instead of broadening access.
create policy curve_materials_paid on public.materials as restrictive for all to authenticated
using (coalesce(metadata->>'workspace','') <> 'curve' or (select public.curve_has_paid_access()))
with check (coalesce(metadata->>'workspace','') <> 'curve' or (select public.curve_has_paid_access()));
create policy curve_sessions_paid on public.curve_material_sessions as restrictive for all to authenticated
using ((select public.curve_has_paid_access())) with check ((select public.curve_has_paid_access()));

-- Reservation functions are security definer, so enforce paid access inside them too.
create or replace function public.reserve_material_analysis(p_material uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in to study'; end if;
  if not public.curve_has_paid_access() then raise exception 'Choose a paid plan to study'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if not exists(select 1 from materials where id = p_material and owner_user_id = uid and metadata->>'workspace' = 'curve') then raise exception 'Material unavailable'; end if;
  if (select count(*) from curve_material_requests where user_id = uid and created_at > now() - interval '24 hours') >= 30 then raise exception 'Daily AI limit reached. Continue a saved session or return tomorrow.'; end if;
  delete from curve_material_requests where user_id = uid and created_at < now() - interval '7 days';
  insert into curve_material_requests(user_id) values(uid);
end $$;

create table public.curve_payments (
  payment_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check(plan in ('monthly','semester')),
  created_at timestamptz not null default now(),
  revoked boolean not null default false
);
alter table public.curve_payments enable row level security;
revoke all on public.curve_payments from public, anon, authenticated;
grant all on public.curve_payments to service_role;
create index on public.curve_payments(user_id);

-- Service-only, atomic and idempotent across webhook delivery retries.
create function public.curve_record_payment(p_payment text, p_user uuid, p_plan text, p_revoke boolean default false)
returns void language plpgsql security invoker set search_path = public as $$
declare added text; previous_end timestamptz;
begin
  if p_plan not in ('monthly','semester') or length(p_payment) < 3 then raise exception 'Invalid payment'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  if p_revoke then
    insert into curve_payments(payment_id,user_id,plan,revoked) values(p_payment,p_user,p_plan,true)
      on conflict(payment_id) do update set revoked=true;
    update subscriptions set status='cancelled', updated_at=now() where user_id=p_user and subscription_id=p_payment;
    return;
  end if;
  insert into curve_payments(payment_id,user_id,plan) values(p_payment,p_user,p_plan)
    on conflict(payment_id) do nothing returning payment_id into added;
  if added is null then return; end if;
  select coalesce(subscription_end,current_period_end) into previous_end from subscriptions where user_id=p_user and status='active';
  insert into subscriptions(user_id, status, plan_id, payment_provider, subscription_id, subscription_start, subscription_end, updated_at)
  values(p_user,'active',p_plan,'dodo',p_payment,now(),greatest(coalesce(previous_end,now()),now()) + make_interval(days => case when p_plan='semester' then 120 else 30 end),now())
  on conflict(user_id) do update set status=excluded.status,plan_id=excluded.plan_id,payment_provider=excluded.payment_provider,
    subscription_id=excluded.subscription_id,subscription_start=excluded.subscription_start,subscription_end=excluded.subscription_end,updated_at=excluded.updated_at;
end $$;
revoke all on function public.curve_record_payment(text,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.curve_record_payment(text,uuid,text,boolean) to service_role;
