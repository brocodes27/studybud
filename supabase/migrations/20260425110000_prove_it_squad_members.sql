-- Squad members: who is actually in the squad. Without this, Squad Prove-It
-- has no social/accountability surface — only one-off attempts.

create table if not exists public.prove_it_squad_members (
  squad_id text not null references public.prove_it_squads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  joined_at timestamptz not null default now(),
  primary key (squad_id, user_id)
);
create index if not exists prove_it_squad_members_user_idx
  on public.prove_it_squad_members(user_id);
alter table public.prove_it_squad_members enable row level security;
drop policy if exists "Authenticated can read squad members" on public.prove_it_squad_members;
create policy "Authenticated can read squad members"
  on public.prove_it_squad_members for select
  to authenticated
  using (true);
drop policy if exists "Users can join squads as themselves" on public.prove_it_squad_members;
create policy "Users can join squads as themselves"
  on public.prove_it_squad_members for insert
  to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "Users can update their own membership" on public.prove_it_squad_members;
create policy "Users can update their own membership"
  on public.prove_it_squad_members for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Users can leave their own membership" on public.prove_it_squad_members;
create policy "Users can leave their own membership"
  on public.prove_it_squad_members for delete
  to authenticated
  using (auth.uid() = user_id);
