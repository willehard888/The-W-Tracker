
-- ============= APEX SUBSCRIBER COLUMNS =============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_apex_subscriber boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS apex_subscription_started_at timestamptz;

-- ============= UPDATE update_status_tier TO PROTECT APEX SUBSCRIBERS =============
CREATE OR REPLACE FUNCTION public.update_status_tier(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_users integer;
  user_rank integer;
  percentile numeric;
  new_tier status_tier;
  activity_days integer;
  user_streak integer;
  is_apex_sub boolean;
BEGIN
  PERFORM calculate_rank_score(target_user_id);

  SELECT count(*) INTO total_users FROM profiles WHERE rank_score > 0;
  SELECT count(*) INTO user_rank FROM profiles
  WHERE rank_score > (SELECT rank_score FROM profiles WHERE user_id = target_user_id);

  IF total_users <= 1 THEN percentile := 100;
  ELSE percentile := ((total_users - user_rank)::numeric / total_users::numeric) * 100;
  END IF;

  SELECT count(DISTINCT date(checked_in_at)) INTO activity_days
  FROM daily_checkins
  WHERE user_id = target_user_id AND checked_in_at >= now() - interval '30 days';

  SELECT COALESCE(streak, 0), COALESCE(is_apex_subscriber, false)
    INTO user_streak, is_apex_sub
  FROM profiles WHERE user_id = target_user_id;

  IF percentile >= 99.9 AND activity_days >= 30 AND user_streak >= 30 THEN new_tier := 'legend';
  ELSIF percentile >= 99 AND activity_days >= 30 AND user_streak >= 30 THEN new_tier := 'apex';
  ELSIF percentile >= 95 AND activity_days >= 14 AND user_streak >= 30 THEN new_tier := 'elite';
  ELSIF percentile >= 90 AND activity_days >= 14 AND user_streak >= 14 THEN new_tier := 'high_performer';
  ELSIF percentile >= 75 AND activity_days >= 7 THEN new_tier := 'performer';
  ELSIF percentile >= 50 AND activity_days >= 7 THEN new_tier := 'operator';
  ELSE new_tier := 'recruit';
  END IF;

  -- Apex Instant subscribers cannot drop below Apex
  IF is_apex_sub AND new_tier NOT IN ('apex', 'legend') THEN
    new_tier := 'apex';
  END IF;

  UPDATE profiles SET status_tier = new_tier WHERE user_id = target_user_id;
END;
$function$;

-- ============= TRIBES TABLES =============
CREATE TABLE IF NOT EXISTS public.tribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  cover_url text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  member_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tribe_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tribe_id uuid NOT NULL REFERENCES public.tribes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','banned')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tribe_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tribe_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tribe_id uuid NOT NULL REFERENCES public.tribes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text,
  image_url text,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tribe_post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.tribe_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tribe_members_user ON public.tribe_members(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_tribe_posts_tribe ON public.tribe_posts(tribe_id, created_at DESC);

-- ============= ENABLE RLS =============
ALTER TABLE public.tribes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tribe_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tribe_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tribe_post_reactions ENABLE ROW LEVEL SECURITY;

-- ============= HELPERS =============
CREATE OR REPLACE FUNCTION public.is_tribe_member(_tribe_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tribe_members
    WHERE tribe_id = _tribe_id AND user_id = _user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tribe_owner(_tribe_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tribes
    WHERE id = _tribe_id AND owner_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_create_tribe(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND (
        is_apex_subscriber = true
        OR status_tier IN ('apex','legend')
      )
  );
$$;

-- ============= RLS POLICIES =============

-- tribes
CREATE POLICY "Public tribes viewable by all authed"
ON public.tribes FOR SELECT TO authenticated
USING (visibility = 'public' OR is_tribe_member(id, auth.uid()) OR owner_id = auth.uid());

-- tribe_members
CREATE POLICY "Members rows visible to authed"
ON public.tribe_members FOR SELECT TO authenticated
USING (
  -- Members of the tribe can see all members
  is_tribe_member(tribe_id, auth.uid())
  -- Anyone can see members of public tribes
  OR EXISTS (SELECT 1 FROM public.tribes t WHERE t.id = tribe_id AND t.visibility = 'public')
  -- You can see your own membership row (e.g. pending)
  OR user_id = auth.uid()
);

-- tribe_posts
CREATE POLICY "Tribe posts viewable by members or public"
ON public.tribe_posts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tribes t
    WHERE t.id = tribe_id
      AND (t.visibility = 'public' OR is_tribe_member(t.id, auth.uid()))
  )
);

CREATE POLICY "Members can post in their tribe"
ON public.tribe_posts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND is_tribe_member(tribe_id, auth.uid()));

CREATE POLICY "Users can delete own tribe post"
ON public.tribe_posts FOR DELETE TO authenticated
USING (auth.uid() = user_id OR is_tribe_owner(tribe_id, auth.uid()));

CREATE POLICY "Users can update own tribe post"
ON public.tribe_posts FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- tribe_post_reactions
CREATE POLICY "Reactions viewable by tribe-visible viewers"
ON public.tribe_post_reactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tribe_posts p
    JOIN public.tribes t ON t.id = p.tribe_id
    WHERE p.id = post_id
      AND (t.visibility = 'public' OR is_tribe_member(t.id, auth.uid()))
  )
);

