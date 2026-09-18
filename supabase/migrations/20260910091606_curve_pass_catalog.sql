-- Add pass products without changing the existing recurring product.
alter table public.subscription_plans drop constraint subscription_plans_interval_type_check;
alter table public.subscription_plans add constraint subscription_plans_interval_type_check check(interval_type in ('monthly','yearly','one_time'));
insert into public.subscription_plans(id,name,description,price,currency,interval_type,trial_days,features,is_active) values
('curve_monthly','Curve Monthly pass','One payment for 30 days of access',1299,'USD','one_time',0,'[]',true),
('curve_semester','Curve Semester pass','One payment for 120 days of access',3900,'USD','one_time',0,'[]',true);
create or replace function public.curve_record_payment(p_payment text, p_user uuid, p_plan text, p_revoke boolean default false)
returns void language plpgsql security invoker set search_path = public as $$
declare added text; previous_end timestamptz; next_end timestamptz;
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
  next_end := greatest(coalesce(previous_end,now()),now()) + make_interval(days => case when p_plan='semester' then 120 else 30 end);
  insert into subscriptions(user_id, status, plan_id, payment_provider, subscription_id, subscription_start, subscription_end, current_period_start, current_period_end, updated_at)
  values(p_user,'active','curve_' || p_plan,'dodo',p_payment,now(),next_end,now(),next_end,now())
  on conflict(user_id) do update set status=excluded.status,plan_id=excluded.plan_id,payment_provider=excluded.payment_provider,
    current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,subscription_id=excluded.subscription_id,subscription_start=excluded.subscription_start,subscription_end=excluded.subscription_end,updated_at=excluded.updated_at;
end $$;
revoke all on function public.curve_record_payment(text,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.curve_record_payment(text,uuid,text,boolean) to service_role;
