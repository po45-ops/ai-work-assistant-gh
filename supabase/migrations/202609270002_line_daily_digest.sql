alter table public.integration_connections
  add column if not exists line_daily_digest_enabled boolean not null default false;

create table if not exists public.line_daily_digest_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  digest_date date not null,
  status text not null check (status in ('processing', 'sent', 'skipped', 'failed')),
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  error_code text,
  primary key (user_id, digest_date)
);

alter table public.line_daily_digest_deliveries enable row level security;
revoke all on public.line_daily_digest_deliveries from anon, authenticated;
grant all on public.line_daily_digest_deliveries to service_role;

create or replace function public.claim_line_daily_digest(p_user_id uuid, p_digest_date date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_rows integer;
begin
  insert into public.line_daily_digest_deliveries (user_id, digest_date, status, attempted_at)
  values (p_user_id, p_digest_date, 'processing', now())
  on conflict (user_id, digest_date) do update
    set status = 'processing', attempted_at = now(), error_code = null
    where public.line_daily_digest_deliveries.status = 'failed'
      or (public.line_daily_digest_deliveries.status = 'processing'
          and public.line_daily_digest_deliveries.attempted_at < now() - interval '20 minutes');
  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;

revoke all on function public.claim_line_daily_digest(uuid, date) from public, anon, authenticated;
grant execute on function public.claim_line_daily_digest(uuid, date) to service_role;
