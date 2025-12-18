create table if not exists video_generations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  topic text not null,
  script text,
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  progress integer default 0,
  current_step text,
  logs jsonb[] default array[]::jsonb[],
  video_url text,
  subtitle_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table video_generations enable row level security;

-- Policies
create policy "Users can view their own generations"
  on video_generations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own generations"
  on video_generations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own generations"
  on video_generations for update
  using (auth.uid() = user_id);

-- Storage bucket for videos (optional, if you want to use Supabase Storage)
insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

create policy "Public Access to Videos"
  on storage.objects for select
  using ( bucket_id = 'videos' );

create policy "Users can upload videos"
  on storage.objects for insert
  with check ( bucket_id = 'videos' and auth.uid() = owner );
