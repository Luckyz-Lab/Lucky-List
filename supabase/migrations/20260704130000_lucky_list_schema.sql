create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  category text,
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High', 'Urgent')),
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  board_state text not null default 'todo' check (board_state in ('todo', 'wip', 'done')),
  start_date date,
  due_at timestamptz,
  reminder_at timestamptz,
  repeat_rule jsonb not null default '{"frequency":"none"}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subtasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  position int not null default 0,
  completed_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  theme text not null default 'light' check (theme in ('dark', 'light', 'system')),
  deadline_threshold_days int not null default 3 check (deadline_threshold_days between 1 and 31),
  categories text[] not null default array['Project', 'IT', 'Marketing', 'Personal', 'Other'],
  notifications_enabled boolean not null default false,
  auto_backup_minutes int not null default 60,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists categories_user_id_idx on public.categories (user_id);
create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists tasks_user_updated_idx on public.tasks (user_id, updated_at desc);
create index if not exists tasks_user_board_idx on public.tasks (user_id, board_state);
create index if not exists tasks_active_due_idx on public.tasks (user_id, due_at) where deleted_at is null and archived_at is null;
create index if not exists subtasks_task_id_idx on public.subtasks (task_id);
create index if not exists subtasks_user_id_idx on public.subtasks (user_id);
create index if not exists user_settings_user_id_idx on public.user_settings (user_id);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.user_settings enable row level security;

create policy "profiles own rows" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "categories own rows" on public.categories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "tasks own rows" on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "subtasks own rows" on public.subtasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_settings own rows" on public.user_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
