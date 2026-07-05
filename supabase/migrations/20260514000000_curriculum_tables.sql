-- curricula: stores a user's loaded curriculum for a goal
create table if not exists public.curricula (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  goal_type text not null,
  title text not null,
  source_url text,
  node_count int default 0,
  ingested_at timestamptz default now(),
  is_active boolean default true,
  metadata jsonb default '{}',
  unique(user_id, goal_type, source_url)
);
-- curriculum_nodes: hierarchical structure
create table if not exists public.curriculum_nodes (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid references public.curricula(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  node_key text not null,
  title text not null,
  description text,
  parent_key text,
  prerequisites text[] default '{}',
  depth int default 0,
  is_milestone boolean default false,
  source_url text,
  ingested_at timestamptz default now(),
  metadata jsonb default '{}',
  unique(curriculum_id, node_key)
);
-- curriculum_content: detailed content for RAG
create table if not exists public.curriculum_content (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid references public.curricula(id) on delete cascade not null,
  node_key text not null,
  content text not null,
  created_at timestamptz default now(),
  metadata jsonb default '{}',
  unique(curriculum_id, node_key)
);
-- curriculum_mastery: per-node mastery per user
create table if not exists public.curriculum_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  curriculum_id uuid references public.curricula(id) on delete cascade not null,
  node_key text not null,
  mastery_score int default 0,
  attempts int default 0,
  consecutive_correct int default 0,
  last_proved_at timestamptz,
  proven_at timestamptz,
  metadata jsonb default '{}',
  unique(user_id, curriculum_id, node_key)
);
-- RLS policies
alter table public.curricula enable row level security;
alter table public.curriculum_nodes enable row level security;
alter table public.curriculum_content enable row level security;
alter table public.curriculum_mastery enable row level security;
create policy "Users manage own curricula"
  on public.curricula for all using (auth.uid() = user_id);
create policy "Users manage own nodes"
  on public.curriculum_nodes for all using (auth.uid() = user_id);
create policy "Users manage own content"
  on public.curriculum_content for all using (auth.uid() = user_id);
create policy "Users manage own mastery"
  on public.curriculum_mastery for all using (auth.uid() = user_id);
-- Indexes for performance
create index idx_curriculum_nodes_curriculum on public.curriculum_nodes(curriculum_id);
create index idx_curriculum_nodes_parent on public.curriculum_nodes(parent_key);
create index idx_curriculum_mastery_user_curriculum on public.curriculum_mastery(user_id, curriculum_id);
create index idx_curriculum_mastery_score on public.curriculum_mastery(mastery_score) where proven_at is null;
