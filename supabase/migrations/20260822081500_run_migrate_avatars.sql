-- ============================================================
-- S7b (part 2): one-shot invocation of migrate-avatars.
-- Copies existing ${uid}/avatar-* objects from proof-photos into the
-- public avatars bucket and rewrites profiles.avatar_url. Must run
-- BEFORE proof-photos flips private (next migration). Async via
-- pg_net; the response is inspectable with debug_net_result().
-- ============================================================

DO $$
DECLARE req_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/migrate-avatars',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) INTO req_id;
  RAISE NOTICE 'migrate-avatars dispatched, net request id %', req_id;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'migrate-avatars dispatch failed: % — run manually', SQLERRM;
END $$;
