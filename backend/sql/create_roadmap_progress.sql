-- Tabla de progreso por usuario por roadmap
create table if not exists roadmap_progress (
  user_id        uuid references auth.users(id) on delete cascade,
  roadmap_id     uuid references roadmaps(id)   on delete cascade,
  completed_nodes text[] not null default '{}',
  updated_at     timestamptz default now(),
  primary key (user_id, roadmap_id)
);

-- RLS
alter table roadmap_progress enable row level security;

create policy "Users can manage their own progress"
  on roadmap_progress
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
