begin;
do $$
declare fixture uuid := gen_random_uuid(); expiry timestamptz;
begin
  insert into auth.users(id,email,raw_user_meta_data) values(fixture,'curve-billing-fixture@example.test','{}');
  perform set_config('request.jwt.claim.sub',fixture::text,true);
  if curve_has_paid_access() then raise exception 'Unpaid user got access'; end if;
  perform curve_record_payment('pay_curve_fixture',fixture,'monthly',false);
  if not curve_has_paid_access() then raise exception 'Paid user denied'; end if;
  select subscription_end into expiry from subscriptions where user_id=fixture;
  perform curve_record_payment('pay_curve_fixture',fixture,'monthly',false);
  if (select subscription_end from subscriptions where user_id=fixture) <> expiry then raise exception 'Duplicate extended access'; end if;
  update subscriptions set subscription_end=now()-interval '1 second' where user_id=fixture;
  if curve_has_paid_access() then raise exception 'Expired user got access'; end if;
  perform curve_record_payment('pay_curve_fixture_2',fixture,'semester',false);
  if not curve_has_paid_access() then raise exception 'Renewal denied'; end if;
  perform curve_record_payment('pay_curve_fixture_2',fixture,'semester',true);
  if curve_has_paid_access() then raise exception 'Refund did not revoke'; end if;
  perform curve_record_payment('pay_curve_fixture_2',fixture,'semester',false);
  if curve_has_paid_access() then raise exception 'Late success reactivated refund'; end if;
  if has_table_privilege('authenticated','public.subscriptions','INSERT') or has_table_privilege('authenticated','public.subscriptions','UPDATE') then raise exception 'Self-upgrade privileges remain'; end if;
  if has_function_privilege('authenticated','public.curve_record_payment(text,uuid,text,boolean)','EXECUTE') then raise exception 'Payment grant exposed'; end if;
end $$;
rollback;
select 'PASS: unpaid, paid, expiry, duplicate, renewal, refund, late delivery, service-only grants; all fixtures rolled back' as result;
