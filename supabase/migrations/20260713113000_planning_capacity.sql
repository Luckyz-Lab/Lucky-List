alter table public.tasks
  add column if not exists estimate_minutes int not null default 30
    check (estimate_minutes between 5 and 480);

alter table public.user_settings
  add column if not exists daily_capacity_minutes int not null default 360
    check (daily_capacity_minutes between 60 and 960);
