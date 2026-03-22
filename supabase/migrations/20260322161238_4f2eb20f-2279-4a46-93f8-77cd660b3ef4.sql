
CREATE OR REPLACE FUNCTION public.handle_feed_reaction_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get the post owner
    SELECT user_id INTO post_owner_id FROM feed_posts WHERE id = NEW.post_id;
    IF post_owner_id IS NOT NULL AND post_owner_id != NEW.user_id THEN
      -- Award 5 XP to the post owner
      UPDATE profiles SET xp = xp + 5 WHERE user_id = post_owner_id;
      -- Update likes_count
      UPDATE feed_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT user_id INTO post_owner_id FROM feed_posts WHERE id = OLD.post_id;
    IF post_owner_id IS NOT NULL AND post_owner_id != OLD.user_id THEN
      UPDATE profiles SET xp = GREATEST(xp - 5, 0) WHERE user_id = post_owner_id;
      UPDATE feed_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_feed_reaction_change
  AFTER INSERT OR DELETE ON public.feed_reactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_feed_reaction_xp();
