-- Run against a local Supabase database after migrations. All fixtures roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data)
values('00000000-0000-4000-8000-000000000091','free-syllabus@example.test','{}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
set local role authenticated;
do $$
declare first_id uuid := gen_random_uuid(); second_id uuid := gen_random_uuid();
begin
  insert into public.materials(id,owner_user_id,visibility,material_type,title,metadata)
  values(first_id,auth.uid(),'private','upload','Free syllabus','{"workspace":"curve","course":"Mathematics","topics":[]}');
  if not exists(select 1 from public.materials where id = first_id) then raise exception 'Free upload is unreadable'; end if;
  perform public.reserve_material_analysis(first_id);
  begin
    insert into public.materials(id,owner_user_id,visibility,material_type,title,metadata)
    values(second_id,auth.uid(),'private','upload','Second syllabus','{"workspace":"curve"}');
    raise exception 'Second free upload was accepted';
  exception when others then
    if sqlerrm not like 'Your free syllabus upload has been used.%' then raise; end if;
  end;
  begin
    perform public.reserve_material_session(gen_random_uuid(),first_id,'checkpoint','Limits');
    raise exception 'Free assessment was accepted';
  exception when others then
    if sqlerrm <> 'Choose a paid plan for dynamic assessments' then raise; end if;
  end;
  begin
    update public.curve_free_syllabus_uploads set material_id = second_id where user_id = auth.uid();
    raise exception 'Client could reset its claim';
  exception when insufficient_privilege then null;
  end;
  delete from public.materials where id = first_id;
  if not exists(select 1 from public.curve_free_syllabus_uploads where material_id = first_id) then raise exception 'Deletion reset allowance'; end if;
  begin
    insert into public.materials(id,owner_user_id,visibility,material_type,title,metadata)
    values(first_id,auth.uid(),'private','upload','Reused ID','{"workspace":"curve"}');
    raise exception 'Reused material ID reset allowance';
  exception when others then
    if sqlerrm not like 'Your free syllabus upload has been used.%' then raise; end if;
  end;
end $$;
reset role;
rollback;
