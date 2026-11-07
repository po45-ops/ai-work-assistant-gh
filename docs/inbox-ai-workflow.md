# Inbox AI workflow rollout

The Inbox workflow now supports a private attachment, AI analysis, an editable review draft, and an explicit save step. Task and project drafts are committed through `commit_inbox_ai_draft`, which writes the Inbox status and related records in one database transaction. Dated tasks use the existing Google Calendar task sync. Calendar event drafts are created only after user confirmation. LINE text requests can also create a confirmed project plan with milestones and child tasks.

## Database setup

Apply `supabase/migrations/202609270004_inbox_ai_workflow.sql` to the same Supabase project used by AI Personal Work Assistant before deploying the application. It adds draft/commit fields to `inbox`, creates the private `inbox-files` Storage bucket and per-user policies, adds attachment metadata, and installs the transactional commit function.

The migration is additive and does not rewrite existing Inbox rows. Existing pending Inbox entries can be analyzed from the Inbox page after the migration is applied.

## Runtime requirements

- Keep `GEMINI_API_KEY` configured as a server-only environment variable. The application tries the configured Gemini models and the existing Flash fallback.
- Keep the existing Google Calendar OAuth configuration for saving Calendar events and syncing dated tasks. Users must already have connected Google Calendar in Settings.
- Attachments are limited to one file up to 3 MB per Inbox entry: PDF, DOCX, TXT, JPG, PNG, or WEBP. DOCX extraction reads document text; scanned pages embedded in Word should be attached as PDF or image. Files remain private in Supabase Storage. The user-visible notice explains that analysis sends the selected file to Google Gemini.
- The LINE assistant can draft a project from text and asks for confirmation before creating it. File uploads are handled by the web Inbox workflow.

## Verification

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` after applying the migration and before deploying.
