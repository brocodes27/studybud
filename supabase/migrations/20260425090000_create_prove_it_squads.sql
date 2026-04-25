create table if not exists public.prove_it_squads (
  id text primary key,
  subject text not null,
  topic text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.mastery_receipts
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.prove_it_squad_attempts (
  id uuid primary key default gen_random_uuid(),
  squad_id text not null references public.prove_it_squads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  receipt_slug text not null,
  subject text not null,
  topic text not null,
  rigor_score numeric not null,
  created_at timestamptz not null default now(),
  unique (squad_id, user_id, topic)
);

alter table public.prove_it_squads enable row level security;
alter table public.prove_it_squad_attempts enable row level security;

drop policy if exists "Anyone authenticated can read prove it squads" on public.prove_it_squads;
create policy "Anyone authenticated can read prove it squads"
  on public.prove_it_squads for select
  to authenticated
  using (true);

drop policy if exists "Anyone authenticated can create prove it squads" on public.prove_it_squads;
create policy "Anyone authenticated can create prove it squads"
  on public.prove_it_squads for insert
  to authenticated
  with check (auth.uid() = created_by or created_by is null);

drop policy if exists "Creators can update prove it squads" on public.prove_it_squads;
create policy "Creators can update prove it squads"
  on public.prove_it_squads for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "Anyone authenticated can read squad attempts" on public.prove_it_squad_attempts;
create policy "Anyone authenticated can read squad attempts"
  on public.prove_it_squad_attempts for select
  to authenticated
  using (true);

drop policy if exists "Users can upsert their own squad attempts" on public.prove_it_squad_attempts;
create policy "Users can upsert their own squad attempts"
  on public.prove_it_squad_attempts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own squad attempts" on public.prove_it_squad_attempts;
create policy "Users can update their own squad attempts"
  on public.prove_it_squad_attempts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
