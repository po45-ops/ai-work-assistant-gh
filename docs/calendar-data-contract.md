# Calendar integration

The Calendar reads due dates from the existing `tasks`, `milestones`, and `projects` tables for the signed-in user. With Google Calendar connected, it also lists that user's primary-calendar events for the selected month. Tasks created or edited after connection sync their due date as an all-day Google event.

- Tasks use `due_date` and exclude archived rows. Completed tasks remain visible while retained by the task policy.
- Milestones use `due_date`, and projects use `target_date`.
- Dates are treated as calendar dates, with the initial current day based on `Asia/Bangkok`.
- The month view bounds each table query to the selected month. Each query currently caps at 1,000 rows; the UI shows a truncation notice if that limit is reached.
- Google events link back to Google Calendar; linked task events are deduplicated in the month view.
- Adding and editing tasks remains in the Tasks page. The Calendar links there and to project details rather than presenting an inactive event button.
- LINE AI can create a Google Calendar event after the user confirms the proposed title, date, and optional time.

Integration schema and provider setup are documented in `docs/integrations-setup.md`.
