# Projects integration

The Projects UI uses the existing `public.projects`, `public.milestones`, and `public.tasks` tables. No migration is required. Schema and policies were checked in the production Supabase dashboard on 2026-09-27 before implementation.

- Projects and milestones each have an `ALL` RLS policy requiring `auth.uid() = user_id`. Every application query also filters by `user_id`.
- The project status values are `planning`, `active`, `on_hold`, `completed`, and `cancelled`. Priority is `high`, `medium`, or `low`; risk is `green`, `yellow`, `orange`, or `red`. Progress is constrained to 0–100.
- Milestone status values are `not_started`, `in_progress`, `waiting`, `done`, and `cancelled`. The application verifies ownership of the parent project before creating a milestone.
- Both tables have a `BEFORE UPDATE` trigger that refreshes `updated_at`. Writes compare the submitted `updated_at` with the current row to prevent stale edits.
- Deleting a project requires explicit confirmation. The server checks its owner and `updated_at` before deletion. Linked tasks remain in the database and lose their project reference through the existing `ON DELETE SET NULL` constraint. Milestones are removed only when the database permits the project deletion; any foreign-key failure is reported to the user.
