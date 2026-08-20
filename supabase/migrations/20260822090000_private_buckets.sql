-- ============================================================
-- S7b/S7c (final): flip proof-photos + feed-images private.
-- Prereqs already shipped, in order:
--   * avatars live in their own PUBLIC `avatars` bucket (migrated 2/2)
--   * every render site resolves these buckets via signed URLs
--     (useSignedMediaUrl / AppImage / GridMedia / PostMedia)
-- SELECT policies stay `TO authenticated` (S2) — that is what lets a
-- logged-in member create a signed URL for any object in the bucket,
-- which the product needs (battle proofs are shown to opponents/voters,
-- and check-in proofs are reused as feed post images).
-- After this, the old /object/public/ URLs return 400 for everyone —
-- the DB keeps storing them as canonical bucket+key pointers.
-- ============================================================

UPDATE storage.buckets
SET public = false
WHERE id IN ('proof-photos', 'feed-images');
