alter table public.integration_connections
  add column if not exists line_voice_enabled boolean not null default false;
