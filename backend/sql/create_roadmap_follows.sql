-- Tabla de seguimiento de roadmaps
create table if not exists roadmap_follows (
  user_id    uuid references auth.users(id) on delete cascade,
  roadmap_id uuid references roadmaps(id)   on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, roadmap_id)
);

-- RLS
alter table roadmap_follows enable row level security;

create policy "Users can manage their own follows"
  on roadmap_follows
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
