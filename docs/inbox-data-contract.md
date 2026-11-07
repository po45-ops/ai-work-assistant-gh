# Inbox integration

The Inbox uses the existing `public.inbox` table. Its `ALL` RLS policy requires `auth.uid() = user_id`; the app also scopes reads by the authenticated user and sets `user_id` on inserts.

The table stores captured text with `input_type = text`, `source = web`, and the database-supported processing status `pending`. The app displays existing summaries and clarification questions if a separate processor has written them. It does not claim that AI processing or notification delivery is active, and it does not update processing status itself. No schema change was made.
