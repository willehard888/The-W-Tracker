-- ============================================================
-- Username ownership — every user picks their own handle.
--
-- Founder invariants:
--   1. A username is NEVER auto-derived from the email (or anything
--      else). Users without a chosen name get a neutral placeholder
--      (athlete_<uuid6>) and are gated into the picker.
--   2. A chosen username NEVER changes automatically — and is locked
--      once chosen (the signup form has promised "Locked permanently
--      once set" all along; now the database enforces it).
--
-- Pieces:
--   profiles.username_is_auto  — placeholder vs chosen (drives the gate)
--   handle_new_user v3         — neutral placeholder, never email
--   case normalization + lower(username) unique index (Mogger/mogger
--                                impersonation hole closed)
--   tg_username_guard          — validate/normalize/lock on EVERY write
--                                path (the profiles UPDATE RLS policy
--                                does not restrict columns, so the RPC
--                                was never the only door)
--   update_own_profile v2      — clears the auto flag when a name is
--                                explicitly chosen
-- ============================================================

-- ── 1. Flag: placeholder vs chosen ───────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username_is_auto boolean NOT NULL DEFAULT false;

-- ── 2. Backfill: old auto-generated shapes get the picker ────
-- The historical generator produced <base13>_<uuid6>. Matching the
-- user's own uuid prefix makes false positives practically impossible.
UPDATE public.profiles
SET username_is_auto = true
WHERE username LIKE ('%\_' || substring(user_id::text, 1, 6)) ESCAPE '\';

-- ── 3. Case normalization + case-insensitive uniqueness ──────
-- Client always lowercases, but the DB never guaranteed it. Normalize
-- any stragglers (suffixing on collision), then lock it in with a
-- functional unique index.
DO $$
DECLARE r RECORD; v_name text; n int;
BEGIN
  FOR r IN SELECT user_id, username FROM public.profiles WHERE username <> lower(username) LOOP
    v_name := lower(r.username);
    n := 1;
    WHILE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE lower(username) = v_name AND user_id <> r.user_id
    ) LOOP
      n := n + 1;
      v_name := left(lower(r.username), 20 - length(n::text)) || n::text;
    END LOOP;
    -- A forced rename is not the user's choice — send them to the picker.
    UPDATE public.profiles
    SET username = v_name, username_is_auto = true
    WHERE user_id = r.user_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx
  ON public.profiles (lower(username));

-- ── 4. handle_new_user v3 — never derive from email ──────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta_username text;
  base_username text;
  candidate text;
  n int := 0;
  v_auto boolean := false;
BEGIN
  meta_username := nullif(trim(coalesce(NEW.raw_user_meta_data->>'username', '')), '');

  IF meta_username IS NULL THEN
    -- No chosen name (Apple / OAuth / programmatic signup): neutral
    -- placeholder from the user id — NEVER the email — and the picker gate.
    base_username := 'athlete_' || substring(NEW.id::text, 1, 6);
    v_auto := true;
  ELSE
    base_username := lower(meta_username);
    base_username := regexp_replace(base_username, '[^a-z0-9_]+', '_', 'g');
    base_username := trim(both '_' from base_username);
    IF base_username IS NULL OR base_username = '' THEN
      base_username := 'athlete_' || substring(NEW.id::text, 1, 6);
      v_auto := true;
    END IF;
  END IF;

  LOOP
    IF n = 0 THEN
      candidate := left(base_username, 20);
    ELSE
      candidate := left(base_username, 20 - length((n + 1)::text)) || (n + 1)::text;
    END IF;

    BEGIN
      -- A collision suffix (name -> name2) is not the user's choice either:
      -- flag it so the picker lets them confirm or change it.
      INSERT INTO public.profiles (user_id, username, username_is_auto, referral_code, trial_started_at)
      VALUES (
        NEW.id,
        candidate,
        v_auto OR n > 0,
        left(candidate || '_' || substring(NEW.id::text, 1, 6), 20),
        now()
      );
      RETURN NEW;
    EXCEPTION
      WHEN unique_violation THEN
        IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
          RETURN NEW;
        END IF;
        n := n + 1;
        IF n > 9999 THEN
          INSERT INTO public.profiles (user_id, username, username_is_auto, referral_code, trial_started_at)
          VALUES (
            NEW.id,
            'athlete_' || substring(NEW.id::text, 1, 6),
            true,
            left('athlete_' || substring(NEW.id::text, 1, 6), 20),
            now()
          )
          ON CONFLICT (user_id) DO NOTHING;
          RETURN NEW;
        END IF;
    END;
  END LOOP;
END;
$function$;

-- ── 5. Guard trigger — one gate over every write path ────────
CREATE OR REPLACE FUNCTION public.tg_username_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The auto flag can never be re-armed: that would re-open the picker
  -- and let a locked user rename through it.
  IF NEW.username_is_auto AND NOT OLD.username_is_auto THEN
    RAISE EXCEPTION 'Invalid username state change';
  END IF;

  IF NEW.username IS DISTINCT FROM OLD.username THEN
    IF NOT OLD.username_is_auto THEN
      RAISE EXCEPTION 'Username is locked';
    END IF;
    NEW.username := lower(trim(NEW.username));
    IF NEW.username !~ '^[a-z0-9_]{3,20}$' THEN
      RAISE EXCEPTION 'Username must be 3-20 characters: a-z, 0-9 and _';
    END IF;
    NEW.username_is_auto := false;
    -- First real choice: rebuild the referral code from the chosen name.
    -- Safe: an auto-named user has not shared the placeholder code, and
    -- existing referred_by links are user_id-based.
    NEW.referral_code := left(NEW.username || '_' || substring(NEW.user_id::text, 1, 6), 20);
  ELSIF OLD.username_is_auto AND NOT NEW.username_is_auto THEN
    -- Claiming the current placeholder as the chosen name (picker submit
    -- with the same string) — allowed; refresh the referral code too.
    NEW.referral_code := left(NEW.username || '_' || substring(NEW.user_id::text, 1, 6), 20);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_username_guard ON public.profiles;
CREATE TRIGGER profiles_username_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_username_guard();

-- ── 6. update_own_profile v2 — choosing a name clears the flag ──
CREATE OR REPLACE FUNCTION public.update_own_profile(
  new_username text DEFAULT NULL,
  new_display_name text DEFAULT NULL,
  new_avatar_url text DEFAULT NULL,
  new_featured_badge_id uuid DEFAULT NULL,
  clear_featured_badge boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET
    username = COALESCE(new_username, username),
    -- Passing a username IS the act of choosing — clear the auto flag so
    -- the guard trigger treats an identical string as a claim, not a no-op.
    username_is_auto = CASE WHEN new_username IS NOT NULL THEN false ELSE username_is_auto END,
    display_name = COALESCE(new_display_name, display_name),
    avatar_url = COALESCE(new_avatar_url, avatar_url),
    featured_badge_id = CASE
      WHEN clear_featured_badge THEN NULL
      WHEN new_featured_badge_id IS NOT NULL THEN new_featured_badge_id
      ELSE featured_badge_id
    END,
    updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;
