
CREATE OR REPLACE FUNCTION public.check_influencer_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  post_owner_id uuid;
  total_likes integer;
  badge_id_val uuid;
BEGIN
  -- Get post owner
  SELECT user_id INTO post_owner_id FROM feed_posts WHERE id = NEW.post_id;
  IF post_owner_id IS NULL THEN RETURN NEW; END IF;

  -- Sum all likes across user's posts
  SELECT COALESCE(SUM(likes_count), 0) INTO total_likes
  FROM feed_posts WHERE user_id = post_owner_id;

  -- Check if threshold met (50 likes)
  IF total_likes >= 50 THEN
    -- Get the Influencer badge id
    SELECT id INTO badge_id_val FROM badges WHERE requirement_type = 'total_likes' LIMIT 1;
    IF badge_id_val IS NOT NULL THEN
      -- Award if not already earned
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (post_owner_id, badge_id_val)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger after reaction insert
CREATE TRIGGER trg_check_influencer_badge
AFTER INSERT ON public.feed_reactions
FOR EACH ROW
EXECUTE FUNCTION public.check_influencer_badge();
