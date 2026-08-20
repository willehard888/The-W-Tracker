-- Kill the legacy 'normal' tier at the SOURCE. 20260812071411 normalized
-- existing rows but left the column DEFAULT at 'normal' (from the original
-- 20260322 schema) — so every NEW profile was born with a tier that is not
-- in the client's ladder (TIER_ORDER.indexOf === -1) until the nightly
-- update_status_tier recomputed it. Client now also canonicalizes 'normal'
-- defensively, but new rows should simply start as 'recruit'.

ALTER TABLE public.profiles ALTER COLUMN status_tier SET DEFAULT 'recruit';
UPDATE public.profiles SET status_tier = 'recruit' WHERE status_tier = 'normal';
