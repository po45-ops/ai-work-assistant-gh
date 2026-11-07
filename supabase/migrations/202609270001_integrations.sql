create table if not exists public.integration_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_refresh_token_ciphertext text,
  google_calendar_id text not null default 'primary',
  google_email text,
  google_connected_at timestamptz,
  line_user_id text unique,
  line_display_name text,
  line_link_code_hash text,
  line_link_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.integration_connections enable row level security;
revoke all on public.integration_connections from anon, authenticated;
grant all on public.integration_connections to service_role;

create table if not exists public.line_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) <= 5000),
  source_event_id text unique,
  pending_action jsonb,
  pending_action_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists line_messages_user_created_idx
  on public.line_messages (user_id, created_at desc);

alter table public.line_messages enable row level security;
drop policy if exists "Users can read their own LINE conversation" on public.line_messages;
create policy "Users can read their own LINE conversation"
  on public.line_messages for select to authenticated
  using (auth.uid() = user_id);
revoke all on public.line_messages from anon, authenticated;
grant select on public.line_messages to authenticated;
grant all on public.line_messages to service_role;
grant usage, select on sequence public.line_messages_id_seq to service_role;

create or replace function public.touch_integration_connection_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_integration_connection_updated_at on public.integration_connections;
create trigger trg_integration_connection_updated_at
before update on public.integration_connections
for each row execute function public.touch_integration_connection_updated_at();