CREATE POLICY "Members can react"
ON public.tribe_post_reactions FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.tribe_posts p
    WHERE p.id = post_id AND is_tribe_member(p.tribe_id, auth.uid())
  )
);

CREATE POLICY "Users can remove own reaction"
ON public.tribe_post_reactions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ============= TRIBE RPCs =============

CREATE OR REPLACE FUNCTION public.create_tribe(
  p_name text,
  p_description text DEFAULT NULL,
  p_visibility text DEFAULT 'public',
  p_cover_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count int;
  v_slug text;
  v_id uuid;
  v_clean_name text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT can_create_tribe(v_user) THEN
    RAISE EXCEPTION 'Only Apex tier or Apex subscribers can create tribes';
  END IF;

  v_clean_name := trim(p_name);
  IF v_clean_name IS NULL OR length(v_clean_name) < 3 OR length(v_clean_name) > 40 THEN
    RAISE EXCEPTION 'Tribe name must be 3-40 chars';
  END IF;

  IF p_visibility NOT IN ('public','private') THEN
    RAISE EXCEPTION 'Invalid visibility';
  END IF;

  SELECT count(*) INTO v_count FROM tribes WHERE owner_id = v_user;
  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Max 3 tribes per user';
  END IF;

  v_slug := lower(regexp_replace(v_clean_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO tribes (owner_id, name, slug, description, visibility, cover_url, member_count)
  VALUES (v_user, v_clean_name, v_slug, p_description, p_visibility, p_cover_url, 1)
  RETURNING id INTO v_id;

  INSERT INTO tribe_members (tribe_id, user_id, role, status)
  VALUES (v_id, v_user, 'owner', 'active');

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_tribe(p_tribe_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_visibility text;
  v_status text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT visibility INTO v_visibility FROM tribes WHERE id = p_tribe_id;
  IF v_visibility IS NULL THEN RAISE EXCEPTION 'Tribe not found'; END IF;

  IF EXISTS (SELECT 1 FROM tribe_members WHERE tribe_id = p_tribe_id AND user_id = v_user) THEN
    RETURN 'already_member';
  END IF;

  v_status := CASE WHEN v_visibility = 'public' THEN 'active' ELSE 'pending' END;

  INSERT INTO tribe_members (tribe_id, user_id, role, status)
  VALUES (p_tribe_id, v_user, 'member', v_status);

  IF v_status = 'active' THEN
    UPDATE tribes SET member_count = member_count + 1 WHERE id = p_tribe_id;
  END IF;

  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_tribe(p_tribe_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_status text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT role, status INTO v_role, v_status FROM tribe_members
  WHERE tribe_id = p_tribe_id AND user_id = v_user;

  IF v_role IS NULL THEN RETURN; END IF;
  IF v_role = 'owner' THEN
    RAISE EXCEPTION 'Owner cannot leave — delete the tribe instead';
  END IF;

  DELETE FROM tribe_members WHERE tribe_id = p_tribe_id AND user_id = v_user;
  IF v_status = 'active' THEN
    UPDATE tribes SET member_count = GREATEST(member_count - 1, 0) WHERE id = p_tribe_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_tribe_member(p_tribe_id uuid, p_user_id uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_tribe_owner(p_tribe_id, v_user) THEN
    RAISE EXCEPTION 'Only the owner can approve members';
  END IF;

  IF p_accept THEN
    UPDATE tribe_members SET status = 'active'
    WHERE tribe_id = p_tribe_id AND user_id = p_user_id AND status = 'pending';
    UPDATE tribes SET member_count = member_count + 1
    WHERE id = p_tribe_id AND EXISTS (
      SELECT 1 FROM tribe_members
      WHERE tribe_id = p_tribe_id AND user_id = p_user_id AND status = 'active'
    );
  ELSE
    DELETE FROM tribe_members WHERE tribe_id = p_tribe_id AND user_id = p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_tribe(p_tribe_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_tribe_owner(p_tribe_id, v_user) THEN
    RAISE EXCEPTION 'Only the owner can delete a tribe';
  END IF;
  DELETE FROM tribes WHERE id = p_tribe_id;
END;
$$;

-- Trigger to maintain likes_count on tribe_posts
CREATE OR REPLACE FUNCTION public.handle_tribe_post_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tribe_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tribe_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tribe_post_reaction_ins ON public.tribe_post_reactions;
DROP TRIGGER IF EXISTS trg_tribe_post_reaction_del ON public.tribe_post_reactions;

CREATE TRIGGER trg_tribe_post_reaction_ins
AFTER INSERT ON public.tribe_post_reactions
FOR EACH ROW EXECUTE FUNCTION public.handle_tribe_post_reaction();

CREATE TRIGGER trg_tribe_post_reaction_del
AFTER DELETE ON public.tribe_post_reactions
FOR EACH ROW EXECUTE FUNCTION public.handle_tribe_post_reaction();

-- updated_at trigger on tribes
DROP TRIGGER IF EXISTS trg_tribes_updated ON public.tribes;
CREATE TRIGGER trg_tribes_updated
BEFORE UPDATE ON public.tribes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
