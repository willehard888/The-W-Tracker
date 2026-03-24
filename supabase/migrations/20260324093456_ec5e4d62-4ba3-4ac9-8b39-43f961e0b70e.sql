
-- Commentator badge: awarded after 50 comments
CREATE OR REPLACE FUNCTION public.check_commentator_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  comment_count integer;
  badge_id_val uuid;
BEGIN
  SELECT count(*) INTO comment_count FROM feed_comments WHERE user_id = NEW.user_id;

  IF comment_count >= 50 THEN
    SELECT id INTO badge_id_val FROM badges WHERE requirement_type = 'total_comments' LIMIT 1;
    IF badge_id_val IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (NEW.user_id, badge_id_val)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_commentator_badge
AFTER INSERT ON public.feed_comments
FOR EACH ROW
EXECUTE FUNCTION public.check_commentator_badge();

-- Viral badge: awarded when a single post hits 20 likes
CREATE OR REPLACE FUNCTION public.check_viral_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  post_owner_id uuid;
  post_likes integer;
  badge_id_val uuid;
BEGIN
  SELECT user_id, likes_count INTO post_owner_id, post_likes
  FROM feed_posts WHERE id = NEW.post_id;

  IF post_owner_id IS NOT NULL AND post_likes >= 20 THEN
    SELECT id INTO badge_id_val FROM badges WHERE requirement_type = 'single_post_likes' LIMIT 1;
    IF badge_id_val IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (post_owner_id, badge_id_val)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_viral_badge
AFTER INSERT ON public.feed_reactions
FOR EACH ROW
EXECUTE FUNCTION public.check_viral_badge();
