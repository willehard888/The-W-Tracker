-- ============================================================
-- Security hardening S2 — storage (proof photos / feed images).
--
-- The audit's P0: both buckets were `public = true` AND their SELECT
-- policy was `USING (bucket_id = …)` with no TO clause → PUBLIC, which
-- includes anon. That let an UNAUTHENTICATED attacker holding only the
-- public anon key call storage list() to enumerate every `<uid>/` folder
-- and harvest every user's private check-in proof photos.
--
-- This migration kills the anonymous enumeration + harvest (the harvest
-- vector) by moving both SELECT policies to `TO authenticated`, and adds
-- size + mime limits (an authenticated user could otherwise upload
-- arbitrarily large arbitrary-typed files, incl. HTML/SVG served from
-- our origin). Direct public-URL display keeps working — and those URLs
-- are now only ever exposed to authenticated feed viewers (feed reads
-- were locked to authenticated in S1).
--
-- FOLLOW-UP (separate task, needs an app-wide signed-URL refactor of the
-- sync avatar/image pipeline in src/lib/img.ts): flip public=false so
-- even a known exact URL requires a session.
-- ============================================================

-- Size + type limits on both buckets (no display impact).
UPDATE storage.buckets
SET file_size_limit = 10485760,  -- 10 MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/webm','video/quicktime']
WHERE id IN ('proof-photos','feed-images');

-- Enumeration + authenticated-endpoint reads: authenticated only.
DROP POLICY IF EXISTS "Anyone can view proof photos" ON storage.objects;
CREATE POLICY "Members can view proof photos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'proof-photos');

DROP POLICY IF EXISTS "Anyone can view feed images" ON storage.objects;
CREATE POLICY "Members can view feed images" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'feed-images');
