-- ============================================================
-- Nutrition engine (6/6) — private `meal-photos` bucket.
--
-- Meal photos are kept only when the user opts in ("keep photo"), and they
-- are NEVER shown to anyone else — no feed, no coach, no tribe. So unlike
-- proof-photos (owner writes, tribe reads) every verb here is owner-only:
-- the first path segment must be the caller's uid.
-- Reads go through signed URLs (src/lib/signed-url.ts PRIVATE_BUCKETS).
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('meal-photos', 'meal-photos', false, 2097152, ARRAY['image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "meal photos owner read" ON storage.objects;
CREATE POLICY "meal photos owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "meal photos owner upload" ON storage.objects;
CREATE POLICY "meal photos owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "meal photos owner delete" ON storage.objects;
CREATE POLICY "meal photos owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
