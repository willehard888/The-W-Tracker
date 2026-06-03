-- ============================================================
-- Recoverable account deletion: archive snapshot before hard delete
-- ============================================================
-- Problem this fixes:
--   The delete-account edge function hard-deletes the profile + ~20 tables
--   + the auth user with no recovery path. A single accidental confirmation
--   permanently destroyed a real account (and its check-ins/XP) with no way
--   to get it back short of a full-database PITR restore.
--
-- Fix:
--   A standalone archive table that is NOT foreign-keyed to auth.users (so it
--   SURVIVES the cascade). The edge function writes a full JSON snapshot of
--   the user's recoverable data here BEFORE deleting anything. Restoring an
--   account becomes a targeted re-insert from the payload instead of a
--   whole-DB restore.
--
--   RLS is enabled with NO policies → only service_role (which bypasses RLS)
--   can read/write. Clients (anon/authenticated) can never see archived data.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deleted_account_archives (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,          -- intentionally NOT a FK to auth.users
  email        text,
  username     text,
  archived_at  timestamptz NOT NULL DEFAULT now(),
  payload      jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS deleted_account_archives_user_id_idx
  ON public.deleted_account_archives (user_id);

CREATE INDEX IF NOT EXISTS deleted_account_archives_archived_at_idx
  ON public.deleted_account_archives (archived_at DESC);

ALTER TABLE public.deleted_account_archives ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service_role bypasses RLS; everyone else is denied.
