-- Expand Curve daily AI limit to support deep study sessions and prevent premature throttling.
-- Updates reserve_material_analysis to allow up to 250 requests per rolling 24 hours (8x expansion).
-- Adds release_material_request so transient failures do not consume student quota.

create or replace function public.reserve_material_analysis(p_material uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in to study'; end if;
  if not public.curve_has_paid_access() then raise exception 'Choose a paid plan to study'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if not exists(select 1 from materials where id = p_material and owner_user_id = uid and metadata->>'workspace' = 'curve') then raise exception 'Material unavailable'; end if;
  if (select count(*) from curve_material_requests where user_id = uid and created_at > now() - interval '24 hours') >= 250 then raise exception 'Daily AI limit reached. Continue a saved session or return tomorrow.'; end if;
  delete from curve_material_requests where user_id = uid and created_at < now() - interval '7 days';
  insert into curve_material_requests(user_id) values(uid);
end $$;

revoke all on function public.reserve_material_analysis(uuid) from public;
grant execute on function public.reserve_material_analysis(uuid) to authenticated, service_role;

-- Release a reservation if downstream generation failed so students are not penalized for errors.
create or replace function public.release_material_request(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.curve_material_requests
  where id in (
    select id from public.curve_material_requests
    where user_id = p_user
    order by created_at desc
    limit 1
  );
end $$;

revoke all on function public.release_material_request(uuid) from public;
grant execute on function public.release_material_request(uuid) to authenticated, service_role;
