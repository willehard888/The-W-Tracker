-- Release-readiness, the additive half: new columns, new indexes, no removals.
-- Safe to apply before the app build that uses it exists.
--
-- 1. AI consent (App Review 5.1.2(i), Nov 2025). The coach, the daily brief and
--    plan, the weekly review and meal-photo logging send what the member logs
--    to AI models from OpenAI and Google through OpenRouter. Apple requires
--    explicit consent first, and the choice has to live on the server: cron
--    functions (the morning brief, the weekly briefing, proactive nudges) run
--    with no client to ask.
--      NULL = never asked, 0 = declined or withdrawn, n = accepted version n.
--    Written by the member through the profile's own-row UPDATE policy, like
--    notification_prefs. `protect_profile_columns` does not guard these, so no
--    trigger change is needed.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_consent_version smallint,
  ADD COLUMN IF NOT EXISTS ai_consent_at timestamptz;

-- 2. When each product's access actually ends. The webhook used to decide from
--    the single event in hand, so one product's EXPIRATION revoked membership
--    while another subscription was still live, and a refund kept access until
--    some later expiry Apple does not promise to send promptly. With the
--    expiry on the ledger row the decision can ask "does this member still
--    hold anything?" (supabase/functions/_shared/rc-entitlement.ts).
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 3. Indexes for the reads that will grow with the member count. Each one
--    matches a query the app runs on every open of a screen.
-- The feed, newest first, approved only.
CREATE INDEX IF NOT EXISTS idx_feed_posts_moderation_created
  ON public.feed_posts (moderation_status, created_at DESC);
-- Reaction counts per post (the feed fetches them per page).
CREATE INDEX IF NOT EXISTS idx_feed_reactions_post ON public.feed_reactions (post_id);
-- Kudos on a post (the existing index leads with giver_id, which this read has not got).
CREATE INDEX IF NOT EXISTS idx_kudos_post ON public.kudos (post_id);
-- The battle resolver's scan, every 15 minutes.
CREATE INDEX IF NOT EXISTS idx_battles_status_end ON public.battles (status, end_date);
-- One DM thread, newest first.
CREATE INDEX IF NOT EXISTS idx_dm_thread ON public.direct_messages (sender_id, receiver_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
