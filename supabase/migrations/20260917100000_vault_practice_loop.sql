-- The Vault practice loop: discover → understand → reflect → practice → integrate.
--
-- Reading was the whole loop before this: a piece was "complete" when the reader
-- tapped Mark complete. Now a piece can carry a reflection question, a timed
-- practice and an integration question; the reader's answers are private rows
-- (vault_reflections), the practice is recorded server-side with a small,
-- capped XP award, and Vault badges are validated from the same rows.

-- ── 1. Content columns ────────────────────────────────────────────────────
ALTER TABLE public.vault_articles
  ADD COLUMN IF NOT EXISTS master_slug text,
  ADD COLUMN IF NOT EXISTS reflect_prompt text,
  ADD COLUMN IF NOT EXISTS integrate_prompt text,
  ADD COLUMN IF NOT EXISTS practice_minutes int;

CREATE INDEX IF NOT EXISTS vault_articles_master_idx
  ON public.vault_articles(master_slug) WHERE master_slug IS NOT NULL;

-- ── 2. Progress: the loop's stages on the existing row ────────────────────
ALTER TABLE public.vault_lesson_progress
  ADD COLUMN IF NOT EXISTS practiced_at timestamptz,
  ADD COLUMN IF NOT EXISTS integrated_at timestamptz;

-- Trialists could read every lesson (has_active_access) but their Mark
-- complete was rejected by the has_premium write policy. Same gate for both.
DROP POLICY IF EXISTS "Premium users mark own lessons complete" ON public.vault_lesson_progress;
CREATE POLICY "Members mark own lessons complete"
  ON public.vault_lesson_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_active_access(auth.uid()));

DROP POLICY IF EXISTS "Premium users update own lesson progress" ON public.vault_lesson_progress;
CREATE POLICY "Members update own lesson progress"
  ON public.vault_lesson_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND public.has_active_access(auth.uid()))
  WITH CHECK (auth.uid() = user_id);

-- ── 3. Reflections: private by design ─────────────────────────────────────
-- Own rows only. No RPC, no view and no trigger ever reads these for anyone
-- else; the feed, boards and profiles never see them.
CREATE TABLE IF NOT EXISTS public.vault_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  article_id uuid NOT NULL REFERENCES public.vault_articles(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('reflect', 'integrate')),
  answer text NOT NULL CHECK (length(answer) BETWEEN 1 AND 1200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_id, stage)
);

ALTER TABLE public.vault_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own reflections"
  ON public.vault_reflections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Members write own reflections"
  ON public.vault_reflections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_active_access(auth.uid()));

CREATE POLICY "Members update own reflections"
  ON public.vault_reflections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.has_active_access(auth.uid()))
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own reflections"
  ON public.vault_reflections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS vault_reflections_user_idx
  ON public.vault_reflections(user_id, article_id);

