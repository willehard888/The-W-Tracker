-- Create badge rarity enum
CREATE TYPE public.badge_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');

-- Create battle status enum
CREATE TYPE public.battle_status AS ENUM ('pending', 'active', 'completed', 'declined');

-- Create status tier enum
CREATE TYPE public.status_tier AS ENUM ('normal', 'rising', 'high_performer', 'elite');

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  status_tier status_tier NOT NULL DEFAULT 'normal',
  is_elite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Daily check-ins table
CREATE TABLE public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sleep_hours NUMERIC(3,1) NOT NULL DEFAULT 0,
  workout BOOLEAN NOT NULL DEFAULT false,
  extra_workout BOOLEAN NOT NULL DEFAULT false,
  cold_shower BOOLEAN NOT NULL DEFAULT false,
  healthy_food BOOLEAN NOT NULL DEFAULT false,
  protein_intake BOOLEAN NOT NULL DEFAULT false,
  meditation_morning BOOLEAN NOT NULL DEFAULT false,
  meditation_evening BOOLEAN NOT NULL DEFAULT false,
  hydration_liters NUMERIC(3,1) NOT NULL DEFAULT 0,
  no_phone_morning BOOLEAN NOT NULL DEFAULT false,
  no_phone_evening BOOLEAN NOT NULL DEFAULT false,
  proof_photo_url TEXT,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkins" ON public.daily_checkins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checkins" ON public.daily_checkins FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_checkins_user_date ON public.daily_checkins (user_id, checked_in_at DESC);

-- Badges table
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT NOT NULL,
  rarity badge_rarity NOT NULL DEFAULT 'common',
  category TEXT NOT NULL DEFAULT 'general',
  requirement_type TEXT,
  requirement_value INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges viewable by everyone" ON public.badges FOR SELECT USING (true);

-- User badges junction table
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Battles table
CREATE TABLE public.battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status battle_status NOT NULL DEFAULT 'pending',
  winner_id UUID REFERENCES auth.users(id),
  battle_type TEXT NOT NULL DEFAULT 'xp',
  duration_days INTEGER NOT NULL DEFAULT 7,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own battles" ON public.battles FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);
CREATE POLICY "Users can create battles" ON public.battles FOR INSERT WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "Users can update own battles" ON public.battles FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- Feed posts table
CREATE TABLE public.feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  reported BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Feed viewable by everyone" ON public.feed_posts FOR SELECT USING (true);
CREATE POLICY "Elite users can post" ON public.feed_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.feed_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.feed_posts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_feed_posts_updated_at BEFORE UPDATE ON public.feed_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Feed comments
CREATE TABLE public.feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by everyone" ON public.feed_comments FOR SELECT USING (true);
CREATE POLICY "Users can comment" ON public.feed_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.feed_comments FOR DELETE USING (auth.uid() = user_id);

-- Feed reactions
CREATE TABLE public.feed_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'fire',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions viewable by everyone" ON public.feed_reactions FOR SELECT USING (true);
CREATE POLICY "Users can react" ON public.feed_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own reactions" ON public.feed_reactions FOR DELETE USING (auth.uid() = user_id);

-- Reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Storage buckets for images
INSERT INTO storage.buckets (id, name, public) VALUES ('feed-images', 'feed-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('proof-photos', 'proof-photos', true);

CREATE POLICY "Anyone can view feed images" ON storage.objects FOR SELECT USING (bucket_id = 'feed-images');
CREATE POLICY "Authenticated users can upload feed images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'feed-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view proof photos" ON storage.objects FOR SELECT USING (bucket_id = 'proof-photos');
CREATE POLICY "Authenticated users can upload proof photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'proof-photos' AND auth.uid() IS NOT NULL);

-- Seed badges
INSERT INTO public.badges (name, description, icon, rarity, category, requirement_type, requirement_value) VALUES
  ('3-Day Streak', 'Maintain a 3-day streak', '🔥', 'common', 'streak', 'streak', 3),
  ('7-Day Streak', 'Maintain a 7-day streak', '🔥', 'rare', 'streak', 'streak', 7),
  ('30-Day Streak', 'Maintain a 30-day streak', '💎', 'epic', 'streak', 'streak', 30),
  ('Cold Warrior', 'Take 10 cold showers', '🧊', 'epic', 'discipline', 'cold_showers', 10),
  ('Iron Discipline', 'Reach Level 20', '⚔️', 'legendary', 'level', 'level', 20),
  ('Proof Poster', 'Upload 5 proof photos', '📸', 'rare', 'social', 'proofs', 5),
  ('Battle Victor', 'Win your first battle', '🏆', 'epic', 'battle', 'battles_won', 1),
  ('Top 10 Percent', 'Reach the top 10 percent on leaderboard', '📊', 'epic', 'leaderboard', 'percentile', 10),
  ('Top 1 Percent', 'Reach the top 1 percent on leaderboard', '👑', 'legendary', 'leaderboard', 'percentile', 1),
  ('Founder', 'Early adopter of The W Tracker', '⭐', 'legendary', 'special', NULL, NULL),
  ('Spring 26', 'Active during Spring 2026', '🌸', 'rare', 'seasonal', NULL, NULL),
  ('Double Down', 'Complete 2 workouts in one day', '💪', 'rare', 'discipline', 'double_workout', 1);