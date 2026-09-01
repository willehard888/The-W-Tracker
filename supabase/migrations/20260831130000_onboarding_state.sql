-- ============================================================
-- Contextual onboarding: one JSONB column + four guarded RPCs.
-- (Onboarding Blueprint §4 — designed 2026-08-31.)
-- No scattered hasSeenX booleans: the whole picture lives in
-- profiles.onboarding_state, written ONLY through these RPCs, and it
-- rides the existing profiles realtime subscription for cross-device
-- sync. Mirrors mark_onboarded() (20260823070000) exactly in shape.
--
-- Version semantics (bug caught during the rolled-back first attempt):
-- version is a pure grandfather ceiling moved ONLY by one-time
-- migrations — never by completion/skip calls. Eligibility depends
-- only on completed/skipped membership.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_state jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Grandfather: every profile that exists at deploy time predates the
-- contextual-onboarding system — they never see the new cards.
UPDATE public.profiles
SET onboarding_state = jsonb_build_object(
  'version', 1,
  'status', 'skipped_all',
  'grandfathered', true,
  'seen', '{}'::jsonb,
  'completed', '{}'::jsonb,
  'skipped', '{}'::jsonb,
  'failed', '{}'::jsonb,
  'updatedAt', to_jsonb(now())
)
WHERE onboarded_at IS NOT NULL AND onboarding_state = '{}'::jsonb;

-- All 13 designed event ids are accepted (Phase-9 events included, so
-- enabling them later needs no migration); unknown ids are rejected to
-- keep the blob bounded.
CREATE OR REPLACE FUNCTION public.onboarding_valid_event(_event_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _event_id = ANY (ARRAY[
    'TODAY_INTRO','CHECKIN_INTRO','XP_INTRO','STREAK_INTRO',
    'STREAK_SHIELD_INTRO','PROGRESSION_INTRO','AI_COACH_INTRO',
    'COACH_MISSION_INTRO','SQUAD_INTRO','RANKS_INTRO',
    'BADGES_INTRO','BATTLES_INTRO','VAULT_INTRO'
  ]);
$$;

-- Each write is ONE atomic UPDATE: the || merge touches only the key
-- being set, so concurrent devices can't clobber each other, and the
-- WHERE guard makes every call idempotent (an event already
-- completed/skipped is never touched again).
-- NOTE: the `?` tests are wrapped in COALESCE — `NULL ? x` is NULL and
-- a bare NOT(NULL) would silently skip the UPDATE for fresh '{}' rows.

CREATE OR REPLACE FUNCTION public.onboarding_mark_seen(_event_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET onboarding_state = onboarding_state
    || jsonb_build_object('seen',
         COALESCE(onboarding_state->'seen', '{}'::jsonb)
         || jsonb_build_object(_event_id, to_jsonb(now())))
    || jsonb_build_object('status', 'in_progress', 'updatedAt', to_jsonb(now()))
  WHERE user_id = auth.uid()
    AND public.onboarding_valid_event(_event_id)
    AND NOT COALESCE(onboarding_state->'completed' ? _event_id, false)
    AND NOT COALESCE(onboarding_state->'skipped' ? _event_id, false)
    AND COALESCE(onboarding_state->>'grandfathered', 'false') <> 'true';
$$;

CREATE OR REPLACE FUNCTION public.onboarding_mark_completed(_event_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET onboarding_state = onboarding_state
    || jsonb_build_object('completed',
         COALESCE(onboarding_state->'completed', '{}'::jsonb)
         || jsonb_build_object(_event_id, to_jsonb(now())))
    || jsonb_build_object('status', 'in_progress', 'updatedAt', to_jsonb(now()))
  WHERE user_id = auth.uid()
    AND public.onboarding_valid_event(_event_id)
    AND NOT COALESCE(onboarding_state->'completed' ? _event_id, false)
    AND COALESCE(onboarding_state->>'grandfathered', 'false') <> 'true';
$$;

CREATE OR REPLACE FUNCTION public.onboarding_mark_skipped(_event_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET onboarding_state = onboarding_state
    || jsonb_build_object('skipped',
         COALESCE(onboarding_state->'skipped', '{}'::jsonb)
         || jsonb_build_object(_event_id, to_jsonb(now())))
    || jsonb_build_object('status', 'in_progress', 'updatedAt', to_jsonb(now()))
  WHERE user_id = auth.uid()
    AND public.onboarding_valid_event(_event_id)
    AND NOT COALESCE(onboarding_state->'completed' ? _event_id, false)
    AND NOT COALESCE(onboarding_state->'skipped' ? _event_id, false)
    AND COALESCE(onboarding_state->>'grandfathered', 'false') <> 'true';
$$;

CREATE OR REPLACE FUNCTION public.onboarding_mark_failed(_event_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET onboarding_state = onboarding_state
    || jsonb_build_object('failed',
         COALESCE(onboarding_state->'failed', '{}'::jsonb)
         || jsonb_build_object(_event_id, jsonb_build_object(
              'at', to_jsonb(now()),
              'count', COALESCE((onboarding_state->'failed'->_event_id->>'count')::int, 0) + 1)))
    || jsonb_build_object('updatedAt', to_jsonb(now()))
  WHERE user_id = auth.uid()
    AND public.onboarding_valid_event(_event_id)
    AND NOT COALESCE(onboarding_state->'completed' ? _event_id, false)
    AND NOT COALESCE(onboarding_state->'skipped' ? _event_id, false)
    AND COALESCE(onboarding_state->>'grandfathered', 'false') <> 'true';
$$;

REVOKE ALL ON FUNCTION public.onboarding_mark_seen(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.onboarding_mark_completed(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.onboarding_mark_skipped(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.onboarding_mark_failed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboarding_mark_seen(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_mark_completed(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_mark_skipped(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_mark_failed(text) TO authenticated;
