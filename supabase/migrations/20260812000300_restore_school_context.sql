-- Repairs two objects that migration 20260713010000 was recorded as having
-- created but which do not exist in the database: the
-- `user_active_school_context` table and `set_active_school_context()`.
--
-- Everything else from that migration (school_chains, chain_memberships,
-- chain_invitations, fn_can_access_school, fn_my_school_id, and the rest) is
-- present, so this restores exactly the gap rather than re-running it.
--
-- The symptom was two 404s on every sign-in: AuthContext calls the RPC from two
-- places, and its `isSetActiveSchoolContextSupported` guard only latches after
-- the first failure returns. Consumer students were unaffected — the guard
-- disables the call and the app carries on — but a table that RLS policies can
-- reference and that silently is not there is worth not leaving lying around.

create table if not exists public.user_active_school_context (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.user_active_school_context enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_active_school_context'
      and policyname = 'active_school_context_self_select'
  ) then
    create policy active_school_context_self_select
      on public.user_active_school_context for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
end
$$;

create or replace function public.set_active_school_context(p_school_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_school_id is null then
    delete from public.user_active_school_context where user_id = auth.uid();
    return;
  end if;

  if not public.fn_can_access_school(p_school_id) then
    raise exception 'Not allowed to select this school';
  end if;

  insert into public.user_active_school_context (user_id, school_id, updated_at)
  values (auth.uid(), p_school_id, now())
  on conflict (user_id) do update
  set school_id = excluded.school_id,
      updated_at = now();
end;
$$;

revoke all on function public.set_active_school_context(uuid) from public;
grant execute on function public.set_active_school_context(uuid) to authenticated;
