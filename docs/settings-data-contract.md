# Settings integration

The Settings page reads the authenticated user's email and the existing `public.settings` row. The settings table uses `user_id` as its primary key and has an `ALL` RLS policy requiring `auth.uid() = user_id`. There were no settings rows at inspection time, so the page presents the database defaults and inserts a row on the first save. Later saves compare `updated_at` to prevent stale edits; the table's update trigger refreshes that timestamp.

The editable fields store working hours, daily capacity, focus/break duration, maximum important tasks, and weekend preference. Automatic scheduling is not yet active; the UI says so. The existing completed-task retention value is displayed read-only and remains at its database default of 30 days unless previously changed elsewhere. No schema migration or Auth change was made.
