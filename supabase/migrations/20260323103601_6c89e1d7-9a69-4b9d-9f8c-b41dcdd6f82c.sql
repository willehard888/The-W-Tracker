-- Add UPDATE and DELETE policies for storage
CREATE POLICY "Authenticated users can update own feed images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'feed-images' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'feed-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can delete own feed images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'feed-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can update own proof photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'proof-photos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'proof-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can delete own proof photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'proof-photos' AND auth.uid()::text = (storage.foldername(name))[1]);