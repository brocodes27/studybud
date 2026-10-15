-- Keep the free-upload claim after material deletion so the allowance cannot reset.
create table public.curve_free_syllabus_uploads (
  user_id uuid primary key references auth.users(id) on delete cascade,
  material_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.curve_free_syllabus_uploads enable row level security;
revoke all on public.curve_free_syllabus_uploads from public, anon, authenticated;
grant select on public.curve_free_syllabus_uploads to authenticated;
grant all on public.curve_free_syllabus_uploads to service_role;
create policy free_syllabus_own on public.curve_free_syllabus_uploads for select to authenticated
using ((select auth.uid()) = user_id);

-- BEFORE triggers run before RLS WITH CHECK; serialize competing uploads per user.
create function public.claim_curve_free_syllabus() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); claimed uuid;
begin
  if uid is null or coalesce(new.metadata->>'workspace','') <> 'curve' then return new; end if;
  if new.owner_user_id is distinct from uid then raise exception 'Material unavailable'; end if;
  if public.curve_has_paid_access() then return new; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select material_id into claimed from curve_free_syllabus_uploads where user_id = uid;
  if claimed is null then
    insert into curve_free_syllabus_uploads(user_id,material_id) values(uid,new.id);
  elsif claimed <> new.id or TG_OP = 'INSERT' or coalesce(old.metadata->>'workspace','') <> 'curve' then
    raise exception 'Your free syllabus upload has been used. Choose a $12 monthly or $39 semester plan.';
  end if;
  return new;
end $$;
revoke all on function public.claim_curve_free_syllabus() from public, anon, authenticated;
create trigger claim_curve_free_syllabus before insert or update on public.materials
for each row execute function public.claim_curve_free_syllabus();

drop policy curve_materials_paid on public.materials;
create policy curve_materials_paid on public.materials as restrictive for all to authenticated
using (coalesce(metadata->>'workspace','') <> 'curve' or (select public.curve_has_paid_access()) or
  (owner_user_id = (select auth.uid()) and exists(select 1 from public.curve_free_syllabus_uploads f where f.user_id = (select auth.uid()) and f.material_id = materials.id)))
with check (coalesce(metadata->>'workspace','') <> 'curve' or (select public.curve_has_paid_access()) or
  (owner_user_id = (select auth.uid()) and exists(select 1 from public.curve_free_syllabus_uploads f where f.user_id = (select auth.uid()) and f.material_id = materials.id)));

create or replace function public.reserve_material_analysis(p_material uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); paid boolean;
begin
  if uid is null then raise exception 'Sign in to study'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  paid := public.curve_has_paid_access();
  if not paid and not exists(select 1 from curve_free_syllabus_uploads where user_id = uid and material_id = p_material) then
    raise exception 'Upload your one free syllabus to preview your plan';
  end if;
  if not exists(select 1 from materials where id = p_material and owner_user_id = uid and metadata->>'workspace' = 'curve') then raise exception 'Material unavailable'; end if;
  if (select count(*) from curve_material_requests where user_id = uid and created_at > now() - interval '24 hours') >= (case when paid then 250 else 5 end) then
    raise exception 'Daily AI limit reached. Return tomorrow to retry.';
  end if;
  delete from curve_material_requests where user_id = uid and created_at < now() - interval '7 days';
  insert into curve_material_requests(user_id) values(uid);
end $$;

-- Analysis is free for the claimed syllabus; creating an assessment remains paid.
create or replace function public.reserve_material_session(p_id uuid, p_material uuid, p_mode text, p_topic text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); result uuid;
begin
  if uid is null then raise exception 'Sign in to study'; end if;
  if not public.curve_has_paid_access() then raise exception 'Choose a paid plan for dynamic assessments'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select id into result from curve_material_sessions where id = p_id and user_id = uid;
  if result is not null then raise exception 'Session already reserved. Return to your library to resume it.'; end if;
  if not exists(select 1 from materials where id = p_material and owner_user_id = uid and metadata->>'workspace' = 'curve') then raise exception 'Material unavailable'; end if;
  perform reserve_material_analysis(p_material);
  insert into curve_material_sessions(id, user_id, material_id, mode, topic) values(p_id, uid, p_material, p_mode, left(p_topic, 200));
  return p_id;
end $$;
