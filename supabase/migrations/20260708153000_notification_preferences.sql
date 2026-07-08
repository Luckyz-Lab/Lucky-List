alter table public.user_settings
  add column if not exists default_reminder_mode text not null default 'day-start'
    check (default_reminder_mode in ('none', 'due-time', '30-min-before', 'day-start')),
  add column if not exists daily_digest_enabled boolean not null default true,
  add column if not exists daily_digest_time text not null default '09:00'
    check (daily_digest_time ~ '^\d{2}:\d{2}$');
