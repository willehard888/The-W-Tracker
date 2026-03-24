
-- Kudos table: tracks who gave kudos to which post
CREATE TABLE public.kudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX kudos_giver_post_unique ON public.kudos (giver_id, post_id);

ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kudos viewable by everyone" ON public.kudos FOR SELECT TO public USING (true);
CREATE POLICY "Users can give kudos" ON public.kudos FOR INSERT TO public WITH CHECK (auth.uid() = giver_id);
CREATE POLICY "Users can remove own kudos" ON public.kudos FOR DELETE TO public USING (auth.uid() = giver_id);

-- Add kudos_count to feed_posts
ALTER TABLE public.feed_posts ADD COLUMN kudos_count integer NOT NULL DEFAULT 0;

-- Badge: Kudos Master (Legendary) - received 10 kudos total
INSERT INTO public.badges (name, description, icon, rarity, category, requirement_type, requirement_value)
VALUES ('Kudos Master', 'Received 10 kudos for creating inspiring and educational content', '🏆', 'legendary', 'social', 'total_kudos', 10);

-- Function to handle kudos insert: update count + check badge
CREATE OR REPLACE FUNCTION public.handle_kudos_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_kudos integer;
  badge_id_val uuid;
BEGIN
  UPDATE feed_posts SET kudos_count = kudos_count + 1 WHERE id = NEW.post_id;
  UPDATE profiles SET xp = xp + 10 WHERE user_id = NEW.receiver_id;

  SELECT count(*) INTO total_kudos FROM kudos WHERE receiver_id = NEW.receiver_id;
  IF total_kudos >= 10 THEN
    SELECT id INTO badge_id_val FROM badges WHERE requirement_type = 'total_kudos' LIMIT 1;
    IF badge_id_val IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (NEW.receiver_id, badge_id_val)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_kudos_insert
AFTER INSERT ON public.kudos
FOR EACH ROW EXECUTE FUNCTION public.handle_kudos_insert();

CREATE OR REPLACE FUNCTION public.handle_kudos_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE feed_posts SET kudos_count = GREATEST(kudos_count - 1, 0) WHERE id = OLD.post_id;
  UPDATE profiles SET xp = GREATEST(xp - 10, 0) WHERE user_id = OLD.receiver_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_handle_kudos_delete
AFTER DELETE ON public.kudos
FOR EACH ROW EXECUTE FUNCTION public.handle_kudos_delete();

ALTER PUBLICATION supabase_realtime ADD TABLE public.kudos;
