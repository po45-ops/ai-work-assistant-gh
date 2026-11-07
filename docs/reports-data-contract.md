# Reports integration

Reports use exact counts from the existing `tasks` and `projects` tables for the authenticated user. The seven daily completion counts are grouped by `completed_at` in Asia/Bangkok time. Open and overdue counts exclude archived, completed, and cancelled tasks. Project counts reflect current active and completed status.

The page does not claim measured focus time, a productivity score, or AI insight because those sources are not connected. No schema change was made.
