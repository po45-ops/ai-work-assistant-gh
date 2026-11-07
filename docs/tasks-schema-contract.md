# Verified Tasks database contract

Inspected the existing AI Personal Work Assistant Supabase project through its authenticated SQL Editor on 2026-09-27. Inspection used SELECT against information_schema, pg_constraint, pg_policies, pg_class and pg_trigger. No schema, permission or user-data changes were made during inspection.

## Relevant task fields

- `id`: uuid, primary key, default gen_random_uuid().
- `user_id`: non-null uuid, references auth.users.
- `title`: non-null text; `description`: nullable text.
- `status`: non-null text, default `not_started`; CHECK permits `not_started`, `in_progress`, `waiting`, `done`, `cancelled`.
- `priority`: non-null text, default `medium`; CHECK permits `high`, `medium`, `low`.
- `due_date`: nullable date (calendar date, not timestamp).
- `project_id`: nullable uuid, references projects, ON DELETE SET NULL.
- `milestone_id`: nullable uuid, references milestones, ON DELETE SET NULL.
- `estimated_minutes`: nullable integer with CHECK >= 0.
- `completed_at`, `archive_after`, `archived_at`: nullable timestamptz.
- `created_at`, `updated_at`: non-null timestamptz, default now().
- Other existing task columns remain intact: source_inbox_id, parent_task_id, task_type, start_date, actual_minutes, importance, urgency, energy_level, ai_reason, note, is_fixed_date, auto_schedule, calendar_event_id.

## Projects and ownership

`projects.id` is the uuid primary key. `projects.user_id` is a non-null uuid referencing auth.users. `projects.name` is non-null text. The application only reads id/name for task assignment; it does not replace existing project data.

Both tables have RLS enabled. Their `projects_own_rows` / `tasks_own_rows` policies apply to ALL operations for the authenticated role, with both USING and WITH CHECK expressions `auth.uid() = user_id`.

The application also verifies the authenticated user on the server, includes user_id in all queries and mutations, and verifies project ownership before assigning it. When moving a task to another project, it clears the old milestone_id so it cannot retain a milestone from the previous project. Updates compare the original updated_at value to prevent overwriting concurrent edits.

## Existing retention triggers

`trg_task_archive` runs BEFORE INSERT OR UPDATE on tasks and calls `set_task_archive_date()`:

- On `status = 'done'`, it sets completed_at if absent.
- It reads settings.retention_completed_days for the task owner, falling back to 30 days.
- It sets archive_after if absent to completed_at plus the retention interval.
- On a transition from done to another status, it clears completed_at and archive_after.
- It does not delete the task.

`trg_tasks_updated` and `trg_projects_updated` call touch_updated_at() before UPDATE.

The application changes status only and preserves these existing triggers. It excludes rows with archived_at set, while completed rows remain visible until actually archived. No purge, cron job or schema migration is introduced. Inspection does not establish whether a scheduled cleanup job already exists.