-- ── 4. The practice, recorded server-side ─────────────────────────────────
-- One practice per piece, ever. XP for the first practice of each local day
-- only (15, the same order as one optional check-in habit), so the Vault can
-- add to the ladder without becoming a way to farm it. Level uses the same
-- rule as record_checkin. SECURITY DEFINER runs as the owner, which is what
-- protect_profile_columns lets through.
CREATE OR REPLACE FUNCTION public.record_vault_practice(
  p_article_id uuid,
  p_tz_offset_minutes integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_offset integer := GREATEST(-840, LEAST(840, COALESCE(p_tz_offset_minutes, 0)));
  v_local_today date := (now() - make_interval(mins => v_offset))::date;
  v_prev timestamptz;
  v_today_count integer;
  v_xp_award integer := 0;
  v_new_xp integer;
  v_new_level integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_active_access(v_uid) THEN
    RAISE EXCEPTION 'MEMBERSHIP_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault_articles WHERE id = p_article_id) THEN
    RAISE EXCEPTION 'UNKNOWN_ARTICLE';
  END IF;

  -- Serialise per user: two taps must not both award.
  PERFORM 1 FROM profiles WHERE user_id = v_uid FOR UPDATE;

  SELECT practiced_at INTO v_prev
    FROM vault_lesson_progress
   WHERE user_id = v_uid AND article_id = p_article_id;

  IF v_prev IS NOT NULL THEN
    SELECT xp, level INTO v_new_xp, v_new_level FROM profiles WHERE user_id = v_uid;
    RETURN json_build_object('practiced', true, 'already', true, 'xp_awarded', 0,
                             'xp', v_new_xp, 'level', v_new_level);
  END IF;

  SELECT count(*) INTO v_today_count
    FROM vault_lesson_progress
   WHERE user_id = v_uid
     AND practiced_at IS NOT NULL
     AND (practiced_at - make_interval(mins => v_offset))::date = v_local_today;

  INSERT INTO vault_lesson_progress (user_id, article_id, practiced_at)
  VALUES (v_uid, p_article_id, now())
  ON CONFLICT (user_id, article_id)
  DO UPDATE SET practiced_at = now();

  IF v_today_count = 0 THEN
    v_xp_award := 15;
    UPDATE profiles
       SET xp = COALESCE(xp, 0) + v_xp_award,
           level = floor((COALESCE(xp, 0) + v_xp_award) / 500) + 1
     WHERE user_id = v_uid
     RETURNING xp, level INTO v_new_xp, v_new_level;
  ELSE
    SELECT xp, level INTO v_new_xp, v_new_level FROM profiles WHERE user_id = v_uid;
  END IF;

  RETURN json_build_object('practiced', true, 'already', false, 'xp_awarded', v_xp_award,
                           'xp', v_new_xp, 'level', v_new_level);
END;
$$;

REVOKE ALL ON FUNCTION public.record_vault_practice(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.record_vault_practice(uuid, integer) TO authenticated;

-- ── 5. Vault badges ───────────────────────────────────────────────────────
-- Product achievements for practice loops run, validated from the progress
-- rows. requirement_type 'vault_practices' counts every practised piece;
-- 'vault_master:<slug,slug>' counts practised pieces by those masters.
INSERT INTO public.badges (name, description, icon, rarity, category, requirement_type, requirement_value)
VALUES
  ('Integrator', 'Ran a full Vault loop: idea, reflection, practice, integration.', '🪞', 'common', 'vault', 'vault_practices', 1),
  ('Wayfinder', 'Ten Vault practices run and integrated.', '🧭', 'rare', 'vault', 'vault_practices', 10),
  ('Shadow Explorer', 'Worked Jung''s lens twice: the shadow and what it projects.', '🌑', 'rare', 'vault', 'vault_master:jung', 2),
  ('Stoic Path', 'Three Stoic practices run: Epictetus, Marcus Aurelius and Seneca.', '🏛️', 'rare', 'vault', 'vault_master:epictetus,marcus-aurelius,seneca', 3),
  ('Meaning Seeker', 'Practised Frankl and Campbell: meaning, and the call to change.', '🔦', 'rare', 'vault', 'vault_master:frankl,campbell', 2),
  ('Discipline Builder', 'Practised Clear, Aristotle and Goggins: systems, habituation, discomfort.', '⚒️', 'rare', 'vault', 'vault_master:clear,aristotle,goggins', 3),
  ('Mastery Builder', 'Twenty-five Vault practices run. The library is a workshop now.', '🗝️', 'epic', 'vault', 'vault_practices', 25)
ON CONFLICT (name) DO NOTHING;

-- Awards every Vault badge the caller has earned and returns the new ones.
-- Self-guarded like award_badge_if_earned; the owner role bypasses the
-- "No direct badge insertion" policy exactly as that function does.
CREATE OR REPLACE FUNCTION public.award_vault_badges()
RETURNS SETOF public.badges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  b public.badges%ROWTYPE;
  v_stat integer;
  v_masters text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  FOR b IN
    SELECT * FROM badges
     WHERE requirement_type LIKE 'vault%'
       AND requirement_value IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM user_badges ub WHERE ub.user_id = v_uid AND ub.badge_id = badges.id)
     ORDER BY requirement_value
  LOOP
    IF b.requirement_type = 'vault_practices' THEN
      SELECT count(*) INTO v_stat
        FROM vault_lesson_progress
       WHERE user_id = v_uid AND practiced_at IS NOT NULL;
    ELSIF b.requirement_type LIKE 'vault_master:%' THEN
      v_masters := string_to_array(substr(b.requirement_type, length('vault_master:') + 1), ',');
      SELECT count(*) INTO v_stat
        FROM vault_lesson_progress p
        JOIN vault_articles a ON a.id = p.article_id
       WHERE p.user_id = v_uid
         AND p.practiced_at IS NOT NULL
         AND a.master_slug = ANY (v_masters);
    ELSE
      CONTINUE;
    END IF;

    IF v_stat >= b.requirement_value THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_uid, b.id)
      ON CONFLICT DO NOTHING;
      RETURN NEXT b;
    END IF;
  END LOOP;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.award_vault_badges() FROM public;
GRANT EXECUTE ON FUNCTION public.award_vault_badges() TO authenticated;
