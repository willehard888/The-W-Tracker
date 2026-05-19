-- ────────────────────────────────────────────────────────────────────────────
-- Storage RLS policies — verbatim from Lovable's source project inventory.
-- Run against the destination Supabase project AFTER pg_dump restore (or
-- against an empty destination if you skip the dump for storage).
--
-- Two buckets, both public, with per-folder write isolation:
--   feed-images   — user posts media. Path: <user_id>/<filename>
--   proof-photos  — daily check-in proofs. Path: <user_id>/<filename>
--
-- The first segment of the object name is enforced to equal the
-- authenticated user's id, so users can only INSERT/UPDATE/DELETE inside
-- their own folder. Reads are public (the buckets themselves are public).
-- ────────────────────────────────────────────────────────────────────────────

-- Ensure the buckets exist on the destination. ON CONFLICT keeps re-running
-- this script safe.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('feed-images',  'feed-images',  true),
  ('proof-photos', 'proof-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Drop the policies first so this script is idempotent on re-runs.
DROP POLICY IF EXISTS "Anyone can view feed images"                     ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view proof photos"                    ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own feed images"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own proof photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own feed images"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own proof photos" ON storage.objects;
DROP POLICY IF EXISTS "Users upload to own feed-images folder"          ON storage.objects;
DROP POLICY IF EXISTS "Users upload to own proof-photos folder"         ON storage.objects;

-- ── Public read (both buckets) ────────────────────────────────────────────
CREATE POLICY "Anyone can view feed images" ON storage.objects FOR SELECT
USING (bucket_id = 'feed-images');

CREATE POLICY "Anyone can view proof photos" ON storage.objects FOR SELECT
USING (bucket_id = 'proof-photos');

-- ── Authenticated INSERT into own folder ──────────────────────────────────
CREATE POLICY "Users upload to own feed-images folder" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'feed-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users upload to own proof-photos folder" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'proof-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ── Authenticated UPDATE own files ────────────────────────────────────────
CREATE POLICY "Authenticated users can update own feed images" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'feed-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'feed-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can update own proof photos" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'proof-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'proof-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ── Authenticated DELETE own files ────────────────────────────────────────
CREATE POLICY "Authenticated users can delete own feed images" ON storage.objects FOR DELETE
USING (
  bucket_id = 'feed-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can delete own proof photos" ON storage.objects FOR DELETE
USING (
  bucket_id = 'proof-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Verify
SELECT polname, polrelid::regclass, polcmd
FROM pg_policy
WHERE polrelid = 'storage.objects'::regclass
ORDER BY polname;
