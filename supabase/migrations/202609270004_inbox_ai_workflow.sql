alter table public.inbox
  add column if not exists ai_draft jsonb,
  add column if not exists ai_commit_result jsonb,
  add column if not exists ai_calendar_event_id text,
  add column if not exists ai_analyzed_at timestamptz,
  add column if not exists ai_clarification_response text;

create table if not exists public.inbox_attachments (
  id uuid primary key default gen_random_uuid(),
  inbox_id uuid not null references public.inbox(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (length(file_name) <= 255),
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 3145728),
  created_at timestamptz not null default now(),
  unique (inbox_id)
);

create index if not exists inbox_attachments_user_inbox_idx
  on public.inbox_attachments(user_id, inbox_id);

alter table public.inbox_attachments enable row level security;
revoke all on public.inbox_attachments from anon, authenticated;
grant select, insert, delete on public.inbox_attachments to authenticated;
grant all on public.inbox_attachments to service_role;
drop policy if exists "Users can read their own inbox attachments" on public.inbox_attachments;
create policy "Users can read their own inbox attachments"
  on public.inbox_attachments for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create their own inbox attachments" on public.inbox_attachments;
create policy "Users can create their own inbox attachments"
  on public.inbox_attachments for insert to authenticated with check (
    auth.uid() = user_id
    and storage_path like auth.uid()::text || '/%'
    and exists (select 1 from public.inbox i where i.id = inbox_id and i.user_id = auth.uid())
  );
drop policy if exists "Users can delete their own inbox attachments" on public.inbox_attachments;
create policy "Users can delete their own inbox attachments"
  on public.inbox_attachments for delete to authenticated using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inbox-files',
  'inbox-files',
  false,
  3145728,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload files to their own inbox folder" on storage.objects;
create policy "Users can upload files to their own inbox folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'inbox-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can read files from their own inbox folder" on storage.objects;
create policy "Users can read files from their own inbox folder"
  on storage.objects for select to authenticated
  using (bucket_id = 'inbox-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can delete files from their own inbox folder" on storage.objects;
create policy "Users can delete files from their own inbox folder"
  on storage.objects for delete to authenticated
  using (bucket_id = 'inbox-files' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.commit_inbox_ai_draft(p_inbox_id uuid, p_draft jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_inbox public.inbox%rowtype;
  v_kind text;
  v_result jsonb;
  v_project_id uuid;
  v_task_id uuid;
  v_milestone jsonb;
  v_task jsonb;
  v_milestone_ids uuid[] := '{}';
  v_task_ids uuid[] := '{}';
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_inbox from public.inbox
  where id = p_inbox_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Inbox item not found'; end if;
  if v_inbox.ai_commit_result is not null then return v_inbox.ai_commit_result; end if;

  v_kind := p_draft->>'kind';
  if v_kind = 'note' then
    if length(coalesce(p_draft->>'title', '')) = 0 then raise exception 'A title is required'; end if;
    v_result := jsonb_build_object('kind', 'note');
  elsif v_kind = 'task' then
    if length(coalesce(p_draft->>'title', '')) = 0 or p_draft->>'priority' not in ('high', 'medium', 'low') then raise exception 'Invalid task draft'; end if;
    insert into public.tasks (user_id, source_inbox_id, title, description, status, priority, due_date, estimated_minutes)
    values (
      v_user_id, p_inbox_id, left(coalesce(p_draft->>'title', ''), 200), nullif(p_draft->>'description', ''),
      'not_started', coalesce(nullif(p_draft->>'priority', ''), 'medium'),
      nullif(p_draft->>'due_date', '')::date, nullif(p_draft->>'estimated_minutes', '')::integer
    ) returning id into v_task_id;
    v_result := jsonb_build_object('kind', 'task', 'task_ids', jsonb_build_array(v_task_id));
  elsif v_kind = 'project' then
    if length(coalesce(p_draft->>'title', '')) = 0 or p_draft->>'priority' not in ('high', 'medium', 'low') then raise exception 'Invalid project draft'; end if;
    insert into public.projects (user_id, name, goal, description, status, priority, risk_level, progress_percent, start_date, target_date)
    values (
      v_user_id, left(coalesce(p_draft->>'title', ''), 200), nullif(p_draft->>'goal', ''), nullif(p_draft->>'description', ''),
      'planning', coalesce(nullif(p_draft->>'priority', ''), 'medium'), 'green', 0,
      nullif(p_draft->>'start_date', '')::date, nullif(p_draft->>'due_date', '')::date
    ) returning id into v_project_id;

    if jsonb_array_length(coalesce(p_draft->'milestones', '[]'::jsonb)) > 20 or jsonb_array_length(coalesce(p_draft->'tasks', '[]'::jsonb)) > 20 then
      raise exception 'Too many project items';
    end if;
    for v_milestone in select value from jsonb_array_elements(coalesce(p_draft->'milestones', '[]'::jsonb)) loop
      insert into public.milestones (user_id, project_id, name, description, status, priority, progress_percent, due_date)
      values (
        v_user_id, v_project_id, left(coalesce(v_milestone->>'name', ''), 200), nullif(v_milestone->>'description', ''),
        'not_started', coalesce(nullif(v_milestone->>'priority', ''), 'medium'), 0, nullif(v_milestone->>'due_date', '')::date
      ) returning id into v_task_id;
      v_milestone_ids := array_append(v_milestone_ids, v_task_id);
    end loop;

    for v_task in select value from jsonb_array_elements(coalesce(p_draft->'tasks', '[]'::jsonb)) loop
      insert into public.tasks (user_id, project_id, milestone_id, title, description, status, priority, due_date, estimated_minutes)
      values (
        v_user_id, v_project_id,
        case when nullif(v_task->>'milestone_index', '') is null then null else v_milestone_ids[(v_task->>'milestone_index')::integer + 1] end,
        left(coalesce(v_task->>'title', ''), 200), nullif(v_task->>'description', ''),
        'not_started', coalesce(nullif(v_task->>'priority', ''), 'medium'),
        nullif(v_task->>'due_date', '')::date, nullif(v_task->>'estimated_minutes', '')::integer
      ) returning id into v_task_id;
      v_task_ids := array_append(v_task_ids, v_task_id);
    end loop;
    v_result := jsonb_build_object('kind', 'project', 'project_id', v_project_id, 'milestone_ids', to_jsonb(v_milestone_ids), 'task_ids', to_jsonb(v_task_ids));
  else
    raise exception 'Unsupported inbox draft type';
  end if;

  update public.inbox set
    ai_draft = p_draft,
    ai_summary = p_draft->>'summary',
    clarification_question = null,
    ai_commit_result = v_result,
    processed = true,
    processing_status = 'processed'
  where id = p_inbox_id and user_id = v_user_id;
  return v_result;
end;
$$;

revoke all on function public.commit_inbox_ai_draft(uuid, jsonb) from public, anon;
grant execute on function public.commit_inbox_ai_draft(uuid, jsonb) to authenticated;
