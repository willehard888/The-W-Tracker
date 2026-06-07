--
-- PostgreSQL database dump
--

\restrict ZJHhKh3mhiutiYABzjD9f7fOr2LgORlEC50OT3MbrittSiQHsHL4t9F8nSXYdnt

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP POLICY IF EXISTS "Users view own weekly reviews" ON public.coach_weekly_reviews;
DROP POLICY IF EXISTS "Users view own snapshots" ON public.coach_performance_snapshots;
DROP POLICY IF EXISTS "Users view own reflections" ON public.coach_reflections;
DROP POLICY IF EXISTS "Users view own preference signals" ON public.coach_preference_signals;
DROP POLICY IF EXISTS "Users view own goals" ON public.coach_goals;
DROP POLICY IF EXISTS "Users view own chat memory" ON public.coach_chat_memory;
DROP POLICY IF EXISTS "Users view own athlete profile" ON public.coach_athlete_profile;
DROP POLICY IF EXISTS "Users update own goals" ON public.coach_goals;
DROP POLICY IF EXISTS "Users update own athlete profile" ON public.coach_athlete_profile;
DROP POLICY IF EXISTS "Users read own lesson progress" ON public.vault_lesson_progress;
DROP POLICY IF EXISTS "Users read own daily briefs" ON public.coach_daily_briefs;
DROP POLICY IF EXISTS "Users or owners can delete tribe comment" ON public.tribe_post_comments;
DROP POLICY IF EXISTS "Users mark own weekly reviews seen" ON public.coach_weekly_reviews;
DROP POLICY IF EXISTS "Users insert own preference signals" ON public.coach_preference_signals;
DROP POLICY IF EXISTS "Users insert own goals" ON public.coach_goals;
DROP POLICY IF EXISTS "Users insert own chat memory" ON public.coach_chat_memory;
DROP POLICY IF EXISTS "Users insert own athlete profile" ON public.coach_athlete_profile;
DROP POLICY IF EXISTS "Users delete own weekly reviews" ON public.coach_weekly_reviews;
DROP POLICY IF EXISTS "Users delete own reflections" ON public.coach_reflections;
DROP POLICY IF EXISTS "Users delete own lesson progress" ON public.vault_lesson_progress;
DROP POLICY IF EXISTS "Users delete own goals" ON public.coach_goals;
DROP POLICY IF EXISTS "Users delete own chat memory" ON public.coach_chat_memory;
DROP POLICY IF EXISTS "Users delete own athlete profile" ON public.coach_athlete_profile;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can view own redeemed invites" ON public.legend_invites;
DROP POLICY IF EXISTS "Users can view own programs" ON public.coach_programs;
DROP POLICY IF EXISTS "Users can view own nudges" ON public.coach_nudges;
DROP POLICY IF EXISTS "Users can view own mission logs" ON public.coach_mission_logs;
DROP POLICY IF EXISTS "Users can view own messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can view own logs" ON public.coach_program_logs;
DROP POLICY IF EXISTS "Users can view own habits" ON public.user_habits;
DROP POLICY IF EXISTS "Users can view own habit logs" ON public.user_habit_logs;
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can view own daily plans" ON public.coach_daily_plans;
DROP POLICY IF EXISTS "Users can view own checkins" ON public.daily_checkins;
DROP POLICY IF EXISTS "Users can view own briefings" ON public.weekly_briefings;
DROP POLICY IF EXISTS "Users can view own battles" ON public.battles;
DROP POLICY IF EXISTS "Users can update own tribe post" ON public.tribe_posts;
DROP POLICY IF EXISTS "Users can update own tribe comment" ON public.tribe_post_comments;
DROP POLICY IF EXISTS "Users can update own programs" ON public.coach_programs;
DROP POLICY IF EXISTS "Users can update own profile via RPC only" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Users can update own habits" ON public.user_habits;
DROP POLICY IF EXISTS "Users can update own comments" ON public.feed_comments;
DROP POLICY IF EXISTS "Users can send messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
DROP POLICY IF EXISTS "Users can remove own tribe kudos" ON public.tribe_post_kudos;
DROP POLICY IF EXISTS "Users can remove own reactions" ON public.feed_reactions;
DROP POLICY IF EXISTS "Users can remove own reaction" ON public.tribe_post_reactions;
DROP POLICY IF EXISTS "Users can remove own kudos" ON public.kudos;
DROP POLICY IF EXISTS "Users can react" ON public.feed_reactions;
DROP POLICY IF EXISTS "Users can mark own received messages read" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can mark own nudges seen" ON public.coach_nudges;
DROP POLICY IF EXISTS "Users can mark own briefings viewed" ON public.weekly_briefings;
DROP POLICY IF EXISTS "Users can manage own tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own checkins" ON public.daily_checkins;
DROP POLICY IF EXISTS "Users can give kudos" ON public.kudos;
DROP POLICY IF EXISTS "Users can delete own tribe post" ON public.tribe_posts;
DROP POLICY IF EXISTS "Users can delete own programs" ON public.coach_programs;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Users can delete own logs" ON public.coach_program_logs;
DROP POLICY IF EXISTS "Users can delete own habits" ON public.user_habits;
DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can delete own daily plans" ON public.coach_daily_plans;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.feed_comments;
DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Users can create battles" ON public.battles;
DROP POLICY IF EXISTS "Users can comment" ON public.feed_comments;
DROP POLICY IF EXISTS "Tribe posts viewable by members or public" ON public.tribe_posts;
DROP POLICY IF EXISTS "Tribe members can report" ON public.tribe_post_reports;
DROP POLICY IF EXISTS "Tribe members can comment" ON public.tribe_post_comments;
DROP POLICY IF EXISTS "Tribe kudos viewable by tribe-visible viewers" ON public.tribe_post_kudos;
DROP POLICY IF EXISTS "Tribe comments viewable by tribe-visible viewers" ON public.tribe_post_comments;
DROP POLICY IF EXISTS "Tribe battles visible to participants" ON public.tribe_battles;
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;
DROP POLICY IF EXISTS "Service can read all tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Reactions viewable by tribe-visible viewers" ON public.tribe_post_reactions;
DROP POLICY IF EXISTS "Reactions viewable by everyone" ON public.feed_reactions;
DROP POLICY IF EXISTS "Public tribes viewable by all authed" ON public.tribes;
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Premium users update own lesson progress" ON public.vault_lesson_progress;
DROP POLICY IF EXISTS "Premium users mark own lessons complete" ON public.vault_lesson_progress;
DROP POLICY IF EXISTS "Premium users can insert own logs" ON public.coach_program_logs;
DROP POLICY IF EXISTS "Premium users can create own programs" ON public.coach_programs;
DROP POLICY IF EXISTS "Premium users can add own habits" ON public.user_habits;
DROP POLICY IF EXISTS "Premium members can read vault articles" ON public.vault_articles;
DROP POLICY IF EXISTS "Only addressee can accept or decline friendships" ON public.friendships;
DROP POLICY IF EXISTS "No direct weekly review insert" ON public.coach_weekly_reviews;
DROP POLICY IF EXISTS "No direct vault update" ON public.vault_articles;
DROP POLICY IF EXISTS "No direct vault insert" ON public.vault_articles;
DROP POLICY IF EXISTS "No direct vault delete" ON public.vault_articles;
DROP POLICY IF EXISTS "No direct update" ON public.legend_invites;
DROP POLICY IF EXISTS "No direct tribe update" ON public.tribes;
DROP POLICY IF EXISTS "No direct tribe insert" ON public.tribes;
DROP POLICY IF EXISTS "No direct tribe delete" ON public.tribes;
DROP POLICY IF EXISTS "No direct tribe battle update" ON public.tribe_battles;
DROP POLICY IF EXISTS "No direct tribe battle insert" ON public.tribe_battles;
DROP POLICY IF EXISTS "No direct tribe battle delete" ON public.tribe_battles;
DROP POLICY IF EXISTS "No direct snapshot update" ON public.coach_performance_snapshots;
DROP POLICY IF EXISTS "No direct snapshot insert" ON public.coach_performance_snapshots;
DROP POLICY IF EXISTS "No direct role updates" ON public.user_roles;
DROP POLICY IF EXISTS "No direct role insertion" ON public.user_roles;
DROP POLICY IF EXISTS "No direct role deletion" ON public.user_roles;
DROP POLICY IF EXISTS "No direct reflection update" ON public.coach_reflections;
DROP POLICY IF EXISTS "No direct reflection insert" ON public.coach_reflections;
DROP POLICY IF EXISTS "No direct mission log insert" ON public.coach_mission_logs;
DROP POLICY IF EXISTS "No direct member update" ON public.tribe_members;
DROP POLICY IF EXISTS "No direct member insert" ON public.tribe_members;
DROP POLICY IF EXISTS "No direct member delete" ON public.tribe_members;
DROP POLICY IF EXISTS "No direct invite update" ON public.tribe_invites;
DROP POLICY IF EXISTS "No direct invite insert" ON public.tribe_invites;
DROP POLICY IF EXISTS "No direct invite delete" ON public.tribe_invites;
DROP POLICY IF EXISTS "No direct insert" ON public.legend_invites;
DROP POLICY IF EXISTS "No direct habit log update" ON public.user_habit_logs;
DROP POLICY IF EXISTS "No direct habit log insert" ON public.user_habit_logs;
DROP POLICY IF EXISTS "No direct delete" ON public.legend_invites;
DROP POLICY IF EXISTS "No direct daily plan update" ON public.coach_daily_plans;
DROP POLICY IF EXISTS "No direct daily plan insert" ON public.coach_daily_plans;
DROP POLICY IF EXISTS "No direct badge insertion" ON public.user_badges;
DROP POLICY IF EXISTS "Members rows visible to authed" ON public.tribe_members;
DROP POLICY IF EXISTS "Members can react" ON public.tribe_post_reactions;
DROP POLICY IF EXISTS "Members can post in their tribe" ON public.tribe_posts;
DROP POLICY IF EXISTS "Leaderboard seasons viewable by everyone" ON public.leaderboard_seasons;
DROP POLICY IF EXISTS "Leaderboard champions viewable by everyone" ON public.leaderboard_champions;
DROP POLICY IF EXISTS "Kudos viewable by everyone" ON public.kudos;
DROP POLICY IF EXISTS "Invites visible to participants" ON public.tribe_invites;
DROP POLICY IF EXISTS "Feed viewable by everyone" ON public.feed_posts;
DROP POLICY IF EXISTS "Elite users can post" ON public.feed_posts;
DROP POLICY IF EXISTS "Comments viewable by everyone" ON public.feed_comments;
DROP POLICY IF EXISTS "Badges viewable by everyone" ON public.user_badges;
DROP POLICY IF EXISTS "Badges viewable by everyone" ON public.badges;
DROP POLICY IF EXISTS "Authenticated users can vote" ON public.battle_votes;
DROP POLICY IF EXISTS "Authenticated can view votes" ON public.battle_votes;
DROP POLICY IF EXISTS "Authenticated can view all baselines" ON public.leaderboard_season_baselines;
DROP POLICY IF EXISTS "Apex tribe members can give kudos" ON public.tribe_post_kudos;
DROP POLICY IF EXISTS "Admins update tribe reports" ON public.tribe_post_reports;
DROP POLICY IF EXISTS "Admins can view reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can view moderations" ON public.content_moderations;
DROP POLICY IF EXISTS "Admins can view moderation queue" ON public.moderation_queue;
DROP POLICY IF EXISTS "Admins can view legend invites" ON public.legend_invites;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can update moderations" ON public.content_moderations;
DROP POLICY IF EXISTS "Admins can update moderation queue" ON public.moderation_queue;
DROP POLICY IF EXISTS "Admins can update any tribe post" ON public.tribe_posts;
DROP POLICY IF EXISTS "Admins can update any post" ON public.feed_posts;
DROP POLICY IF EXISTS "Admins can update any battle" ON public.battles;
DROP POLICY IF EXISTS "Admins can delete any tribe post" ON public.tribe_posts;
DROP POLICY IF EXISTS "Admins can delete any post" ON public.feed_posts;
DROP POLICY IF EXISTS "Admins can delete any comment" ON public.feed_comments;
DROP POLICY IF EXISTS "Admins can delete any battle" ON public.battles;
DROP POLICY IF EXISTS "Admins and tribe owners can view tribe reports" ON public.tribe_post_reports;
ALTER TABLE IF EXISTS ONLY public.vault_lesson_progress DROP CONSTRAINT IF EXISTS vault_lesson_progress_article_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_habit_logs DROP CONSTRAINT IF EXISTS user_habit_logs_habit_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_badges DROP CONSTRAINT IF EXISTS user_badges_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_badges DROP CONSTRAINT IF EXISTS user_badges_badge_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tribe_posts DROP CONSTRAINT IF EXISTS tribe_posts_tribe_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tribe_post_reports DROP CONSTRAINT IF EXISTS tribe_post_reports_post_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tribe_post_reactions DROP CONSTRAINT IF EXISTS tribe_post_reactions_post_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tribe_post_kudos DROP CONSTRAINT IF EXISTS tribe_post_kudos_post_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tribe_post_comments DROP CONSTRAINT IF EXISTS tribe_post_comments_post_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tribe_post_comments DROP CONSTRAINT IF EXISTS tribe_post_comments_parent_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tribe_members DROP CONSTRAINT IF EXISTS tribe_members_tribe_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tribe_invites DROP CONSTRAINT IF EXISTS tribe_invites_tribe_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tribe_battles DROP CONSTRAINT IF EXISTS tribe_battles_opponent_tribe_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tribe_battles DROP CONSTRAINT IF EXISTS tribe_battles_challenger_tribe_id_fkey;
ALTER TABLE IF EXISTS ONLY public.reports DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey;
ALTER TABLE IF EXISTS ONLY public.reports DROP CONSTRAINT IF EXISTS reports_post_id_fkey;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_referred_by_fkey;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_featured_badge_id_fkey;
ALTER TABLE IF EXISTS ONLY public.leaderboard_season_baselines DROP CONSTRAINT IF EXISTS leaderboard_season_baselines_season_id_fkey;
ALTER TABLE IF EXISTS ONLY public.leaderboard_champions DROP CONSTRAINT IF EXISTS leaderboard_champions_season_id_fkey;
ALTER TABLE IF EXISTS ONLY public.kudos DROP CONSTRAINT IF EXISTS kudos_post_id_fkey;
ALTER TABLE IF EXISTS ONLY public.feed_reactions DROP CONSTRAINT IF EXISTS feed_reactions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.feed_reactions DROP CONSTRAINT IF EXISTS feed_reactions_post_id_fkey;
ALTER TABLE IF EXISTS ONLY public.feed_posts DROP CONSTRAINT IF EXISTS feed_posts_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.feed_comments DROP CONSTRAINT IF EXISTS feed_comments_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.feed_comments DROP CONSTRAINT IF EXISTS feed_comments_post_id_fkey;
ALTER TABLE IF EXISTS ONLY public.feed_comments DROP CONSTRAINT IF EXISTS feed_comments_parent_id_fkey;
ALTER TABLE IF EXISTS ONLY public.daily_checkins DROP CONSTRAINT IF EXISTS daily_checkins_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.coach_program_logs DROP CONSTRAINT IF EXISTS coach_program_logs_program_id_fkey;
ALTER TABLE IF EXISTS ONLY public.coach_mission_logs DROP CONSTRAINT IF EXISTS coach_mission_logs_daily_plan_id_fkey;
ALTER TABLE IF EXISTS ONLY public.battles DROP CONSTRAINT IF EXISTS battles_winner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.battles DROP CONSTRAINT IF EXISTS battles_opponent_id_fkey;
ALTER TABLE IF EXISTS ONLY public.battles DROP CONSTRAINT IF EXISTS battles_challenger_id_fkey;
ALTER TABLE IF EXISTS ONLY public.battle_votes DROP CONSTRAINT IF EXISTS battle_votes_battle_id_fkey;
DROP TRIGGER IF EXISTS user_habits_updated_at ON public.user_habits;
DROP TRIGGER IF EXISTS update_status_after_checkin ON public.daily_checkins;
DROP TRIGGER IF EXISTS update_status_after_battle ON public.battles;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_feed_posts_updated_at ON public.feed_posts;
DROP TRIGGER IF EXISTS update_coach_daily_plans_updated_at ON public.coach_daily_plans;
DROP TRIGGER IF EXISTS trg_tribes_updated ON public.tribes;
DROP TRIGGER IF EXISTS trg_tribe_post_reaction_ins ON public.tribe_post_reactions;
DROP TRIGGER IF EXISTS trg_tribe_post_reaction_del ON public.tribe_post_reactions;
DROP TRIGGER IF EXISTS trg_tribe_kudos_insert ON public.tribe_post_kudos;
DROP TRIGGER IF EXISTS trg_tribe_kudos_delete ON public.tribe_post_kudos;
DROP TRIGGER IF EXISTS trg_tribe_comment_count ON public.tribe_post_comments;
DROP TRIGGER IF EXISTS trg_new_profile_leaderboard_baseline ON public.profiles;
DROP TRIGGER IF EXISTS trg_handle_kudos_insert ON public.kudos;
DROP TRIGGER IF EXISTS trg_handle_kudos_delete ON public.kudos;
DROP TRIGGER IF EXISTS trg_coach_programs_updated_at ON public.coach_programs;
DROP TRIGGER IF EXISTS trg_check_viral_badge ON public.feed_reactions;
DROP TRIGGER IF EXISTS trg_check_influencer_badge ON public.feed_reactions;
DROP TRIGGER IF EXISTS trg_check_commentator_badge ON public.feed_comments;
DROP TRIGGER IF EXISTS trg_auto_grant_founding_apex_to_legends ON public.profiles;
DROP TRIGGER IF EXISTS profiles_reconcile_tribe_pause ON public.profiles;
DROP TRIGGER IF EXISTS on_feed_reaction_change ON public.feed_reactions;
DROP TRIGGER IF EXISTS on_battle_vote_check_threshold ON public.battle_votes;
DROP TRIGGER IF EXISTS coach_goals_set_updated_at ON public.coach_goals;
DROP TRIGGER IF EXISTS coach_chat_memory_cap ON public.coach_chat_memory;
DROP TRIGGER IF EXISTS coach_athlete_profile_set_updated_at ON public.coach_athlete_profile;
DROP TRIGGER IF EXISTS check_expired_battles ON public.battles;
DROP INDEX IF EXISTS public.vault_lesson_progress_user_idx;
DROP INDEX IF EXISTS public.vault_articles_category_lesson_idx;
DROP INDEX IF EXISTS public.user_habits_user_idx;
DROP INDEX IF EXISTS public.user_habits_active_unique;
DROP INDEX IF EXISTS public.user_habit_logs_user_date_idx;
DROP INDEX IF EXISTS public.tribes_name_unique;
DROP INDEX IF EXISTS public.tribe_invites_tribe_idx;
DROP INDEX IF EXISTS public.tribe_invites_pending_unique;
DROP INDEX IF EXISTS public.tribe_invites_invitee_idx;
DROP INDEX IF EXISTS public.tribe_battles_opponent_idx;
DROP INDEX IF EXISTS public.tribe_battles_challenger_idx;
DROP INDEX IF EXISTS public.referrals_referrer_converted_idx;
DROP INDEX IF EXISTS public.referrals_referred_id_unique;
DROP INDEX IF EXISTS public.profiles_referral_code_idx;
DROP INDEX IF EXISTS public.profiles_is_premium_idx;
DROP INDEX IF EXISTS public.kudos_giver_post_unique;
DROP INDEX IF EXISTS public.idx_weekly_briefings_user_generated;
DROP INDEX IF EXISTS public.idx_vault_articles_category_order;
DROP INDEX IF EXISTS public.idx_tribe_posts_tribe;
DROP INDEX IF EXISTS public.idx_tribe_post_reports_post;
DROP INDEX IF EXISTS public.idx_tribe_post_kudos_post;
DROP INDEX IF EXISTS public.idx_tribe_post_kudos_giver;
DROP INDEX IF EXISTS public.idx_tribe_post_comments_post;
DROP INDEX IF EXISTS public.idx_tribe_post_comments_parent;
DROP INDEX IF EXISTS public.idx_tribe_members_user;
DROP INDEX IF EXISTS public.idx_pref_signals_user_type;
DROP INDEX IF EXISTS public.idx_pref_signals_user_protocol;
DROP INDEX IF EXISTS public.idx_moderation_queue_status_created;
DROP INDEX IF EXISTS public.idx_moderation_cache_created_at;
DROP INDEX IF EXISTS public.idx_legend_invites_used_by;
DROP INDEX IF EXISTS public.idx_legend_invites_code;
DROP INDEX IF EXISTS public.idx_leaderboard_seasons_status_dates;
DROP INDEX IF EXISTS public.idx_leaderboard_champions_user;
DROP INDEX IF EXISTS public.idx_leaderboard_baselines_season_user;
DROP INDEX IF EXISTS public.idx_feed_comments_post_parent;
DROP INDEX IF EXISTS public.idx_feed_comments_parent_id;
DROP INDEX IF EXISTS public.idx_dm_sender;
DROP INDEX IF EXISTS public.idx_dm_receiver;
DROP INDEX IF EXISTS public.idx_dm_created;
DROP INDEX IF EXISTS public.idx_content_moderations_content;
DROP INDEX IF EXISTS public.idx_content_moderations_action;
DROP INDEX IF EXISTS public.idx_coach_weekly_reviews_user_week;
DROP INDEX IF EXISTS public.idx_coach_reflections_user_date;
DROP INDEX IF EXISTS public.idx_coach_programs_user_active;
DROP INDEX IF EXISTS public.idx_coach_program_logs_user;
DROP INDEX IF EXISTS public.idx_coach_perf_snapshots_user_date;
DROP INDEX IF EXISTS public.idx_coach_nudges_user_created;
DROP INDEX IF EXISTS public.idx_coach_mission_logs_user;
DROP INDEX IF EXISTS public.idx_coach_goals_user_status;
DROP INDEX IF EXISTS public.idx_coach_daily_plans_user_date;
DROP INDEX IF EXISTS public.idx_coach_daily_briefs_user_date;
DROP INDEX IF EXISTS public.idx_checkins_user_date;
DROP INDEX IF EXISTS public.idx_chat_memory_user;
DROP INDEX IF EXISTS public.idx_battle_votes_battle;
ALTER TABLE IF EXISTS ONLY public.weekly_briefings DROP CONSTRAINT IF EXISTS weekly_briefings_user_id_week_start_key;
ALTER TABLE IF EXISTS ONLY public.weekly_briefings DROP CONSTRAINT IF EXISTS weekly_briefings_pkey;
ALTER TABLE IF EXISTS ONLY public.vault_lesson_progress DROP CONSTRAINT IF EXISTS vault_lesson_progress_user_id_article_id_key;
ALTER TABLE IF EXISTS ONLY public.vault_lesson_progress DROP CONSTRAINT IF EXISTS vault_lesson_progress_pkey;
ALTER TABLE IF EXISTS ONLY public.vault_articles DROP CONSTRAINT IF EXISTS vault_articles_slug_key;
ALTER TABLE IF EXISTS ONLY public.vault_articles DROP CONSTRAINT IF EXISTS vault_articles_pkey;
ALTER TABLE IF EXISTS ONLY public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE IF EXISTS ONLY public.user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;
ALTER TABLE IF EXISTS ONLY public.user_habits DROP CONSTRAINT IF EXISTS user_habits_pkey;
ALTER TABLE IF EXISTS ONLY public.user_habit_logs DROP CONSTRAINT IF EXISTS user_habit_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.user_habit_logs DROP CONSTRAINT IF EXISTS user_habit_logs_habit_id_logged_on_key;
ALTER TABLE IF EXISTS ONLY public.user_badges DROP CONSTRAINT IF EXISTS user_badges_user_id_badge_id_key;
ALTER TABLE IF EXISTS ONLY public.user_badges DROP CONSTRAINT IF EXISTS user_badges_pkey;
ALTER TABLE IF EXISTS ONLY public.tribes DROP CONSTRAINT IF EXISTS tribes_slug_key;
ALTER TABLE IF EXISTS ONLY public.tribes DROP CONSTRAINT IF EXISTS tribes_pkey;
ALTER TABLE IF EXISTS ONLY public.tribes DROP CONSTRAINT IF EXISTS tribes_name_key;
ALTER TABLE IF EXISTS ONLY public.tribe_posts DROP CONSTRAINT IF EXISTS tribe_posts_pkey;
ALTER TABLE IF EXISTS ONLY public.tribe_post_reports DROP CONSTRAINT IF EXISTS tribe_post_reports_pkey;
ALTER TABLE IF EXISTS ONLY public.tribe_post_reactions DROP CONSTRAINT IF EXISTS tribe_post_reactions_post_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.tribe_post_reactions DROP CONSTRAINT IF EXISTS tribe_post_reactions_pkey;
ALTER TABLE IF EXISTS ONLY public.tribe_post_kudos DROP CONSTRAINT IF EXISTS tribe_post_kudos_post_id_giver_id_key;
ALTER TABLE IF EXISTS ONLY public.tribe_post_kudos DROP CONSTRAINT IF EXISTS tribe_post_kudos_pkey;
ALTER TABLE IF EXISTS ONLY public.tribe_post_comments DROP CONSTRAINT IF EXISTS tribe_post_comments_pkey;
ALTER TABLE IF EXISTS ONLY public.tribe_members DROP CONSTRAINT IF EXISTS tribe_members_tribe_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.tribe_members DROP CONSTRAINT IF EXISTS tribe_members_pkey;
ALTER TABLE IF EXISTS ONLY public.tribe_invites DROP CONSTRAINT IF EXISTS tribe_invites_pkey;
ALTER TABLE IF EXISTS ONLY public.tribe_battles DROP CONSTRAINT IF EXISTS tribe_battles_pkey;
ALTER TABLE IF EXISTS ONLY public.reports DROP CONSTRAINT IF EXISTS reports_pkey;
ALTER TABLE IF EXISTS ONLY public.referrals DROP CONSTRAINT IF EXISTS referrals_referred_id_key;
ALTER TABLE IF EXISTS ONLY public.referrals DROP CONSTRAINT IF EXISTS referrals_pkey;
ALTER TABLE IF EXISTS ONLY public.push_tokens DROP CONSTRAINT IF EXISTS push_tokens_user_id_token_key;
ALTER TABLE IF EXISTS ONLY public.push_tokens DROP CONSTRAINT IF EXISTS push_tokens_pkey;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_referral_code_key;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey;
ALTER TABLE IF EXISTS ONLY public.moderation_queue DROP CONSTRAINT IF EXISTS moderation_queue_pkey;
ALTER TABLE IF EXISTS ONLY public.moderation_cache DROP CONSTRAINT IF EXISTS moderation_cache_pkey;
ALTER TABLE IF EXISTS ONLY public.legend_invites DROP CONSTRAINT IF EXISTS legend_invites_pkey;
ALTER TABLE IF EXISTS ONLY public.legend_invites DROP CONSTRAINT IF EXISTS legend_invites_code_key;
ALTER TABLE IF EXISTS ONLY public.leaderboard_seasons DROP CONSTRAINT IF EXISTS leaderboard_seasons_pkey;
ALTER TABLE IF EXISTS ONLY public.leaderboard_season_baselines DROP CONSTRAINT IF EXISTS leaderboard_season_baselines_season_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.leaderboard_season_baselines DROP CONSTRAINT IF EXISTS leaderboard_season_baselines_pkey;
ALTER TABLE IF EXISTS ONLY public.leaderboard_champions DROP CONSTRAINT IF EXISTS leaderboard_champions_season_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.leaderboard_champions DROP CONSTRAINT IF EXISTS leaderboard_champions_pkey;
ALTER TABLE IF EXISTS ONLY public.kudos DROP CONSTRAINT IF EXISTS kudos_pkey;
ALTER TABLE IF EXISTS ONLY public.friendships DROP CONSTRAINT IF EXISTS friendships_requester_id_addressee_id_key;
ALTER TABLE IF EXISTS ONLY public.friendships DROP CONSTRAINT IF EXISTS friendships_pkey;
ALTER TABLE IF EXISTS ONLY public.feed_reactions DROP CONSTRAINT IF EXISTS feed_reactions_post_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.feed_reactions DROP CONSTRAINT IF EXISTS feed_reactions_pkey;
ALTER TABLE IF EXISTS ONLY public.feed_posts DROP CONSTRAINT IF EXISTS feed_posts_pkey;
ALTER TABLE IF EXISTS ONLY public.feed_comments DROP CONSTRAINT IF EXISTS feed_comments_pkey;
ALTER TABLE IF EXISTS ONLY public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_pkey;
ALTER TABLE IF EXISTS ONLY public.daily_checkins DROP CONSTRAINT IF EXISTS daily_checkins_pkey;
ALTER TABLE IF EXISTS ONLY public.content_moderations DROP CONSTRAINT IF EXISTS content_moderations_pkey;
ALTER TABLE IF EXISTS ONLY public.coach_weekly_reviews DROP CONSTRAINT IF EXISTS coach_weekly_reviews_user_id_week_starts_on_key;
ALTER TABLE IF EXISTS ONLY public.coach_weekly_reviews DROP CONSTRAINT IF EXISTS coach_weekly_reviews_pkey;
ALTER TABLE IF EXISTS ONLY public.coach_reflections DROP CONSTRAINT IF EXISTS coach_reflections_user_id_reflection_date_key;
ALTER TABLE IF EXISTS ONLY public.coach_reflections DROP CONSTRAINT IF EXISTS coach_reflections_pkey;
ALTER TABLE IF EXISTS ONLY public.coach_programs DROP CONSTRAINT IF EXISTS coach_programs_pkey;
ALTER TABLE IF EXISTS ONLY public.coach_program_logs DROP CONSTRAINT IF EXISTS coach_program_logs_program_id_week_day_index_key;
ALTER TABLE IF EXISTS ONLY public.coach_program_logs DROP CONSTRAINT IF EXISTS coach_program_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.coach_preference_signals DROP CONSTRAINT IF EXISTS coach_preference_signals_pkey;
ALTER TABLE IF EXISTS ONLY public.coach_performance_snapshots DROP CONSTRAINT IF EXISTS coach_performance_snapshots_user_id_snapshot_date_key;
ALTER TABLE IF EXISTS ONLY public.coach_performance_snapshots DROP CONSTRAINT IF EXISTS coach_performance_snapshots_pkey;
ALTER TABLE IF EXISTS ONLY public.coach_nudges DROP CONSTRAINT IF EXISTS coach_nudges_pkey;
ALTER TABLE IF EXISTS ONLY public.coach_mission_logs DROP CONSTRAINT IF EXISTS coach_mission_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.coach_mission_logs DROP CONSTRAINT IF EXISTS coach_mission_logs_daily_plan_id_mission_id_key;
ALTER TABLE IF EXISTS ONLY public.coach_goals DROP CONSTRAINT IF EXISTS coach_goals_pkey;
ALTER TABLE IF EXISTS ONLY public.coach_daily_plans DROP CONSTRAINT IF EXISTS coach_daily_plans_user_id_plan_date_key;
ALTER TABLE IF EXISTS ONLY public.coach_daily_plans DROP CONSTRAINT IF EXISTS coach_daily_plans_pkey;
ALTER TABLE IF EXISTS ONLY public.coach_daily_briefs DROP CONSTRAINT IF EXISTS coach_daily_briefs_user_id_brief_date_key;
ALTER TABLE IF EXISTS ONLY public.coach_daily_briefs DROP CONSTRAINT IF EXISTS coach_daily_briefs_pkey;
ALTER TABLE IF EXISTS ONLY public.coach_chat_memory DROP CONSTRAINT IF EXISTS coach_chat_memory_pkey;
ALTER TABLE IF EXISTS ONLY public.coach_athlete_profile DROP CONSTRAINT IF EXISTS coach_athlete_profile_pkey;
ALTER TABLE IF EXISTS ONLY public.battles DROP CONSTRAINT IF EXISTS battles_pkey;
ALTER TABLE IF EXISTS ONLY public.battle_votes DROP CONSTRAINT IF EXISTS battle_votes_pkey;
ALTER TABLE IF EXISTS ONLY public.battle_votes DROP CONSTRAINT IF EXISTS battle_votes_battle_id_voter_id_key;
ALTER TABLE IF EXISTS ONLY public.badges DROP CONSTRAINT IF EXISTS badges_pkey;
ALTER TABLE IF EXISTS ONLY public.badges DROP CONSTRAINT IF EXISTS badges_name_key;
DROP TABLE IF EXISTS public.weekly_briefings;
DROP TABLE IF EXISTS public.vault_lesson_progress;
DROP TABLE IF EXISTS public.vault_articles;
DROP TABLE IF EXISTS public.user_roles;
DROP TABLE IF EXISTS public.user_habits;
DROP TABLE IF EXISTS public.user_habit_logs;
DROP TABLE IF EXISTS public.user_badges;
DROP TABLE IF EXISTS public.tribes;
DROP TABLE IF EXISTS public.tribe_posts;
DROP TABLE IF EXISTS public.tribe_post_reports;
DROP TABLE IF EXISTS public.tribe_post_reactions;
DROP TABLE IF EXISTS public.tribe_post_kudos;
DROP TABLE IF EXISTS public.tribe_post_comments;
DROP TABLE IF EXISTS public.tribe_members;
DROP TABLE IF EXISTS public.tribe_invites;
DROP TABLE IF EXISTS public.tribe_battles;
DROP TABLE IF EXISTS public.reports;
DROP TABLE IF EXISTS public.referrals;
DROP TABLE IF EXISTS public.push_tokens;
DROP TABLE IF EXISTS public.profiles;
DROP TABLE IF EXISTS public.moderation_queue;
DROP TABLE IF EXISTS public.moderation_cache;
DROP TABLE IF EXISTS public.legend_invites;
DROP TABLE IF EXISTS public.leaderboard_season_baselines;
DROP TABLE IF EXISTS public.leaderboard_champions;
DROP TABLE IF EXISTS public.kudos;
DROP TABLE IF EXISTS public.friendships;
DROP TABLE IF EXISTS public.feed_reactions;
DROP TABLE IF EXISTS public.feed_posts;
DROP TABLE IF EXISTS public.feed_comments;
DROP TABLE IF EXISTS public.direct_messages;
DROP TABLE IF EXISTS public.daily_checkins;
DROP TABLE IF EXISTS public.content_moderations;
DROP TABLE IF EXISTS public.coach_weekly_reviews;
DROP TABLE IF EXISTS public.coach_reflections;
DROP TABLE IF EXISTS public.coach_program_logs;
DROP TABLE IF EXISTS public.coach_preference_signals;
DROP TABLE IF EXISTS public.coach_performance_snapshots;
DROP TABLE IF EXISTS public.coach_nudges;
DROP TABLE IF EXISTS public.coach_mission_logs;
DROP TABLE IF EXISTS public.coach_daily_plans;
DROP TABLE IF EXISTS public.coach_chat_memory;
DROP TABLE IF EXISTS public.battles;
DROP TABLE IF EXISTS public.battle_votes;
DROP TABLE IF EXISTS public.badges;
DROP FUNCTION IF EXISTS public.upsert_weekly_review(_week_starts_on date, _performance_score integer, _driver_of_week text, _wins jsonb, _frictions jsonb, _next_week_focus text, _program_tweak text, _generated_with text);
DROP FUNCTION IF EXISTS public.upsert_reflection(_reflection_date date, _energy_1to5 integer, _rpe_1to10 integer, _sleep_quality_1to5 integer, _mood_1to5 integer, _win text, _friction text);
DROP FUNCTION IF EXISTS public.upsert_performance_snapshot(_snapshot_date date, _performance_score integer, _components jsonb);
DROP FUNCTION IF EXISTS public.upsert_goal(_patch jsonb);
DROP FUNCTION IF EXISTS public.upsert_daily_plan(_plan_date date, _readiness_score integer, _readiness_breakdown jsonb, _adjustment text, _headline text, _missions jsonb, _generated_with text, _rationale text, _framework_version text);
DROP FUNCTION IF EXISTS public.upsert_daily_plan(_plan_date date, _readiness_score integer, _readiness_breakdown jsonb, _adjustment text, _headline text, _missions jsonb, _generated_with text);
DROP FUNCTION IF EXISTS public.upsert_daily_brief(_payload jsonb);
DROP TABLE IF EXISTS public.coach_daily_briefs;
DROP FUNCTION IF EXISTS public.upsert_athlete_profile(_patch jsonb);
DROP TABLE IF EXISTS public.coach_athlete_profile;
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS public.update_tribe(p_tribe_id uuid, p_name text, p_description text, p_visibility text, p_cover_url text, p_clear_cover boolean);
DROP FUNCTION IF EXISTS public.update_status_tier(target_user_id uuid);
DROP FUNCTION IF EXISTS public.update_own_profile(new_username text, new_display_name text, new_avatar_url text, new_featured_badge_id uuid, clear_featured_badge boolean);
DROP FUNCTION IF EXISTS public.update_goal_progress(_goal_id uuid, _new_value numeric);
DROP TABLE IF EXISTS public.coach_goals;
DROP FUNCTION IF EXISTS public.update_all_status_tiers();
DROP FUNCTION IF EXISTS public.trg_update_status_after_checkin();
DROP FUNCTION IF EXISTS public.trg_update_status_after_battle();
DROP FUNCTION IF EXISTS public.trg_reconcile_owned_tribes_pause();
DROP FUNCTION IF EXISTS public.sync_tribe_pause_state();
DROP FUNCTION IF EXISTS public.submit_battle_proof(battle_id uuid, proof_url text);
DROP FUNCTION IF EXISTS public.set_tribe_member_role(p_tribe_id uuid, p_user_id uuid, p_role text);
DROP FUNCTION IF EXISTS public.set_elite_status(target_user_id uuid, elite boolean);
DROP FUNCTION IF EXISTS public.search_tribes(p_query text, p_limit integer);
DROP FUNCTION IF EXISTS public.reward_referral_conversion(p_user uuid);
DROP FUNCTION IF EXISTS public.revoke_tribe_invite(p_invite_id uuid);
DROP FUNCTION IF EXISTS public.respond_to_tribe_invite(p_invite_id uuid, p_accept boolean);
DROP FUNCTION IF EXISTS public.respond_to_tribe_battle(p_battle_id uuid, p_accept boolean);
DROP FUNCTION IF EXISTS public.respond_to_battle(battle_id uuid, accept boolean);
DROP FUNCTION IF EXISTS public.resolve_tribe_battle(p_battle_id uuid);
DROP FUNCTION IF EXISTS public.remove_tribe_member(p_tribe_id uuid, p_user_id uuid);
DROP FUNCTION IF EXISTS public.redeem_legend_invite(p_code text);
DROP FUNCTION IF EXISTS public.log_preference_signal(_signal_type text, _protocol_id text, _value text, _metadata jsonb);
DROP FUNCTION IF EXISTS public.log_habit(_habit_id uuid, _date date);
DROP FUNCTION IF EXISTS public.leave_tribe(p_tribe_id uuid);
DROP FUNCTION IF EXISTS public.join_tribe(p_tribe_id uuid);
DROP FUNCTION IF EXISTS public.is_valid_tribe_owner(_user_id uuid);
DROP FUNCTION IF EXISTS public.is_tribe_owner(_tribe_id uuid, _user_id uuid);
DROP FUNCTION IF EXISTS public.is_tribe_member(_tribe_id uuid, _user_id uuid);
DROP FUNCTION IF EXISTS public.is_tribe_admin(_tribe_id uuid, _user_id uuid);
DROP FUNCTION IF EXISTS public.invite_to_tribe(p_tribe_id uuid, p_invitee_id uuid);
DROP FUNCTION IF EXISTS public.has_role(_user_id uuid, _role public.app_role);
DROP FUNCTION IF EXISTS public.has_premium(_user_id uuid);
DROP FUNCTION IF EXISTS public.has_active_access(_user_id uuid);
DROP FUNCTION IF EXISTS public.handle_tribe_post_reaction();
DROP FUNCTION IF EXISTS public.handle_tribe_kudos_insert();
DROP FUNCTION IF EXISTS public.handle_tribe_kudos_delete();
DROP FUNCTION IF EXISTS public.handle_tribe_comment_count();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_new_profile_leaderboard_baseline();
DROP FUNCTION IF EXISTS public.handle_kudos_insert();
DROP FUNCTION IF EXISTS public.handle_kudos_delete();
DROP FUNCTION IF EXISTS public.handle_feed_reaction_xp();
DROP FUNCTION IF EXISTS public.get_user_rank(p_user_id uuid);
DROP FUNCTION IF EXISTS public.get_tribe_leaderboard(p_period text, p_limit integer);
DROP FUNCTION IF EXISTS public.get_top_inviters(p_limit integer);
DROP FUNCTION IF EXISTS public.get_active_coach_program(_user_id uuid);
DROP TABLE IF EXISTS public.coach_programs;
DROP FUNCTION IF EXISTS public.finalize_expired_leaderboard_seasons();
DROP FUNCTION IF EXISTS public.ensure_active_leaderboard_season();
DROP TABLE IF EXISTS public.leaderboard_seasons;
DROP FUNCTION IF EXISTS public.enforce_chat_memory_cap();
DROP FUNCTION IF EXISTS public.delete_tribe(p_tribe_id uuid);
DROP FUNCTION IF EXISTS public.delete_chat_memory(_id uuid);
DROP FUNCTION IF EXISTS public.create_tribe_battle(p_challenger_tribe_id uuid, p_opponent_tribe_id uuid, p_duration_days integer);
DROP FUNCTION IF EXISTS public.create_tribe(p_name text, p_description text, p_visibility text, p_cover_url text);
DROP FUNCTION IF EXISTS public.create_legend_invite(p_code text, p_expires_at timestamp with time zone, p_note text);
DROP FUNCTION IF EXISTS public.complete_coach_mission(_plan_id uuid, _mission_id text);
DROP FUNCTION IF EXISTS public.claim_referral(p_referrer_code text);
DROP FUNCTION IF EXISTS public.claim_paused_tribe(p_tribe_id uuid);
DROP FUNCTION IF EXISTS public.check_voting_threshold();
DROP FUNCTION IF EXISTS public.check_viral_badge();
DROP FUNCTION IF EXISTS public.check_influencer_badge();
DROP FUNCTION IF EXISTS public.check_commentator_badge();
DROP FUNCTION IF EXISTS public.can_create_tribe(_user_id uuid);
DROP FUNCTION IF EXISTS public.calculate_rank_score(p_user_id uuid);
DROP FUNCTION IF EXISTS public.award_badge_if_earned(p_user_id uuid, p_badge_id uuid);
DROP FUNCTION IF EXISTS public.auto_resolve_expired_tribe_battles();
DROP FUNCTION IF EXISTS public.auto_resolve_expired_battles();
DROP FUNCTION IF EXISTS public.auto_grant_founding_apex_to_legends();
DROP FUNCTION IF EXISTS public.approve_tribe_member(p_tribe_id uuid, p_user_id uuid, p_accept boolean);
DROP FUNCTION IF EXISTS public.append_chat_memory_batch(_facts jsonb);
DROP FUNCTION IF EXISTS public.add_user_habit(_protocol_id text);
DROP FUNCTION IF EXISTS public.add_chat_memory(_fact text, _source text, _confidence numeric);
DROP TYPE IF EXISTS public.tribe_battle_status;
DROP TYPE IF EXISTS public.status_tier;
DROP TYPE IF EXISTS public.leaderboard_season_status;
DROP TYPE IF EXISTS public.friendship_status;
DROP TYPE IF EXISTS public.battle_status;
DROP TYPE IF EXISTS public.badge_rarity;
DROP TYPE IF EXISTS public.app_role;
DROP SCHEMA IF EXISTS public;
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user'
);


--
-- Name: badge_rarity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.badge_rarity AS ENUM (
    'common',
    'rare',
    'epic',
    'legendary'
);


--
-- Name: battle_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.battle_status AS ENUM (
    'pending',
    'active',
    'completed',
    'declined',
    'voting'
);


--
-- Name: friendship_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.friendship_status AS ENUM (
    'pending',
    'accepted',
    'declined'
);


--
-- Name: leaderboard_season_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.leaderboard_season_status AS ENUM (
    'active',
    'completed'
);


--
-- Name: status_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.status_tier AS ENUM (
    'normal',
    'rising',
    'high_performer',
    'elite',
    'recruit',
    'operator',
    'performer',
    'apex',
    'legend'
);


--
-- Name: tribe_battle_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tribe_battle_status AS ENUM (
    'pending',
    'active',
    'completed',
    'declined',
    'expired'
);


--
-- Name: add_chat_memory(text, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_chat_memory(_fact text, _source text DEFAULT 'chat'::text, _confidence numeric DEFAULT 0.7) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  -- skip if identical fact already exists in last 60 days
  IF EXISTS (
    SELECT 1 FROM public.coach_chat_memory
    WHERE user_id = uid
      AND lower(fact) = lower(_fact)
      AND created_at > now() - interval '60 days'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.coach_chat_memory (user_id, fact, source, confidence)
  VALUES (uid, _fact, COALESCE(_source,'chat'), COALESCE(_confidence, 0.7))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;


--
-- Name: add_user_habit(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_user_habit(_protocol_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_active_count int;
  v_existing uuid;
  v_new_id uuid;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;
  IF NOT public.has_premium(v_user) THEN RETURN jsonb_build_object('error', 'premium_required'); END IF;
  IF _protocol_id IS NULL OR length(_protocol_id) = 0 OR length(_protocol_id) > 80 THEN
    RETURN jsonb_build_object('error', 'invalid_protocol');
  END IF;

  SELECT id INTO v_existing FROM public.user_habits
   WHERE user_id = v_user AND protocol_id = _protocol_id AND archived_at IS NULL;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_active', 'habit_id', v_existing);
  END IF;

  SELECT count(*) INTO v_active_count FROM public.user_habits
   WHERE user_id = v_user AND archived_at IS NULL;
  IF v_active_count >= 5 THEN
    RETURN jsonb_build_object('error', 'cap_reached');
  END IF;

  INSERT INTO public.user_habits (user_id, protocol_id)
  VALUES (v_user, _protocol_id)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'habit_id', v_new_id);
END;
$$;


--
-- Name: append_chat_memory_batch(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.append_chat_memory_batch(_facts jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  inserted int := 0;
  item jsonb;
  fact_text text;
  conf numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF jsonb_typeof(_facts) <> 'array' THEN RETURN 0; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(_facts) LOOP
    fact_text := LEFT(COALESCE(item->>'fact', ''), 240);
    conf := LEAST(1, GREATEST(0, COALESCE((item->>'confidence')::numeric, 0.7)));
    IF length(fact_text) >= 6 THEN
      INSERT INTO public.coach_chat_memory (user_id, fact, confidence, source)
      VALUES (uid, fact_text, conf, 'chat-extract');
      inserted := inserted + 1;
    END IF;
  END LOOP;
  -- Prune to last 50 facts per user
  DELETE FROM public.coach_chat_memory
  WHERE user_id = uid
    AND id NOT IN (
      SELECT id FROM public.coach_chat_memory
      WHERE user_id = uid
      ORDER BY created_at DESC
      LIMIT 50
    );
  RETURN inserted;
END $$;


--
-- Name: approve_tribe_member(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_tribe_member(p_tribe_id uuid, p_user_id uuid, p_accept boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_tribe_owner(p_tribe_id, v_user) THEN
    RAISE EXCEPTION 'Only the owner can approve members';
  END IF;

  IF p_accept THEN
    SELECT member_count INTO v_count FROM tribes WHERE id = p_tribe_id;
    IF v_count >= 10 THEN
      RAISE EXCEPTION 'Tribe is full (max 10 members)';
    END IF;

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


--
-- Name: auto_grant_founding_apex_to_legends(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_grant_founding_apex_to_legends() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status_tier = 'legend' AND (OLD.status_tier IS DISTINCT FROM 'legend') THEN
    NEW.is_apex_subscriber := true;
    IF NEW.apex_subscription_started_at IS NULL THEN
      NEW.apex_subscription_started_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: auto_resolve_expired_battles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_resolve_expired_battles() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  expired RECORD;
  winner uuid;
BEGIN
  FOR expired IN
    SELECT * FROM battles
    WHERE status = 'active'
      AND started_at IS NOT NULL
      AND (started_at + (duration_days || ' days')::interval) < now()
  LOOP
    winner := NULL;

    IF expired.challenger_proof_url IS NULL AND expired.opponent_proof_url IS NULL THEN
      -- Both forfeit
      UPDATE battles SET status = 'completed', ended_at = now(), winner_id = NULL WHERE id = expired.id;
    ELSIF expired.challenger_proof_url IS NULL THEN
      UPDATE battles SET status = 'completed', ended_at = now(), winner_id = expired.opponent_id WHERE id = expired.id;
    ELSIF expired.opponent_proof_url IS NULL THEN
      UPDATE battles SET status = 'completed', ended_at = now(), winner_id = expired.challenger_id WHERE id = expired.id;
    ELSE
      -- Both have proof
      IF expired.challenger_score > expired.opponent_score THEN
        UPDATE battles SET status = 'completed', ended_at = now(), winner_id = expired.challenger_id WHERE id = expired.id;
      ELSIF expired.opponent_score > expired.challenger_score THEN
        UPDATE battles SET status = 'completed', ended_at = now(), winner_id = expired.opponent_id WHERE id = expired.id;
      ELSE
        -- Tie with both proofs → community voting
        UPDATE battles SET status = 'voting', ended_at = now() WHERE id = expired.id;
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;


--
-- Name: auto_resolve_expired_tribe_battles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_resolve_expired_tribe_battles() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM tribe_battles
    WHERE status = 'active'
      AND started_at IS NOT NULL
      AND (started_at + (duration_days || ' days')::interval) <= now()
  LOOP
    PERFORM public.resolve_tribe_battle(r.id);
  END LOOP;
END;
$$;


--
-- Name: award_badge_if_earned(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_badge_if_earned(p_user_id uuid, p_badge_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  badge_rec RECORD;
  stat_value numeric;
  profile_rec RECORD;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = p_badge_id) THEN
    RETURN false;
  END IF;

  SELECT * INTO badge_rec FROM badges WHERE id = p_badge_id;
  IF NOT FOUND OR badge_rec.requirement_type IS NULL OR badge_rec.requirement_value IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO profile_rec FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;

  CASE badge_rec.requirement_type
    WHEN 'checkins' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id;
    WHEN 'workouts', 'combat_workouts', 'run_workouts' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND workout = true;
    WHEN 'cold_shower', 'cold_showers' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND cold_shower = true;
    WHEN 'healthy_food' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND healthy_food = true;
    WHEN 'protein' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND protein_intake = true;
    WHEN 'hydration' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND hydration_liters >= 3;
    WHEN 'no_phone_morning' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND no_phone_morning = true;
    WHEN 'no_phone_evening' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND no_phone_evening = true;
    WHEN 'reading' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND reading = true;
    WHEN 'battles_won' THEN
      SELECT count(*) INTO stat_value FROM battles WHERE winner_id = p_user_id;
    WHEN 'referrals' THEN
      SELECT count(*) INTO stat_value FROM referrals WHERE referrer_id = p_user_id;
    WHEN 'double_workout' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND extra_workout = true;
    WHEN 'meditation', 'meditation_streak' THEN
      SELECT (SELECT count(*) FROM daily_checkins WHERE user_id = p_user_id AND meditation_morning = true)
           + (SELECT count(*) FROM daily_checkins WHERE user_id = p_user_id AND meditation_evening = true)
      INTO stat_value;
    WHEN 'proofs' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND proof_photo_url IS NOT NULL;
    WHEN 'perfect_day' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins
      WHERE user_id = p_user_id AND workout = true AND cold_shower = true
        AND healthy_food = true AND protein_intake = true AND hydration_liters >= 3
        AND reading = true AND no_phone_morning = true AND no_phone_evening = true;
    WHEN 'elite_member' THEN
      stat_value := CASE WHEN profile_rec.is_elite THEN 1 ELSE 0 END;
    WHEN 'xp', 'total_xp' THEN
      stat_value := profile_rec.xp;
    WHEN 'level' THEN
      stat_value := profile_rec.level;
    WHEN 'streak' THEN
      stat_value := profile_rec.longest_streak;

    -- ============ NEW TYPES ============
    WHEN 'personal_streak' THEN
      stat_value := profile_rec.longest_streak;

    WHEN 'phoenix_recovery' THEN
      IF profile_rec.longest_streak >= 30
         AND profile_rec.streak >= 30
         AND profile_rec.longest_streak > profile_rec.streak THEN
        stat_value := 1;
      ELSE
        stat_value := 0;
      END IF;

    WHEN 'apex_reached' THEN
      stat_value := CASE WHEN profile_rec.status_tier IN ('apex','legend') THEN 1 ELSE 0 END;

    WHEN 'legend_reached' THEN
      stat_value := CASE WHEN profile_rec.status_tier = 'legend' OR profile_rec.legend_pinned THEN 1 ELSE 0 END;

    WHEN 'apex_founding' THEN
      stat_value := CASE
        WHEN profile_rec.is_apex_subscriber = true
         AND profile_rec.apex_subscription_started_at IS NOT NULL THEN 1
        ELSE 0
      END;

    WHEN 'apex_held_days' THEN
      IF profile_rec.status_tier IN ('apex','legend')
         AND profile_rec.apex_subscription_started_at IS NOT NULL THEN
        stat_value := EXTRACT(EPOCH FROM (now() - profile_rec.apex_subscription_started_at)) / 86400;
      ELSE
        stat_value := 0;
      END IF;

    WHEN 'legend_held_days' THEN
      IF (profile_rec.status_tier = 'legend' OR profile_rec.legend_pinned)
         AND profile_rec.apex_subscription_started_at IS NOT NULL THEN
        stat_value := EXTRACT(EPOCH FROM (now() - profile_rec.apex_subscription_started_at)) / 86400;
      ELSE
        stat_value := 0;
      END IF;

    WHEN 'tribe_battles_won' THEN
      SELECT count(DISTINCT tb.id) INTO stat_value
      FROM tribe_battles tb
      JOIN tribe_members tm ON tm.tribe_id = tb.winner_tribe_id
      WHERE tb.status = 'completed'
        AND tb.winner_tribe_id IS NOT NULL
        AND tm.user_id = p_user_id
        AND tm.status = 'active';

    WHEN 'tribe_collective_streak' THEN
      SELECT COALESCE(MAX(min_streak), 0) INTO stat_value
      FROM (
        SELECT tm_outer.tribe_id,
               MIN(p.streak) AS min_streak
        FROM tribe_members tm_outer
        JOIN tribe_members tm_all ON tm_all.tribe_id = tm_outer.tribe_id AND tm_all.status = 'active'
        JOIN profiles p ON p.user_id = tm_all.user_id
        WHERE tm_outer.user_id = p_user_id AND tm_outer.status = 'active'
        GROUP BY tm_outer.tribe_id
      ) sub;

    WHEN 'tribe_founder_streak' THEN
      SELECT COALESCE(MAX(min_streak), 0) INTO stat_value
      FROM (
        SELECT t.id AS tribe_id,
               MIN(p.streak) AS min_streak
        FROM tribes t
        JOIN tribe_members tm ON tm.tribe_id = t.id AND tm.status = 'active'
        JOIN profiles p ON p.user_id = tm.user_id
        WHERE t.owner_id = p_user_id
        GROUP BY t.id
      ) sub;

    ELSE
      RETURN false;
  END CASE;

  IF stat_value >= badge_rec.requirement_value THEN
    INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, p_badge_id)
    ON CONFLICT DO NOTHING;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


--
-- Name: calculate_rank_score(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_rank_score(p_user_id uuid) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  xp_score numeric := 0;
  streak_score numeric := 0;
  consistency_score numeric := 0;
  trust numeric := 1.0;
  total_score numeric;
  avg_xp_7d numeric;
  max_xp_7d numeric;
  completed_30 integer;
  current_streak integer;
  p_trust numeric;
BEGIN
  SELECT streak, profiles.trust_multiplier INTO current_streak, p_trust
  FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  trust := COALESCE(p_trust, 1.0);

  SELECT COALESCE(AVG(xp_earned), 0) INTO avg_xp_7d
  FROM daily_checkins
  WHERE user_id = p_user_id AND checked_in_at >= now() - interval '7 days';
  
  SELECT COALESCE(MAX(sub.avg_xp), 1) INTO max_xp_7d
  FROM (
    SELECT AVG(xp_earned) as avg_xp
    FROM daily_checkins
    WHERE checked_in_at >= now() - interval '7 days'
    GROUP BY user_id
  ) sub;
  
  xp_score := LEAST(100, (avg_xp_7d / GREATEST(max_xp_7d, 1)) * 100);
  streak_score := LEAST(100, 25 * ln(current_streak + 1));

  SELECT count(DISTINCT date(checked_in_at)) INTO completed_30
  FROM daily_checkins
  WHERE user_id = p_user_id AND checked_in_at >= now() - interval '30 days';
  
  consistency_score := (completed_30::numeric / 30.0) * 100;
  total_score := (0.25 * xp_score + 0.20 * streak_score + 0.55 * consistency_score) * trust;
  
  UPDATE profiles
  SET rank_score = ROUND(total_score, 2), rank_score_updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN ROUND(total_score, 2);
END;
$$;


--
-- Name: can_create_tribe(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_create_tribe(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: check_commentator_badge(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_commentator_badge() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: check_influencer_badge(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_influencer_badge() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: check_viral_badge(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_viral_badge() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: check_voting_threshold(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_voting_threshold() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  battle RECORD;
  vote_count integer;
  challenger_votes integer;
  opponent_votes integer;
  winner uuid;
BEGIN
  -- Get the battle
  SELECT * INTO battle FROM battles WHERE id = NEW.battle_id AND status = 'voting';
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Count total votes
  SELECT count(*) INTO vote_count FROM battle_votes WHERE battle_id = NEW.battle_id;

  -- Resolve if 3+ votes
  IF vote_count >= 3 THEN
    SELECT count(*) INTO challenger_votes FROM battle_votes
      WHERE battle_id = NEW.battle_id AND voted_for = battle.challenger_id;
    SELECT count(*) INTO opponent_votes FROM battle_votes
      WHERE battle_id = NEW.battle_id AND voted_for = battle.opponent_id;

    winner := NULL;
    IF challenger_votes > opponent_votes THEN
      winner := battle.challenger_id;
    ELSIF opponent_votes > challenger_votes THEN
      winner := battle.opponent_id;
    END IF;

    UPDATE battles SET status = 'completed', winner_id = winner WHERE id = NEW.battle_id;

    IF winner IS NOT NULL THEN
      PERFORM update_status_tier(winner);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: claim_paused_tribe(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_paused_tribe(p_tribe_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_paused boolean;
  v_old_owner uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT is_paused, owner_id INTO v_paused, v_old_owner
  FROM tribes WHERE id = p_tribe_id;
  IF v_paused IS NULL THEN RAISE EXCEPTION 'Tribe not found'; END IF;
  IF NOT v_paused THEN RAISE EXCEPTION 'This tribe is not paused'; END IF;

  IF NOT public.is_valid_tribe_owner(v_user) THEN
    RAISE EXCEPTION 'Only Apex members can claim a paused tribe';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tribe_members
    WHERE tribe_id = p_tribe_id AND user_id = v_user AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You must be an active member of the tribe to claim it';
  END IF;

  -- Demote the old owner row to admin (if still present)
  UPDATE tribe_members SET role = 'admin'
  WHERE tribe_id = p_tribe_id AND user_id = v_old_owner AND role = 'owner';

  -- Promote the new owner
  UPDATE tribe_members SET role = 'owner'
  WHERE tribe_id = p_tribe_id AND user_id = v_user;

  -- Reassign tribe ownership and resume
  UPDATE tribes
  SET owner_id = v_user,
      is_paused = false,
      paused_at = NULL,
      paused_reason = NULL,
      updated_at = now()
  WHERE id = p_tribe_id;
END;
$$;


--
-- Name: claim_referral(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_referral(p_referrer_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_referrer_id uuid;
  v_existing_ref uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_referrer_code IS NULL OR length(trim(p_referrer_code)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'empty_code');
  END IF;

  SELECT user_id INTO v_referrer_id
  FROM profiles
  WHERE referral_code = trim(p_referrer_code)
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code');
  END IF;

  IF v_referrer_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'self_referral');
  END IF;

  SELECT referred_by INTO v_existing_ref FROM profiles WHERE user_id = v_user_id;
  IF v_existing_ref IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_referred');
  END IF;

  IF EXISTS (SELECT 1 FROM referrals WHERE referred_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate');
  END IF;

  UPDATE profiles SET referred_by = v_referrer_id, updated_at = now()
  WHERE user_id = v_user_id;

  INSERT INTO referrals (referrer_id, referred_id, converted)
  VALUES (v_referrer_id, v_user_id, false)
  ON CONFLICT (referred_id) DO NOTHING;

  UPDATE profiles SET xp = xp + 50, updated_at = now()
  WHERE user_id = v_referrer_id;

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id);
END;
$$;


--
-- Name: complete_coach_mission(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_coach_mission(_plan_id uuid, _mission_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_plan record;
  v_mission jsonb;
  v_xp integer := 0;
  v_already boolean;
  v_new_xp integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_plan FROM public.coach_daily_plans WHERE id = _plan_id;
  IF NOT FOUND OR v_plan.user_id <> v_user THEN
    RETURN jsonb_build_object('error', 'plan_not_found');
  END IF;

  SELECT m INTO v_mission
  FROM jsonb_array_elements(v_plan.missions) m
  WHERE m->>'id' = _mission_id
  LIMIT 1;

  IF v_mission IS NULL THEN
    RETURN jsonb_build_object('error', 'mission_not_found');
  END IF;

  v_xp := COALESCE((v_mission->>'xp')::int, 15);

  SELECT EXISTS(
    SELECT 1 FROM public.coach_mission_logs
    WHERE daily_plan_id = _plan_id AND mission_id = _mission_id
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('error', 'already_completed');
  END IF;

  INSERT INTO public.coach_mission_logs(user_id, daily_plan_id, mission_id, xp_awarded)
  VALUES (v_user, _plan_id, _mission_id, v_xp);

  UPDATE public.profiles
  SET xp = xp + v_xp,
      updated_at = now()
  WHERE user_id = v_user
  RETURNING xp INTO v_new_xp;

  RETURN jsonb_build_object(
    'ok', true,
    'xp_awarded', v_xp,
    'new_xp', v_new_xp
  );
END;
$$;


--
-- Name: create_legend_invite(text, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_legend_invite(p_code text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_code text;
  v_invite legend_invites;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'forbidden');
  END IF;

  v_code := COALESCE(NULLIF(trim(p_code), ''), upper(encode(gen_random_bytes(6), 'hex')));

  IF length(v_code) < 4 OR length(v_code) > 40 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code_length');
  END IF;

  INSERT INTO legend_invites (code, created_by, expires_at, note)
  VALUES (v_code, auth.uid(), p_expires_at, p_note)
  RETURNING * INTO v_invite;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_invite.id,
    'code', v_invite.code,
    'expires_at', v_invite.expires_at
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'reason', 'code_taken');
END;
$$;


--
-- Name: create_tribe(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_tribe(p_name text, p_description text DEFAULT NULL::text, p_visibility text DEFAULT 'public'::text, p_cover_url text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

  IF EXISTS (SELECT 1 FROM tribes WHERE lower(name) = lower(v_clean_name)) THEN
    RAISE EXCEPTION 'Tribe name already taken — try another';
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


--
-- Name: create_tribe_battle(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_tribe_battle(p_challenger_tribe_id uuid, p_opponent_tribe_id uuid, p_duration_days integer DEFAULT 7) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_challenger_owner uuid;
  v_opponent_owner uuid;
  v_challenger_members int;
  v_opponent_members int;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_challenger_tribe_id = p_opponent_tribe_id THEN
    RAISE EXCEPTION 'Cannot challenge your own tribe';
  END IF;
  IF p_duration_days NOT IN (3,7,14) THEN
    RAISE EXCEPTION 'Duration must be 3, 7 or 14 days';
  END IF;

  SELECT owner_id INTO v_challenger_owner FROM tribes WHERE id = p_challenger_tribe_id;
  SELECT owner_id INTO v_opponent_owner FROM tribes WHERE id = p_opponent_tribe_id;

  IF v_challenger_owner IS NULL OR v_opponent_owner IS NULL THEN
    RAISE EXCEPTION 'Tribe not found';
  END IF;

  IF v_challenger_owner <> v_user THEN
    RAISE EXCEPTION 'Only the tribe owner can challenge';
  END IF;

  SELECT count(*) INTO v_challenger_members FROM tribe_members
    WHERE tribe_id = p_challenger_tribe_id AND status = 'active';
  SELECT count(*) INTO v_opponent_members FROM tribe_members
    WHERE tribe_id = p_opponent_tribe_id AND status = 'active';

  IF v_challenger_members < 2 OR v_opponent_members < 2 THEN
    RAISE EXCEPTION 'Both tribes need at least 2 active members';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tribe_battles
    WHERE status IN ('pending','active')
      AND (
        (challenger_tribe_id = p_challenger_tribe_id AND opponent_tribe_id = p_opponent_tribe_id)
        OR (challenger_tribe_id = p_opponent_tribe_id AND opponent_tribe_id = p_challenger_tribe_id)
      )
  ) THEN
    RAISE EXCEPTION 'There is already an active or pending battle between these tribes';
  END IF;

  INSERT INTO tribe_battles (
    challenger_tribe_id, opponent_tribe_id,
    challenger_owner_id, opponent_owner_id,
    duration_days, status
  ) VALUES (
    p_challenger_tribe_id, p_opponent_tribe_id,
    v_challenger_owner, v_opponent_owner,
    p_duration_days, 'pending'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


--
-- Name: delete_chat_memory(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_chat_memory(_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  DELETE FROM public.coach_chat_memory WHERE id = _id AND user_id = uid;
  RETURN FOUND;
END;
$$;


--
-- Name: delete_tribe(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_tribe(p_tribe_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: enforce_chat_memory_cap(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_chat_memory_cap() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.coach_chat_memory
  WHERE id IN (
    SELECT id FROM public.coach_chat_memory
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    OFFSET 30
  );
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: leaderboard_seasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leaderboard_seasons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    status public.leaderboard_season_status DEFAULT 'active'::public.leaderboard_season_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ensure_active_leaderboard_season(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_active_leaderboard_season() RETURNS public.leaderboard_seasons
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  active_season public.leaderboard_seasons%ROWTYPE;
  month_start TIMESTAMPTZ;
  month_end TIMESTAMPTZ;
BEGIN
  PERFORM public.finalize_expired_leaderboard_seasons();

  SELECT *
  INTO active_season
  FROM public.leaderboard_seasons
  WHERE status = 'active'
    AND starts_at <= now()
    AND ends_at > now()
  ORDER BY starts_at DESC
  LIMIT 1;

  IF active_season.id IS NULL THEN
    month_start := date_trunc('month', now());
    month_end := month_start + interval '1 month';

    INSERT INTO public.leaderboard_seasons (name, starts_at, ends_at, status)
    VALUES (
      to_char(month_start, 'Month YYYY'),
      month_start,
      month_end,
      'active'
    )
    RETURNING * INTO active_season;

    INSERT INTO public.leaderboard_season_baselines (season_id, user_id, baseline_xp)
    SELECT active_season.id, p.user_id, p.xp
    FROM public.profiles p
    ON CONFLICT (season_id, user_id) DO NOTHING;
  END IF;

  RETURN active_season;
END;
$$;


--
-- Name: finalize_expired_leaderboard_seasons(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_expired_leaderboard_seasons() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  season_rec RECORD;
  winner_rec RECORD;
  next_season_id UUID;
  champion_badge_id UUID;
  next_month_start TIMESTAMPTZ;
  next_month_end TIMESTAMPTZ;
BEGIN
  SELECT id INTO champion_badge_id
  FROM public.badges
  WHERE requirement_type = 'season_champion'
  ORDER BY created_at ASC
  LIMIT 1;

  FOR season_rec IN
    SELECT *
    FROM public.leaderboard_seasons
    WHERE status = 'active'
      AND ends_at <= now()
    ORDER BY ends_at ASC
  LOOP
    SELECT
      p.user_id,
      p.username,
      GREATEST(p.xp - COALESCE(b.baseline_xp, p.xp), 0) AS season_points
    INTO winner_rec
    FROM public.profiles p
    LEFT JOIN public.leaderboard_season_baselines b
      ON b.season_id = season_rec.id
     AND b.user_id = p.user_id
    ORDER BY season_points DESC, p.xp DESC, p.created_at ASC
    LIMIT 1;

    IF winner_rec.user_id IS NOT NULL THEN
      INSERT INTO public.leaderboard_champions (season_id, user_id, username_snapshot, season_points, reward_type)
      VALUES (season_rec.id, winner_rec.user_id, winner_rec.username, winner_rec.season_points, 'season_champion')
      ON CONFLICT (season_id, user_id) DO NOTHING;

      IF champion_badge_id IS NOT NULL THEN
        INSERT INTO public.user_badges (user_id, badge_id)
        VALUES (winner_rec.user_id, champion_badge_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    UPDATE public.leaderboard_seasons
    SET status = 'completed'
    WHERE id = season_rec.id;

    -- Next season starts on 1st of the following month
    next_month_start := date_trunc('month', season_rec.ends_at);
    IF next_month_start <= season_rec.ends_at THEN
      next_month_start := date_trunc('month', season_rec.ends_at + interval '1 day');
    END IF;
    next_month_end := next_month_start + interval '1 month';

    INSERT INTO public.leaderboard_seasons (name, starts_at, ends_at, status)
    VALUES (
      to_char(next_month_start, 'Month YYYY'),
      next_month_start,
      next_month_end,
      'active'
    )
    RETURNING id INTO next_season_id;

    INSERT INTO public.leaderboard_season_baselines (season_id, user_id, baseline_xp)
    SELECT next_season_id, p.user_id, p.xp
    FROM public.profiles p
    ON CONFLICT (season_id, user_id) DO NOTHING;
  END LOOP;
END;
$$;


--
-- Name: coach_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    goal text NOT NULL,
    experience text NOT NULL,
    days_per_week integer DEFAULT 4 NOT NULL,
    equipment text,
    body_focus text[] DEFAULT '{}'::text[] NOT NULL,
    constraints text,
    weeks integer DEFAULT 4 NOT NULL,
    plan_json jsonb NOT NULL,
    ai_summary text,
    generated_with text DEFAULT 'openai/gpt-5'::text NOT NULL,
    started_on date DEFAULT ((now() AT TIME ZONE 'UTC'::text))::date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: get_active_coach_program(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_coach_program(_user_id uuid) RETURNS SETOF public.coach_programs
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT *
  FROM public.coach_programs
  WHERE user_id = _user_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
$$;


--
-- Name: get_top_inviters(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_top_inviters(p_limit integer DEFAULT 10) RETURNS TABLE(user_id uuid, username text, avatar_url text, status_tier public.status_tier, converted_count bigint, signup_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    p.user_id,
    p.username,
    p.avatar_url,
    p.status_tier,
    COUNT(r.id) FILTER (WHERE r.converted = true AND r.converted_at >= date_trunc('month', now()))::bigint AS converted_count,
    COUNT(r.id) FILTER (WHERE r.created_at >= date_trunc('month', now()))::bigint AS signup_count
  FROM profiles p
  LEFT JOIN referrals r ON r.referrer_id = p.user_id
  GROUP BY p.user_id, p.username, p.avatar_url, p.status_tier
  HAVING COUNT(r.id) FILTER (WHERE r.created_at >= date_trunc('month', now())) > 0
  ORDER BY converted_count DESC, signup_count DESC
  LIMIT p_limit;
$$;


--
-- Name: get_tribe_leaderboard(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tribe_leaderboard(p_period text DEFAULT 'weekly'::text, p_limit integer DEFAULT 50) RETURNS TABLE(tribe_id uuid, name text, slug text, cover_url text, visibility text, member_count integer, score bigint, rank integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF p_period NOT IN ('weekly','all_time') THEN
    RAISE EXCEPTION 'Invalid period';
  END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT t.id, t.name, t.slug, t.cover_url, t.visibility, t.member_count
    FROM tribes t
    WHERE t.visibility = 'public'
       OR (v_user IS NOT NULL AND (
            t.owner_id = v_user
            OR EXISTS (
              SELECT 1 FROM tribe_members tm
              WHERE tm.tribe_id = t.id AND tm.user_id = v_user AND tm.status = 'active'
            )
          ))
  ),
  scored AS (
    SELECT
      e.id,
      e.name,
      e.slug,
      e.cover_url,
      e.visibility,
      e.member_count,
      CASE
        WHEN p_period = 'weekly' THEN COALESCE((
          SELECT SUM(dc.xp_earned)::bigint
          FROM daily_checkins dc
          WHERE dc.user_id IN (
            SELECT tm.user_id FROM tribe_members tm
            WHERE tm.tribe_id = e.id AND tm.status = 'active'
          )
          AND dc.checked_in_at >= now() - interval '7 days'
        ), 0)
        ELSE COALESCE((
          SELECT SUM(p.xp)::bigint
          FROM profiles p
          WHERE p.user_id IN (
            SELECT tm.user_id FROM tribe_members tm
            WHERE tm.tribe_id = e.id AND tm.status = 'active'
          )
        ), 0)
      END AS score
    FROM eligible e
  )
  SELECT
    s.id AS tribe_id,
    s.name,
    s.slug,
    s.cover_url,
    s.visibility,
    s.member_count,
    s.score,
    (ROW_NUMBER() OVER (ORDER BY s.score DESC, s.member_count DESC, s.name ASC))::int AS rank
  FROM scored s
  ORDER BY s.score DESC, s.member_count DESC, s.name ASC
  LIMIT GREATEST(p_limit, 1);
END;
$$;


--
-- Name: get_user_rank(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_rank(p_user_id uuid) RETURNS TABLE(rank integer, total_users integer, percentile numeric, has_rank boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_total integer;
  v_user_score numeric;
  v_rank integer;
  v_percentile numeric;
BEGIN
  SELECT count(*) INTO v_total FROM profiles WHERE rank_score > 0;
  SELECT rank_score INTO v_user_score FROM profiles WHERE user_id = p_user_id;

  IF v_user_score IS NULL OR v_user_score <= 0 OR v_total = 0 THEN
    rank := COALESCE(v_total, 0) + 1;
    total_users := COALESCE(v_total, 0);
    percentile := 0;
    has_rank := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT rn INTO v_rank
  FROM (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY rank_score DESC) AS rn
    FROM profiles
    WHERE rank_score > 0
  ) r
  WHERE r.user_id = p_user_id;

  -- "Ahead of X%": fraction of OTHER ranked users you beat.
  -- #1 of N => 100%, last => 0%, single user => 100%.
  IF v_total <= 1 THEN
    v_percentile := 100;
  ELSE
    v_percentile := ((v_total - v_rank)::numeric / (v_total - 1)::numeric) * 100;
  END IF;

  rank := v_rank;
  total_users := v_total;
  percentile := ROUND(v_percentile, 2);
  has_rank := true;
  RETURN NEXT;
END;
$$;


--
-- Name: handle_feed_reaction_xp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_feed_reaction_xp() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: handle_kudos_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_kudos_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE feed_posts SET kudos_count = GREATEST(kudos_count - 1, 0) WHERE id = OLD.post_id;
  UPDATE profiles SET xp = GREATEST(xp - 10, 0) WHERE user_id = OLD.receiver_id;
  RETURN OLD;
END;
$$;


--
-- Name: handle_kudos_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_kudos_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: handle_new_profile_leaderboard_baseline(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_profile_leaderboard_baseline() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  active_season_id UUID;
BEGIN
  SELECT id
  INTO active_season_id
  FROM public.leaderboard_seasons
  WHERE status = 'active'
    AND starts_at <= now()
    AND ends_at > now()
  ORDER BY starts_at DESC
  LIMIT 1;

  IF active_season_id IS NOT NULL THEN
    INSERT INTO public.leaderboard_season_baselines (season_id, user_id, baseline_xp)
    VALUES (active_season_id, NEW.user_id, NEW.xp)
    ON CONFLICT (season_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  base_username text;
  final_username text;
BEGIN
  base_username := lower(trim(coalesce(
    NEW.raw_user_meta_data->>'username',
    split_part(coalesce(NEW.email, ''), '@', 1),
    'user'
  )));

  base_username := regexp_replace(base_username, '[^a-z0-9_]+', '_', 'g');
  base_username := trim(both '_' from base_username);

  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user';
  END IF;

  final_username := left(base_username, 20);

  IF final_username IS NULL OR final_username = '' THEN
    final_username := 'user';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE username = final_username
  ) THEN
    final_username := left(base_username, 13) || '_' || substring(NEW.id::text, 1, 6);
  END IF;

  INSERT INTO public.profiles (user_id, username, referral_code, trial_started_at)
  VALUES (
    NEW.id,
    final_username,
    left(final_username || '_' || substring(NEW.id::text, 1, 6), 20),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


--
-- Name: handle_tribe_comment_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_tribe_comment_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tribe_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tribe_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: handle_tribe_kudos_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_tribe_kudos_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE tribe_posts SET kudos_count = GREATEST(kudos_count - 1, 0) WHERE id = OLD.post_id;
  UPDATE profiles SET xp = GREATEST(xp - 10, 0), updated_at = now() WHERE user_id = OLD.receiver_id;
  RETURN OLD;
END;
$$;


--
-- Name: handle_tribe_kudos_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_tribe_kudos_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE tribe_posts SET kudos_count = kudos_count + 1 WHERE id = NEW.post_id;
  UPDATE profiles SET xp = xp + 10, updated_at = now() WHERE user_id = NEW.receiver_id;
  RETURN NEW;
END;
$$;


--
-- Name: handle_tribe_post_reaction(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_tribe_post_reaction() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: has_active_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_active_access(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND (
        is_elite = true
        OR is_apex_subscriber = true
        OR (apex_credits_until IS NOT NULL AND apex_credits_until > now())
        OR (membership_credits_until IS NOT NULL AND membership_credits_until > now())
        OR (referred_by IS NULL AND trial_started_at > now() - interval '7 days')
        OR (referred_by IS NOT NULL AND trial_started_at > now() - interval '14 days')
      )
  );
$$;


--
-- Name: has_premium(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_premium(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = _user_id
      AND (
        p.is_premium = true
        OR p.is_elite = true
        OR p.is_apex_subscriber = true
        OR (p.apex_credits_until IS NOT NULL AND p.apex_credits_until > now())
        OR (p.membership_credits_until IS NOT NULL AND p.membership_credits_until > now())
      )
  );
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: invite_to_tribe(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invite_to_tribe(p_tribe_id uuid, p_invitee_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pending_count int;
  v_invite_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_invitee_id IS NULL OR p_invitee_id = v_user THEN
    RAISE EXCEPTION 'Invalid invitee';
  END IF;

  IF NOT is_tribe_member(p_tribe_id, v_user) THEN
    RAISE EXCEPTION 'Only tribe members can invite';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tribe_members
    WHERE tribe_id = p_tribe_id AND user_id = p_invitee_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'User is already a member';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tribe_invites
    WHERE tribe_id = p_tribe_id AND invitee_id = p_invitee_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'User already invited';
  END IF;

  SELECT count(*) INTO v_pending_count
  FROM tribe_invites
  WHERE tribe_id = p_tribe_id AND status = 'pending';
  IF v_pending_count >= 50 THEN
    RAISE EXCEPTION 'Too many pending invites for this tribe';
  END IF;

  INSERT INTO tribe_invites (tribe_id, inviter_id, invitee_id, status)
  VALUES (p_tribe_id, v_user, p_invitee_id, 'pending')
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$;


--
-- Name: is_tribe_admin(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_tribe_admin(_tribe_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tribe_members
    WHERE tribe_id = _tribe_id
      AND user_id = _user_id
      AND status = 'active'
      AND role IN ('owner','admin')
  );
$$;


--
-- Name: is_tribe_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_tribe_member(_tribe_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tribe_members
    WHERE tribe_id = _tribe_id AND user_id = _user_id AND status = 'active'
  );
$$;


--
-- Name: is_tribe_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_tribe_owner(_tribe_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tribes
    WHERE id = _tribe_id AND owner_id = _user_id
  );
$$;


--
-- Name: is_valid_tribe_owner(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_valid_tribe_owner(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND (
        legend_pinned = true
        OR is_apex_subscriber = true
        OR (apex_credits_until IS NOT NULL AND apex_credits_until > now())
        OR status_tier IN ('apex','legend')
      )
  );
$$;


--
-- Name: join_tribe(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_tribe(p_tribe_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_visibility text;
  v_status text;
  v_count integer;
  v_paused boolean;
  v_active_memberships integer;
  v_is_apex boolean;
  v_cap integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT visibility, member_count, is_paused
  INTO v_visibility, v_count, v_paused
  FROM tribes WHERE id = p_tribe_id;
  IF v_visibility IS NULL THEN RAISE EXCEPTION 'Tribe not found'; END IF;

  IF v_paused THEN
    RAISE EXCEPTION 'This tribe is paused — its founder is no longer Apex';
  END IF;

  IF EXISTS (SELECT 1 FROM tribe_members WHERE tribe_id = p_tribe_id AND user_id = v_user) THEN
    RETURN 'already_member';
  END IF;

  -- 10-member tribe cap (public direct join)
  IF v_visibility = 'public' AND v_count >= 10 THEN
    RAISE EXCEPTION 'Tribe is full (max 10 members)';
  END IF;

  -- Per-user active membership cap
  v_is_apex := public.is_valid_tribe_owner(v_user);
  v_cap := CASE WHEN v_is_apex THEN 3 ELSE 1 END;
  SELECT count(*) INTO v_active_memberships
  FROM tribe_members
  WHERE user_id = v_user AND status = 'active';

  IF v_active_memberships >= v_cap THEN
    IF v_is_apex THEN
      RAISE EXCEPTION 'Apex members can belong to at most 3 tribes — leave one first';
    ELSE
      RAISE EXCEPTION 'You can only belong to 1 tribe at a time — leave your current tribe first, or unlock Apex to join up to 3';
    END IF;
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


--
-- Name: leave_tribe(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.leave_tribe(p_tribe_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: log_habit(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_habit(_habit_id uuid, _date date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_habit public.user_habits%ROWTYPE;
  v_logged_on date := COALESCE(_date, (now() AT TIME ZONE 'UTC')::date);
  v_already uuid;
  v_base_xp int := 8;
  v_level_mult numeric := 1.0;
  v_xp int;
  v_new_streak int;
  v_new_level int;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  IF NOT public.has_premium(v_user) THEN
    RETURN jsonb_build_object('error', 'premium_required');
  END IF;

  SELECT * INTO v_habit FROM public.user_habits
   WHERE id = _habit_id AND user_id = v_user AND archived_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'habit_not_found');
  END IF;

  SELECT id INTO v_already FROM public.user_habit_logs
   WHERE habit_id = _habit_id AND logged_on = v_logged_on;
  IF v_already IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_logged');
  END IF;

  -- Streak logic: consecutive days
  IF v_habit.last_logged_on IS NULL THEN
    v_new_streak := 1;
  ELSIF v_habit.last_logged_on = v_logged_on - INTERVAL '1 day' THEN
    v_new_streak := v_habit.current_streak + 1;
  ELSIF v_habit.last_logged_on = v_logged_on THEN
    v_new_streak := v_habit.current_streak;
  ELSE
    -- Missed day(s) — drop one level (min 1) but keep some streak credit
    v_new_streak := 1;
  END IF;

  -- Level rules
  v_new_level := CASE
    WHEN v_new_streak >= 120 THEN 5
    WHEN v_new_streak >= 60  THEN 4
    WHEN v_new_streak >= 21  THEN 3
    WHEN v_new_streak >= 7   THEN 2
    ELSE 1
  END;

  v_level_mult := CASE v_new_level
    WHEN 1 THEN 1.0
    WHEN 2 THEN 1.25
    WHEN 3 THEN 1.5
    WHEN 4 THEN 1.75
    WHEN 5 THEN 2.0
  END;

  v_xp := GREATEST(5, ROUND(v_base_xp * v_level_mult));

  INSERT INTO public.user_habit_logs (habit_id, user_id, logged_on, xp_awarded)
  VALUES (_habit_id, v_user, v_logged_on, v_xp);

  UPDATE public.user_habits
     SET current_streak = v_new_streak,
         best_streak = GREATEST(best_streak, v_new_streak),
         level = v_new_level,
         last_logged_on = v_logged_on,
         updated_at = now()
   WHERE id = _habit_id;

  UPDATE public.profiles
     SET xp = xp + v_xp,
         updated_at = now()
   WHERE user_id = v_user;

  RETURN jsonb_build_object(
    'ok', true,
    'xp_awarded', v_xp,
    'streak', v_new_streak,
    'level', v_new_level
  );
END;
$$;


--
-- Name: log_preference_signal(text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_preference_signal(_signal_type text, _protocol_id text DEFAULT NULL::text, _value text DEFAULT NULL::text, _metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO public.coach_preference_signals (user_id, signal_type, protocol_id, value, metadata)
  VALUES (uid, _signal_type, _protocol_id, _value, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;


--
-- Name: redeem_legend_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_legend_invite(p_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite legend_invites;
  v_already_legend boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'empty_code');
  END IF;

  SELECT legend_pinned INTO v_already_legend FROM profiles WHERE user_id = v_uid;
  IF COALESCE(v_already_legend, false) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_legend');
  END IF;

  -- Lock the invite row
  SELECT * INTO v_invite
  FROM legend_invites
  WHERE lower(code) = lower(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code');
  END IF;

  IF v_invite.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'code_used');
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'code_expired');
  END IF;

  UPDATE legend_invites
  SET used_by = v_uid, used_at = now()
  WHERE id = v_invite.id;

  UPDATE profiles
  SET legend_pinned = true,
      status_tier = 'legend',
      updated_at = now()
  WHERE user_id = v_uid;

  -- Founding apex auto-grant for legends (existing helper)
  PERFORM auto_grant_founding_apex_to_legends();

  RETURN jsonb_build_object('success', true, 'code', v_invite.code);
END;
$$;


--
-- Name: remove_tribe_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_tribe_member(p_tribe_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_status text;
  v_role text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_tribe_owner(p_tribe_id, v_user) THEN
    RAISE EXCEPTION 'Only the owner can remove members';
  END IF;
  IF p_user_id = v_user THEN
    RAISE EXCEPTION 'Owner cannot remove self';
  END IF;

  SELECT status, role INTO v_status, v_role
  FROM tribe_members
  WHERE tribe_id = p_tribe_id AND user_id = p_user_id;

  IF v_status IS NULL THEN RETURN; END IF;
  IF v_role = 'owner' THEN RAISE EXCEPTION 'Cannot remove the owner'; END IF;

  DELETE FROM tribe_members WHERE tribe_id = p_tribe_id AND user_id = p_user_id;
  IF v_status = 'active' THEN
    UPDATE tribes SET member_count = GREATEST(member_count - 1, 0) WHERE id = p_tribe_id;
  END IF;
END;
$$;


--
-- Name: resolve_tribe_battle(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_tribe_battle(p_battle_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  b RECORD;
  v_end timestamptz;
  v_challenger_score int := 0;
  v_opponent_score int := 0;
  v_winner uuid;
BEGIN
  SELECT * INTO b FROM tribe_battles WHERE id = p_battle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF b.status <> 'active' THEN RETURN; END IF;
  IF b.started_at IS NULL THEN RETURN; END IF;

  v_end := b.started_at + (b.duration_days || ' days')::interval;
  IF v_end > now() THEN RETURN; END IF; -- not over yet

  SELECT COALESCE(SUM(dc.xp_earned), 0) INTO v_challenger_score
  FROM daily_checkins dc
  WHERE dc.user_id IN (
    SELECT user_id FROM tribe_members
    WHERE tribe_id = b.challenger_tribe_id AND status = 'active'
  )
  AND dc.checked_in_at >= b.started_at
  AND dc.checked_in_at <  v_end;

  SELECT COALESCE(SUM(dc.xp_earned), 0) INTO v_opponent_score
  FROM daily_checkins dc
  WHERE dc.user_id IN (
    SELECT user_id FROM tribe_members
    WHERE tribe_id = b.opponent_tribe_id AND status = 'active'
  )
  AND dc.checked_in_at >= b.started_at
  AND dc.checked_in_at <  v_end;

  IF v_challenger_score > v_opponent_score THEN
    v_winner := b.challenger_tribe_id;
  ELSIF v_opponent_score > v_challenger_score THEN
    v_winner := b.opponent_tribe_id;
  ELSE
    v_winner := NULL; -- draw
  END IF;

  UPDATE tribe_battles
  SET status = 'completed',
      ended_at = now(),
      challenger_score = v_challenger_score,
      opponent_score = v_opponent_score,
      winner_tribe_id = v_winner
  WHERE id = p_battle_id;

  IF v_winner IS NOT NULL THEN
    UPDATE profiles
    SET xp = xp + 50, updated_at = now()
    WHERE user_id IN (
      SELECT user_id FROM tribe_members
      WHERE tribe_id = v_winner AND status = 'active'
    );
  END IF;
END;
$$;


--
-- Name: respond_to_battle(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.respond_to_battle(battle_id uuid, accept boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  b RECORD;
  c_xp integer;
  o_xp integer;
BEGIN
  SELECT * INTO b FROM battles WHERE id = battle_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle not found or not pending';
  END IF;

  IF auth.uid() != b.opponent_id THEN
    RAISE EXCEPTION 'Only the opponent can respond';
  END IF;

  IF accept THEN
    -- Get current XP for both players
    SELECT xp INTO c_xp FROM profiles WHERE user_id = b.challenger_id;
    SELECT xp INTO o_xp FROM profiles WHERE user_id = b.opponent_id;
    
    UPDATE battles 
    SET status = 'active', 
        started_at = now(),
        challenger_start_xp = COALESCE(c_xp, 0),
        opponent_start_xp = COALESCE(o_xp, 0)
    WHERE id = battle_id;
  ELSE
    UPDATE battles SET status = 'declined' WHERE id = battle_id;
  END IF;
END;
$$;


--
-- Name: respond_to_tribe_battle(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.respond_to_tribe_battle(p_battle_id uuid, p_accept boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  b RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO b FROM tribe_battles WHERE id = p_battle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF b.status <> 'pending' THEN RAISE EXCEPTION 'Battle is no longer pending'; END IF;
  IF b.opponent_owner_id <> v_user THEN
    RAISE EXCEPTION 'Only the opponent tribe owner can respond';
  END IF;

  IF p_accept THEN
    UPDATE tribe_battles
    SET status = 'active', started_at = now()
    WHERE id = p_battle_id;
  ELSE
    UPDATE tribe_battles
    SET status = 'declined', ended_at = now()
    WHERE id = p_battle_id;
  END IF;
END;
$$;


--
-- Name: respond_to_tribe_invite(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.respond_to_tribe_invite(p_invite_id uuid, p_accept boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_invite RECORD;
  v_count integer;
  v_paused boolean;
  v_active_memberships integer;
  v_is_apex boolean;
  v_cap integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM tribe_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;

  IF v_invite.invitee_id != v_user THEN
    RAISE EXCEPTION 'Only the invitee can respond';
  END IF;

  IF v_invite.status != 'pending' THEN
    RAISE EXCEPTION 'Invite is no longer pending';
  END IF;

  IF p_accept THEN
    SELECT member_count, is_paused INTO v_count, v_paused FROM tribes WHERE id = v_invite.tribe_id;
    IF v_paused THEN
      RAISE EXCEPTION 'This tribe is paused — its founder is no longer Apex';
    END IF;
    IF v_count >= 10 THEN
      RAISE EXCEPTION 'Tribe is full (max 10 members)';
    END IF;

    v_is_apex := public.is_valid_tribe_owner(v_user);
    v_cap := CASE WHEN v_is_apex THEN 3 ELSE 1 END;
    SELECT count(*) INTO v_active_memberships
    FROM tribe_members WHERE user_id = v_user AND status = 'active';
    IF v_active_memberships >= v_cap THEN
      IF v_is_apex THEN
        RAISE EXCEPTION 'Apex members can belong to at most 3 tribes — leave one first';
      ELSE
        RAISE EXCEPTION 'You can only belong to 1 tribe at a time — leave your current tribe first';
      END IF;
    END IF;

    UPDATE tribe_invites
    SET status = 'accepted', responded_at = now()
    WHERE id = p_invite_id;

    IF NOT EXISTS (
      SELECT 1 FROM tribe_members
      WHERE tribe_id = v_invite.tribe_id AND user_id = v_user
    ) THEN
      INSERT INTO tribe_members (tribe_id, user_id, role, status)
      VALUES (v_invite.tribe_id, v_user, 'member', 'active');
      UPDATE tribes SET member_count = member_count + 1
      WHERE id = v_invite.tribe_id;
    ELSE
      UPDATE tribe_members SET status = 'active'
      WHERE tribe_id = v_invite.tribe_id AND user_id = v_user AND status != 'active';
      UPDATE tribes SET member_count = member_count + 1
      WHERE id = v_invite.tribe_id
        AND EXISTS (
          SELECT 1 FROM tribe_members
          WHERE tribe_id = v_invite.tribe_id AND user_id = v_user AND status = 'active'
        );
    END IF;
  ELSE
    UPDATE tribe_invites
    SET status = 'declined', responded_at = now()
    WHERE id = p_invite_id;
  END IF;
END;
$$;


--
-- Name: revoke_tribe_invite(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_tribe_invite(p_invite_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_invite RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM tribe_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_invite.inviter_id != v_user AND NOT is_tribe_owner(v_invite.tribe_id, v_user) THEN
    RAISE EXCEPTION 'Not authorized to revoke';
  END IF;

  IF v_invite.status = 'pending' THEN
    UPDATE tribe_invites
    SET status = 'revoked', responded_at = now()
    WHERE id = p_invite_id;
  END IF;
END;
$$;


--
-- Name: reward_referral_conversion(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reward_referral_conversion(p_user uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_referrer_id uuid;
  v_paid_count integer;
  v_milestones jsonb;
  v_badge_id uuid;
  v_rewards jsonb := '[]'::jsonb;
BEGIN
  SELECT referrer_id INTO v_referrer_id
  FROM referrals
  WHERE referred_id = p_user AND converted = false
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_pending_referral');
  END IF;

  UPDATE referrals
  SET converted = true, converted_at = now(), rewarded = true
  WHERE referred_id = p_user;

  UPDATE profiles
  SET xp = xp + 500,
      referral_count = referral_count + 1,
      updated_at = now()
  WHERE user_id = v_referrer_id;

  SELECT count(*) INTO v_paid_count
  FROM referrals
  WHERE referrer_id = v_referrer_id AND converted = true;

  SELECT COALESCE(referral_milestones_hit, '[]'::jsonb) INTO v_milestones
  FROM profiles WHERE user_id = v_referrer_id;

  IF v_paid_count >= 1 AND NOT (v_milestones ? '1') THEN
    UPDATE profiles SET xp = xp + 250,
      referral_milestones_hit = referral_milestones_hit || '["1"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 1 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    v_rewards := v_rewards || '["first_recruit"]'::jsonb;
  END IF;

  IF v_paid_count >= 3 AND NOT (v_milestones ? '3') THEN
    UPDATE profiles
    SET membership_credits_until = GREATEST(COALESCE(membership_credits_until, now()), now()) + interval '30 days',
        referral_milestones_hit = referral_milestones_hit || '["3"]'::jsonb
    WHERE user_id = v_referrer_id;
    v_rewards := v_rewards || '["1_month_free"]'::jsonb;
  END IF;

  IF v_paid_count >= 5 AND NOT (v_milestones ? '5') THEN
    UPDATE profiles
    SET membership_credits_until = GREATEST(COALESCE(membership_credits_until, now()), now()) + interval '60 days',
        referral_milestones_hit = referral_milestones_hit || '["5"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 5 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    v_rewards := v_rewards || '["2_months_free"]'::jsonb;
  END IF;

  -- 10 referrals → 1 Month Apex Instant (cumulative 30 days)
  IF v_paid_count >= 10 AND NOT (v_milestones ? '10') THEN
    UPDATE profiles
    SET apex_credits_until = GREATEST(COALESCE(apex_credits_until, now()), now()) + interval '30 days',
        is_apex_subscriber = true,
        referral_milestones_hit = referral_milestones_hit || '["10"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 10 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    PERFORM public.update_status_tier(v_referrer_id);
    v_rewards := v_rewards || '["1_month_apex"]'::jsonb;
  END IF;

  IF v_paid_count >= 25 AND NOT (v_milestones ? '25') THEN
    UPDATE profiles
    SET membership_credits_until = now() + interval '100 years',
        referral_milestones_hit = referral_milestones_hit || '["25"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 25 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    v_rewards := v_rewards || '["lifetime"]'::jsonb;
  END IF;

  -- 50 referrals → Founders Circle / permanent Legend pin
  IF v_paid_count >= 50 AND NOT (v_milestones ? '50') THEN
    UPDATE profiles
    SET legend_pinned = true,
        is_apex_subscriber = true,
        apex_subscription_started_at = COALESCE(apex_subscription_started_at, now()),
        referral_milestones_hit = referral_milestones_hit || '["50"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 50 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    PERFORM public.update_status_tier(v_referrer_id);
    v_rewards := v_rewards || '["founders_circle"]'::jsonb;
  END IF;

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id, 'paid_count', v_paid_count, 'rewards', v_rewards);
END;
$$;


--
-- Name: search_tribes(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_tribes(p_query text, p_limit integer DEFAULT 20) RETURNS TABLE(id uuid, name text, slug text, description text, cover_url text, visibility text, member_count integer, owner_id uuid, viewer_status text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_q text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_q := trim(coalesce(p_query, ''));
  IF length(v_q) < 1 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.slug,
    t.description,
    t.cover_url,
    t.visibility,
    t.member_count,
    t.owner_id,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM tribe_members tm
        WHERE tm.tribe_id = t.id AND tm.user_id = v_user AND tm.status = 'active'
      ) THEN 'member'
      WHEN EXISTS (
        SELECT 1 FROM tribe_members tm
        WHERE tm.tribe_id = t.id AND tm.user_id = v_user AND tm.status = 'pending'
      ) THEN 'pending_join'
      WHEN EXISTS (
        SELECT 1 FROM tribe_invites ti
        WHERE ti.tribe_id = t.id AND ti.invitee_id = v_user AND ti.status = 'pending'
      ) THEN 'pending_invite'
      ELSE 'none'
    END AS viewer_status
  FROM tribes t
  WHERE t.name ILIKE '%' || v_q || '%'
  ORDER BY
    (lower(t.name) = lower(v_q)) DESC,
    (lower(t.name) LIKE lower(v_q) || '%') DESC,
    t.member_count DESC,
    t.name ASC
  LIMIT GREATEST(p_limit, 1);
END;
$$;


--
-- Name: set_elite_status(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_elite_status(target_user_id uuid, elite boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id required';
  END IF;

  UPDATE public.profiles
  SET is_elite = elite,
      is_premium = elite OR is_apex_subscriber
                          OR (apex_credits_until IS NOT NULL AND apex_credits_until > now())
                          OR (membership_credits_until IS NOT NULL AND membership_credits_until > now()),
      updated_at = now()
  WHERE user_id = target_user_id;
END;
$$;


--
-- Name: set_tribe_member_role(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_tribe_member_role(p_tribe_id uuid, p_user_id uuid, p_role text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_admin_count integer;
  v_target_status text;
  v_target_role text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_tribe_owner(p_tribe_id, v_user) THEN
    RAISE EXCEPTION 'Only the owner can change roles';
  END IF;
  IF p_role NOT IN ('admin','member') THEN
    RAISE EXCEPTION 'Role must be admin or member';
  END IF;
  IF p_user_id = v_user THEN
    RAISE EXCEPTION 'Owner cannot change own role';
  END IF;

  SELECT status, role INTO v_target_status, v_target_role
  FROM tribe_members
  WHERE tribe_id = p_tribe_id AND user_id = p_user_id;

  IF v_target_status IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this tribe';
  END IF;
  IF v_target_status <> 'active' THEN
    RAISE EXCEPTION 'User is not an active member';
  END IF;
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot change the owner role';
  END IF;

  IF p_role = 'admin' THEN
    SELECT count(*) INTO v_admin_count
    FROM tribe_members
    WHERE tribe_id = p_tribe_id AND role = 'admin' AND status = 'active';
    IF v_admin_count >= 2 THEN
      RAISE EXCEPTION 'This tribe already has the maximum of 2 admins';
    END IF;
  END IF;

  UPDATE tribe_members
  SET role = p_role
  WHERE tribe_id = p_tribe_id AND user_id = p_user_id;
END;
$$;


--
-- Name: submit_battle_proof(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_battle_proof(battle_id uuid, proof_url text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  b RECORD;
BEGIN
  SELECT * INTO b FROM battles WHERE id = battle_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle not found or not active';
  END IF;

  IF auth.uid() = b.challenger_id THEN
    UPDATE battles SET challenger_proof_url = proof_url WHERE id = battle_id;
  ELSIF auth.uid() = b.opponent_id THEN
    UPDATE battles SET opponent_proof_url = proof_url WHERE id = battle_id;
  ELSE
    RAISE EXCEPTION 'Not a participant';
  END IF;
END;
$$;


--
-- Name: sync_tribe_pause_state(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_tribe_pause_state() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.tribes t
  SET is_paused = true,
      paused_at = COALESCE(paused_at, now()),
      paused_reason = 'owner_lost_apex'
  WHERE t.is_paused = false
    AND NOT public.is_valid_tribe_owner(t.owner_id);

  UPDATE public.tribes t
  SET is_paused = false,
      paused_at = NULL,
      paused_reason = NULL
  WHERE t.is_paused = true
    AND public.is_valid_tribe_owner(t.owner_id);
END;
$$;


--
-- Name: trg_reconcile_owned_tribes_pause(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_reconcile_owned_tribes_pause() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_now_valid boolean;
BEGIN
  IF NEW.is_apex_subscriber IS DISTINCT FROM OLD.is_apex_subscriber
     OR NEW.apex_credits_until IS DISTINCT FROM OLD.apex_credits_until
     OR NEW.legend_pinned IS DISTINCT FROM OLD.legend_pinned
     OR NEW.status_tier IS DISTINCT FROM OLD.status_tier THEN

    v_now_valid := public.is_valid_tribe_owner(NEW.user_id);

    IF v_now_valid THEN
      UPDATE public.tribes
      SET is_paused = false, paused_at = NULL, paused_reason = NULL
      WHERE owner_id = NEW.user_id AND is_paused = true;
    ELSE
      UPDATE public.tribes
      SET is_paused = true,
          paused_at = COALESCE(paused_at, now()),
          paused_reason = 'owner_lost_apex'
      WHERE owner_id = NEW.user_id AND is_paused = false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: trg_update_status_after_battle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_update_status_after_battle() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public.update_status_tier(NEW.challenger_id);
    PERFORM public.update_status_tier(NEW.opponent_id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: trg_update_status_after_checkin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_update_status_after_checkin() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.update_status_tier(NEW.user_id);
  RETURN NEW;
END;
$$;


--
-- Name: update_all_status_tiers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_all_status_tiers() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  total_users integer;
  r RECORD;
  percentile numeric;
  new_tier status_tier;
  activity_days integer;
  user_streak integer;
BEGIN
  FOR r IN SELECT user_id FROM profiles LOOP
    PERFORM calculate_rank_score(r.user_id);
  END LOOP;

  UPDATE profiles SET status_tier = 'legend' WHERE legend_pinned = true;

  UPDATE profiles SET status_tier = 'apex'
  WHERE legend_pinned = false
    AND (
      is_apex_subscriber = true
      OR (apex_credits_until IS NOT NULL AND apex_credits_until > now())
    );

  SELECT count(*) INTO total_users FROM profiles WHERE rank_score > 0;
  IF total_users = 0 THEN
    UPDATE profiles
      SET status_tier = 'recruit'
      WHERE rank_score = 0
        AND legend_pinned = false
        AND is_apex_subscriber = false
        AND (apex_credits_until IS NULL OR apex_credits_until <= now());
    RETURN;
  END IF;

  FOR r IN
    SELECT user_id, rank_score, ROW_NUMBER() OVER (ORDER BY rank_score DESC) as rn
    FROM profiles
    WHERE rank_score > 0
      AND legend_pinned = false
      AND is_apex_subscriber = false
      AND (apex_credits_until IS NULL OR apex_credits_until <= now())
  LOOP
    percentile := ((total_users - r.rn)::numeric / total_users::numeric) * 100;

    SELECT count(DISTINCT date(checked_in_at)) INTO activity_days
    FROM daily_checkins
    WHERE user_id = r.user_id AND checked_in_at >= now() - interval '30 days';

    SELECT COALESCE(streak, 0) INTO user_streak FROM profiles WHERE user_id = r.user_id;

    IF percentile >= 99.9 AND activity_days >= 30 AND user_streak >= 30 THEN
      new_tier := 'legend';
    ELSIF percentile >= 90 AND activity_days >= 30 AND user_streak >= 30 THEN
      new_tier := 'apex';
    ELSIF percentile >= 80 OR (activity_days >= 20 AND user_streak >= 21) THEN
      new_tier := 'elite';
    ELSIF percentile >= 70 OR (activity_days >= 15 AND user_streak >= 14) THEN
      new_tier := 'high_performer';
    ELSIF percentile >= 50 AND activity_days >= 7 THEN
      new_tier := 'performer';
    ELSIF percentile >= 25 AND activity_days >= 5 THEN
      new_tier := 'operator';
    ELSE
      new_tier := 'recruit';
    END IF;

    UPDATE profiles SET status_tier = new_tier WHERE user_id = r.user_id;
  END LOOP;

  UPDATE profiles
    SET status_tier = 'recruit'
    WHERE rank_score = 0
      AND legend_pinned = false
      AND is_apex_subscriber = false
      AND (apex_credits_until IS NULL OR apex_credits_until <= now());
END;
$$;


--
-- Name: coach_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    metric text NOT NULL,
    unit text DEFAULT ''::text NOT NULL,
    baseline_value numeric,
    current_value numeric,
    target_value numeric NOT NULL,
    deadline date,
    weekly_milestone numeric,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_goals_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'achieved'::text, 'abandoned'::text]))),
    CONSTRAINT coach_goals_title_check CHECK (((length(title) >= 2) AND (length(title) <= 100)))
);


--
-- Name: update_goal_progress(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_goal_progress(_goal_id uuid, _new_value numeric) RETURNS public.coach_goals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  row_out public.coach_goals;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.coach_goals
     SET current_value = _new_value,
         status = CASE
           WHEN target_value IS NOT NULL
            AND ((target_value >= COALESCE(baseline_value,0) AND _new_value >= target_value)
              OR (target_value < COALESCE(baseline_value,0) AND _new_value <= target_value))
           THEN 'achieved'
           ELSE status
         END,
         updated_at = now()
   WHERE id = _goal_id AND user_id = uid
   RETURNING * INTO row_out;
  RETURN row_out;
END;
$$;


--
-- Name: update_own_profile(text, text, text, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_own_profile(new_username text DEFAULT NULL::text, new_display_name text DEFAULT NULL::text, new_avatar_url text DEFAULT NULL::text, new_featured_badge_id uuid DEFAULT NULL::uuid, clear_featured_badge boolean DEFAULT false) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE profiles
  SET
    username = COALESCE(new_username, username),
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


--
-- Name: update_status_tier(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_status_tier(target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  total_users integer;
  user_rank integer;
  percentile numeric;
  new_tier status_tier;
  activity_days integer;
  user_streak integer;
  user_score numeric;
  is_pinned_legend boolean;
  is_apex_sub boolean;
  apex_credits timestamptz;
BEGIN
  SELECT legend_pinned, is_apex_subscriber, apex_credits_until
    INTO is_pinned_legend, is_apex_sub, apex_credits
    FROM profiles WHERE user_id = target_user_id;

  -- Legend is INVITE-ONLY: only achievable via redeem_legend_invite (sets legend_pinned)
  IF COALESCE(is_pinned_legend, false) THEN
    UPDATE profiles SET status_tier = 'legend' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  PERFORM calculate_rank_score(target_user_id);
  SELECT rank_score INTO user_score FROM profiles WHERE user_id = target_user_id;

  IF COALESCE(is_apex_sub, false) OR (apex_credits IS NOT NULL AND apex_credits > now()) THEN
    UPDATE profiles SET status_tier = 'apex' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  IF user_score IS NULL OR user_score <= 0 THEN
    UPDATE profiles SET status_tier = 'recruit' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  SELECT count(*) INTO total_users FROM profiles WHERE rank_score > 0;
  IF total_users = 0 THEN
    UPDATE profiles SET status_tier = 'recruit' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  SELECT rn INTO user_rank
  FROM (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY rank_score DESC) AS rn
    FROM profiles WHERE rank_score > 0
  ) r WHERE r.user_id = target_user_id;

  percentile := ((total_users - user_rank)::numeric / total_users::numeric) * 100;

  SELECT count(DISTINCT date(checked_in_at)) INTO activity_days
  FROM daily_checkins
  WHERE user_id = target_user_id AND checked_in_at >= now() - interval '30 days';

  SELECT COALESCE(streak, 0) INTO user_streak FROM profiles WHERE user_id = target_user_id;

  -- NOTE: Legend tier intentionally removed from earned thresholds — invite only.
  IF percentile >= 90 AND activity_days >= 30 AND user_streak >= 30 THEN
    new_tier := 'apex';
  ELSIF percentile >= 80 OR (activity_days >= 20 AND user_streak >= 21) THEN
    new_tier := 'elite';
  ELSIF percentile >= 70 OR (activity_days >= 15 AND user_streak >= 14) THEN
    new_tier := 'high_performer';
  ELSIF percentile >= 50 AND activity_days >= 7 THEN
    new_tier := 'performer';
  ELSIF percentile >= 25 AND activity_days >= 5 THEN
    new_tier := 'operator';
  ELSE
    new_tier := 'recruit';
  END IF;

  UPDATE profiles SET status_tier = new_tier WHERE user_id = target_user_id;
END;
$$;


--
-- Name: update_tribe(uuid, text, text, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_tribe(p_tribe_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_visibility text DEFAULT NULL::text, p_cover_url text DEFAULT NULL::text, p_clear_cover boolean DEFAULT false) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_new_name text;
  v_new_slug text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_tribe_owner(p_tribe_id, v_user) THEN
    RAISE EXCEPTION 'Only the owner can edit a tribe';
  END IF;

  IF p_visibility IS NOT NULL AND p_visibility NOT IN ('public','private') THEN
    RAISE EXCEPTION 'Invalid visibility';
  END IF;

  IF p_name IS NOT NULL THEN
    v_new_name := trim(p_name);
    IF length(v_new_name) < 3 OR length(v_new_name) > 40 THEN
      RAISE EXCEPTION 'Name must be 3-40 characters';
    END IF;
    -- Case-insensitive uniqueness check (excluding current tribe)
    IF EXISTS (
      SELECT 1 FROM tribes
      WHERE lower(name) = lower(v_new_name) AND id <> p_tribe_id
    ) THEN
      RAISE EXCEPTION 'Tribe name already taken — try another';
    END IF;
    v_new_slug := regexp_replace(lower(v_new_name), '[^a-z0-9]+', '-', 'g');
    v_new_slug := trim(both '-' from v_new_slug);
    IF v_new_slug = '' THEN v_new_slug := 'tribe-' || substring(p_tribe_id::text, 1, 8); END IF;
  END IF;

  UPDATE tribes
  SET
    name = COALESCE(v_new_name, name),
    slug = COALESCE(v_new_slug, slug),
    description = CASE WHEN p_description IS NOT NULL THEN NULLIF(trim(p_description), '') ELSE description END,
    visibility = COALESCE(p_visibility, visibility),
    cover_url = CASE
      WHEN p_clear_cover THEN NULL
      WHEN p_cover_url IS NOT NULL THEN p_cover_url
      ELSE cover_url
    END,
    updated_at = now()
  WHERE id = p_tribe_id;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: coach_athlete_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_athlete_profile (
    user_id uuid NOT NULL,
    age integer,
    sex text,
    height_cm numeric,
    weight_kg numeric,
    body_fat_pct numeric,
    primary_goal text,
    secondary_goal text,
    target_horizon_weeks integer,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    wake_time time without time zone DEFAULT '07:00:00'::time without time zone NOT NULL,
    sleep_time time without time zone DEFAULT '23:00:00'::time without time zone NOT NULL,
    training_days_pref integer[] DEFAULT '{1,2,4,5}'::integer[] NOT NULL,
    busy_blocks jsonb DEFAULT '[]'::jsonb NOT NULL,
    injuries text[] DEFAULT '{}'::text[] NOT NULL,
    dietary text[] DEFAULT '{}'::text[] NOT NULL,
    equipment text[] DEFAULT '{}'::text[] NOT NULL,
    no_go_protocols text[] DEFAULT '{}'::text[] NOT NULL,
    language_pref text DEFAULT 'en'::text NOT NULL,
    tone_pref text DEFAULT 'calm_mentor'::text NOT NULL,
    preferred_session_length_min integer DEFAULT 45 NOT NULL,
    i_am text,
    onboarded boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_athlete_profile_age_check CHECK (((age IS NULL) OR ((age >= 13) AND (age <= 120)))),
    CONSTRAINT coach_athlete_profile_body_fat_pct_check CHECK (((body_fat_pct IS NULL) OR ((body_fat_pct >= (3)::numeric) AND (body_fat_pct <= (60)::numeric)))),
    CONSTRAINT coach_athlete_profile_height_cm_check CHECK (((height_cm IS NULL) OR ((height_cm >= (100)::numeric) AND (height_cm <= (260)::numeric)))),
    CONSTRAINT coach_athlete_profile_preferred_session_length_min_check CHECK (((preferred_session_length_min >= 10) AND (preferred_session_length_min <= 240))),
    CONSTRAINT coach_athlete_profile_primary_goal_check CHECK ((primary_goal = ANY (ARRAY['all'::text, 'strength'::text, 'hypertrophy'::text, 'endurance'::text, 'fat_loss'::text, 'longevity'::text, 'focus'::text]))),
    CONSTRAINT coach_athlete_profile_secondary_goal_check CHECK (((secondary_goal IS NULL) OR (secondary_goal = ANY (ARRAY['all'::text, 'strength'::text, 'hypertrophy'::text, 'endurance'::text, 'fat_loss'::text, 'longevity'::text, 'focus'::text])))),
    CONSTRAINT coach_athlete_profile_sex_check CHECK ((sex = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_say'::text]))),
    CONSTRAINT coach_athlete_profile_target_horizon_weeks_check CHECK (((target_horizon_weeks IS NULL) OR ((target_horizon_weeks >= 1) AND (target_horizon_weeks <= 104)))),
    CONSTRAINT coach_athlete_profile_tone_pref_check CHECK ((tone_pref = ANY (ARRAY['drill_sergeant'::text, 'calm_mentor'::text, 'scientist'::text, 'hype'::text]))),
    CONSTRAINT coach_athlete_profile_weight_kg_check CHECK (((weight_kg IS NULL) OR ((weight_kg >= (30)::numeric) AND (weight_kg <= (300)::numeric))))
);


--
-- Name: upsert_athlete_profile(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_athlete_profile(_patch jsonb) RETURNS public.coach_athlete_profile
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  row_out public.coach_athlete_profile;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.coach_athlete_profile (user_id) VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.coach_athlete_profile SET
    age = COALESCE((_patch->>'age')::int, age),
    sex = COALESCE(_patch->>'sex', sex),
    height_cm = COALESCE((_patch->>'height_cm')::numeric, height_cm),
    weight_kg = COALESCE((_patch->>'weight_kg')::numeric, weight_kg),
    body_fat_pct = COALESCE((_patch->>'body_fat_pct')::numeric, body_fat_pct),
    primary_goal = COALESCE(_patch->>'primary_goal', primary_goal),
    secondary_goal = COALESCE(_patch->>'secondary_goal', secondary_goal),
    target_horizon_weeks = COALESCE((_patch->>'target_horizon_weeks')::int, target_horizon_weeks),
    timezone = COALESCE(_patch->>'timezone', timezone),
    wake_time = COALESCE((_patch->>'wake_time')::time, wake_time),
    sleep_time = COALESCE((_patch->>'sleep_time')::time, sleep_time),
    training_days_pref = COALESCE(
      CASE WHEN _patch ? 'training_days_pref'
           THEN ARRAY(SELECT (jsonb_array_elements_text(_patch->'training_days_pref'))::int)
      END, training_days_pref),
    busy_blocks = COALESCE(_patch->'busy_blocks', busy_blocks),
    injuries = COALESCE(
      CASE WHEN _patch ? 'injuries'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'injuries'))
      END, injuries),
    dietary = COALESCE(
      CASE WHEN _patch ? 'dietary'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'dietary'))
      END, dietary),
    equipment = COALESCE(
      CASE WHEN _patch ? 'equipment'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'equipment'))
      END, equipment),
    no_go_protocols = COALESCE(
      CASE WHEN _patch ? 'no_go_protocols'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'no_go_protocols'))
      END, no_go_protocols),
    language_pref = COALESCE(_patch->>'language_pref', language_pref),
    tone_pref = COALESCE(_patch->>'tone_pref', tone_pref),
    preferred_session_length_min = COALESCE((_patch->>'preferred_session_length_min')::int, preferred_session_length_min),
    i_am = COALESCE(_patch->>'i_am', i_am),
    onboarded = COALESCE((_patch->>'onboarded')::boolean, onboarded),
    updated_at = now()
  WHERE user_id = uid
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;


--
-- Name: coach_daily_briefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_daily_briefs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    brief_date date NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: upsert_daily_brief(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_daily_brief(_payload jsonb) RETURNS public.coach_daily_briefs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid UUID := auth.uid();
  _row public.coach_daily_briefs;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  INSERT INTO public.coach_daily_briefs(user_id, brief_date, payload)
  VALUES (_uid, CURRENT_DATE, _payload)
  ON CONFLICT (user_id, brief_date)
  DO UPDATE SET payload = EXCLUDED.payload, created_at = now()
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;


--
-- Name: upsert_daily_plan(date, integer, jsonb, text, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_daily_plan(_plan_date date, _readiness_score integer, _readiness_breakdown jsonb, _adjustment text, _headline text, _missions jsonb, _generated_with text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.coach_daily_plans(
    user_id, plan_date, readiness_score, readiness_breakdown,
    adjustment, headline, missions, generated_with
  ) VALUES (
    v_user, _plan_date, _readiness_score, _readiness_breakdown,
    _adjustment, _headline, _missions, _generated_with
  )
  ON CONFLICT (user_id, plan_date)
  DO UPDATE SET
    readiness_score = EXCLUDED.readiness_score,
    readiness_breakdown = EXCLUDED.readiness_breakdown,
    adjustment = EXCLUDED.adjustment,
    headline = EXCLUDED.headline,
    missions = EXCLUDED.missions,
    generated_with = EXCLUDED.generated_with,
    generated_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


--
-- Name: upsert_daily_plan(date, integer, jsonb, text, text, jsonb, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_daily_plan(_plan_date date, _readiness_score integer, _readiness_breakdown jsonb, _adjustment text, _headline text, _missions jsonb, _generated_with text, _rationale text DEFAULT NULL::text, _framework_version text DEFAULT '1.0'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.coach_daily_plans(
    user_id, plan_date, readiness_score, readiness_breakdown,
    adjustment, headline, missions, generated_with, rationale, framework_version
  ) VALUES (
    v_user, _plan_date, _readiness_score, _readiness_breakdown,
    _adjustment, _headline, _missions, _generated_with, _rationale, COALESCE(_framework_version, '1.0')
  )
  ON CONFLICT (user_id, plan_date)
  DO UPDATE SET
    readiness_score = EXCLUDED.readiness_score,
    readiness_breakdown = EXCLUDED.readiness_breakdown,
    adjustment = EXCLUDED.adjustment,
    headline = EXCLUDED.headline,
    missions = EXCLUDED.missions,
    generated_with = EXCLUDED.generated_with,
    rationale = EXCLUDED.rationale,
    framework_version = EXCLUDED.framework_version,
    generated_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


--
-- Name: upsert_goal(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_goal(_patch jsonb) RETURNS public.coach_goals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  goal_id uuid;
  row_out public.coach_goals;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  goal_id := NULLIF(_patch->>'id','')::uuid;

  IF goal_id IS NULL THEN
    INSERT INTO public.coach_goals (
      user_id, title, metric, unit,
      baseline_value, current_value, target_value,
      deadline, weekly_milestone, status
    ) VALUES (
      uid,
      COALESCE(_patch->>'title','New goal'),
      COALESCE(_patch->>'metric','custom'),
      COALESCE(_patch->>'unit',''),
      NULLIF(_patch->>'baseline_value','')::numeric,
      NULLIF(_patch->>'current_value','')::numeric,
      COALESCE((_patch->>'target_value')::numeric, 0),
      NULLIF(_patch->>'deadline','')::date,
      NULLIF(_patch->>'weekly_milestone','')::numeric,
      COALESCE(_patch->>'status','active')
    )
    RETURNING * INTO row_out;
  ELSE
    UPDATE public.coach_goals SET
      title = COALESCE(_patch->>'title', title),
      metric = COALESCE(_patch->>'metric', metric),
      unit = COALESCE(_patch->>'unit', unit),
      baseline_value = COALESCE(NULLIF(_patch->>'baseline_value','')::numeric, baseline_value),
      current_value = COALESCE(NULLIF(_patch->>'current_value','')::numeric, current_value),
      target_value = COALESCE(NULLIF(_patch->>'target_value','')::numeric, target_value),
      deadline = COALESCE(NULLIF(_patch->>'deadline','')::date, deadline),
      weekly_milestone = COALESCE(NULLIF(_patch->>'weekly_milestone','')::numeric, weekly_milestone),
      status = COALESCE(_patch->>'status', status),
      updated_at = now()
    WHERE id = goal_id AND user_id = uid
    RETURNING * INTO row_out;
  END IF;

  RETURN row_out;
END;
$$;


--
-- Name: upsert_performance_snapshot(date, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_performance_snapshot(_snapshot_date date, _performance_score integer, _components jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  rid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.coach_performance_snapshots (user_id, snapshot_date, performance_score, components)
  VALUES (uid, _snapshot_date, GREATEST(0, LEAST(100, _performance_score)), COALESCE(_components, '{}'::jsonb))
  ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
    performance_score = EXCLUDED.performance_score,
    components = EXCLUDED.components
  RETURNING id INTO rid;
  RETURN rid;
END $$;


--
-- Name: upsert_reflection(date, integer, integer, integer, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_reflection(_reflection_date date, _energy_1to5 integer, _rpe_1to10 integer DEFAULT NULL::integer, _sleep_quality_1to5 integer DEFAULT NULL::integer, _mood_1to5 integer DEFAULT NULL::integer, _win text DEFAULT NULL::text, _friction text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  rid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _energy_1to5 < 1 OR _energy_1to5 > 5 THEN RAISE EXCEPTION 'energy out of range'; END IF;

  INSERT INTO public.coach_reflections (
    user_id, reflection_date, energy_1to5, rpe_1to10, sleep_quality_1to5, mood_1to5, win, friction
  ) VALUES (
    uid, _reflection_date, _energy_1to5, _rpe_1to10, _sleep_quality_1to5, _mood_1to5,
    NULLIF(LEFT(COALESCE(_win, ''), 280), ''), NULLIF(LEFT(COALESCE(_friction, ''), 280), '')
  )
  ON CONFLICT (user_id, reflection_date) DO UPDATE SET
    energy_1to5 = EXCLUDED.energy_1to5,
    rpe_1to10 = EXCLUDED.rpe_1to10,
    sleep_quality_1to5 = EXCLUDED.sleep_quality_1to5,
    mood_1to5 = EXCLUDED.mood_1to5,
    win = EXCLUDED.win,
    friction = EXCLUDED.friction
  RETURNING id INTO rid;
  RETURN rid;
END $$;


--
-- Name: upsert_weekly_review(date, integer, text, jsonb, jsonb, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_weekly_review(_week_starts_on date, _performance_score integer, _driver_of_week text, _wins jsonb, _frictions jsonb, _next_week_focus text, _program_tweak text, _generated_with text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  rid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.coach_weekly_reviews (
    user_id, week_starts_on, performance_score, driver_of_week, wins, frictions,
    next_week_focus, program_tweak, generated_with
  ) VALUES (
    uid, _week_starts_on, GREATEST(0, LEAST(100, _performance_score)), _driver_of_week,
    COALESCE(_wins, '[]'::jsonb), COALESCE(_frictions, '[]'::jsonb),
    _next_week_focus, _program_tweak, COALESCE(_generated_with, 'google/gemini-2.5-flash')
  )
  ON CONFLICT (user_id, week_starts_on) DO UPDATE SET
    performance_score = EXCLUDED.performance_score,
    driver_of_week = EXCLUDED.driver_of_week,
    wins = EXCLUDED.wins,
    frictions = EXCLUDED.frictions,
    next_week_focus = EXCLUDED.next_week_focus,
    program_tweak = EXCLUDED.program_tweak,
    generated_with = EXCLUDED.generated_with
  RETURNING id INTO rid;
  RETURN rid;
END $$;


--
-- Name: badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    icon text NOT NULL,
    rarity public.badge_rarity DEFAULT 'common'::public.badge_rarity NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    requirement_type text,
    requirement_value integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: battle_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.battle_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    battle_id uuid NOT NULL,
    voter_id uuid NOT NULL,
    voted_for uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: battles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.battles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenger_id uuid NOT NULL,
    opponent_id uuid NOT NULL,
    status public.battle_status DEFAULT 'pending'::public.battle_status NOT NULL,
    winner_id uuid,
    battle_type text DEFAULT 'xp'::text NOT NULL,
    duration_days integer DEFAULT 7 NOT NULL,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    challenger_score integer DEFAULT 0 NOT NULL,
    opponent_score integer DEFAULT 0 NOT NULL,
    challenger_proof_url text,
    opponent_proof_url text,
    challenger_start_xp integer DEFAULT 0 NOT NULL,
    opponent_start_xp integer DEFAULT 0 NOT NULL
);


--
-- Name: coach_chat_memory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_chat_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fact text NOT NULL,
    source text DEFAULT 'chat'::text NOT NULL,
    confidence numeric DEFAULT 0.7 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_chat_memory_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT coach_chat_memory_fact_check CHECK (((length(fact) >= 3) AND (length(fact) <= 280))),
    CONSTRAINT coach_chat_memory_source_check CHECK ((source = ANY (ARRAY['chat'::text, 'chat-extract'::text, 'reflection'::text, 'manual'::text, 'system'::text])))
);


--
-- Name: coach_daily_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_daily_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_date date NOT NULL,
    readiness_score integer DEFAULT 70 NOT NULL,
    readiness_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    adjustment text DEFAULT 'hold'::text NOT NULL,
    headline text,
    missions jsonb DEFAULT '[]'::jsonb NOT NULL,
    generated_with text DEFAULT 'google/gemini-2.5-flash'::text NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rationale text,
    framework_version text DEFAULT '1.0'::text NOT NULL
);


--
-- Name: coach_mission_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_mission_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    daily_plan_id uuid NOT NULL,
    mission_id text NOT NULL,
    xp_awarded integer DEFAULT 0 NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: coach_nudges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_nudges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    headline text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    seen_at timestamp with time zone
);


--
-- Name: coach_performance_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_performance_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    snapshot_date date NOT NULL,
    performance_score integer DEFAULT 0 NOT NULL,
    components jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: coach_preference_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_preference_signals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    signal_type text NOT NULL,
    protocol_id text,
    value text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_preference_signals_signal_type_check CHECK ((signal_type = ANY (ARRAY['skipped_protocol'::text, 'completed_protocol'::text, 'tone_feedback'::text, 'language_used'::text, 'preferred_time_of_day'::text, 'manual_blacklist'::text, 'manual_whitelist'::text])))
);


--
-- Name: coach_program_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_program_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    program_id uuid NOT NULL,
    week integer NOT NULL,
    day_index integer NOT NULL,
    completed boolean DEFAULT true NOT NULL,
    perceived_rpe integer,
    notes text,
    logged_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_program_logs_day_index_check CHECK (((day_index >= 0) AND (day_index <= 6))),
    CONSTRAINT coach_program_logs_perceived_rpe_check CHECK (((perceived_rpe >= 1) AND (perceived_rpe <= 10)))
);


--
-- Name: coach_reflections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_reflections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    reflection_date date NOT NULL,
    energy_1to5 integer NOT NULL,
    rpe_1to10 integer,
    sleep_quality_1to5 integer,
    mood_1to5 integer,
    win text,
    friction text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_reflections_energy_1to5_check CHECK (((energy_1to5 >= 1) AND (energy_1to5 <= 5))),
    CONSTRAINT coach_reflections_mood_1to5_check CHECK (((mood_1to5 >= 1) AND (mood_1to5 <= 5))),
    CONSTRAINT coach_reflections_rpe_1to10_check CHECK (((rpe_1to10 >= 1) AND (rpe_1to10 <= 10))),
    CONSTRAINT coach_reflections_sleep_quality_1to5_check CHECK (((sleep_quality_1to5 >= 1) AND (sleep_quality_1to5 <= 5)))
);


--
-- Name: coach_weekly_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_weekly_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    week_starts_on date NOT NULL,
    performance_score integer DEFAULT 0 NOT NULL,
    driver_of_week text,
    wins jsonb DEFAULT '[]'::jsonb NOT NULL,
    frictions jsonb DEFAULT '[]'::jsonb NOT NULL,
    next_week_focus text,
    program_tweak text,
    generated_with text DEFAULT 'google/gemini-2.5-flash'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    seen_at timestamp with time zone
);


--
-- Name: content_moderations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_moderations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_type text NOT NULL,
    content_id uuid,
    image_url text,
    text_content text,
    is_safe boolean NOT NULL,
    categories text[] DEFAULT '{}'::text[] NOT NULL,
    confidence numeric DEFAULT 0 NOT NULL,
    reason text,
    action text NOT NULL,
    model text DEFAULT 'google/gemini-2.5-flash'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    severity text,
    cache_hit boolean DEFAULT false NOT NULL,
    latency_ms integer,
    CONSTRAINT content_moderations_action_check CHECK ((action = ANY (ARRAY['allow'::text, 'flag'::text, 'block'::text]))),
    CONSTRAINT content_moderations_content_type_check CHECK ((content_type = ANY (ARRAY['proof'::text, 'feed_post'::text])))
);


--
-- Name: daily_checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_checkins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    sleep_hours numeric(3,1) DEFAULT 0 NOT NULL,
    workout boolean DEFAULT false NOT NULL,
    extra_workout boolean DEFAULT false NOT NULL,
    cold_shower boolean DEFAULT false NOT NULL,
    healthy_food boolean DEFAULT false NOT NULL,
    protein_intake boolean DEFAULT false NOT NULL,
    meditation_morning boolean DEFAULT false NOT NULL,
    meditation_evening boolean DEFAULT false NOT NULL,
    hydration_liters numeric(3,1) DEFAULT 0 NOT NULL,
    no_phone_morning boolean DEFAULT false NOT NULL,
    no_phone_evening boolean DEFAULT false NOT NULL,
    proof_photo_url text,
    xp_earned integer DEFAULT 0 NOT NULL,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reading boolean DEFAULT false NOT NULL,
    journal_entry text
);


--
-- Name: direct_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.direct_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    content text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: feed_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_id uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: feed_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    content text,
    image_url text,
    likes_count integer DEFAULT 0 NOT NULL,
    comments_count integer DEFAULT 0 NOT NULL,
    reported boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    video_url text,
    kudos_count integer DEFAULT 0 NOT NULL
);


--
-- Name: feed_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reaction_type text DEFAULT 'fire'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: friendships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friendships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid NOT NULL,
    addressee_id uuid NOT NULL,
    status public.friendship_status DEFAULT 'pending'::public.friendship_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kudos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kudos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    giver_id uuid NOT NULL,
    post_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: leaderboard_champions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leaderboard_champions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    season_id uuid NOT NULL,
    user_id uuid NOT NULL,
    username_snapshot text,
    season_points integer DEFAULT 0 NOT NULL,
    reward_type text DEFAULT 'season_champion'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: leaderboard_season_baselines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leaderboard_season_baselines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    season_id uuid NOT NULL,
    user_id uuid NOT NULL,
    baseline_xp integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: legend_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legend_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    created_by uuid NOT NULL,
    note text,
    expires_at timestamp with time zone,
    used_by uuid,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: moderation_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderation_cache (
    image_hash text NOT NULL,
    action text NOT NULL,
    categories text[] DEFAULT '{}'::text[] NOT NULL,
    confidence numeric DEFAULT 0 NOT NULL,
    severity text,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: moderation_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderation_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_type text NOT NULL,
    content_id uuid,
    image_url text,
    text_content text,
    user_id uuid NOT NULL,
    ai_action text NOT NULL,
    ai_confidence numeric DEFAULT 0 NOT NULL,
    ai_categories text[] DEFAULT '{}'::text[] NOT NULL,
    ai_reason text,
    severity text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    username text NOT NULL,
    display_name text,
    avatar_url text,
    xp integer DEFAULT 0 NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    streak integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    status_tier public.status_tier DEFAULT 'normal'::public.status_tier NOT NULL,
    is_elite boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    referral_code text,
    referred_by uuid,
    referral_count integer DEFAULT 0 NOT NULL,
    featured_badge_id uuid,
    rank_score numeric DEFAULT 0 NOT NULL,
    trust_multiplier numeric DEFAULT 1.0 NOT NULL,
    rank_score_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    trial_started_at timestamp with time zone DEFAULT now() NOT NULL,
    last_rank_snapshot jsonb,
    membership_credits_until timestamp with time zone,
    referral_milestones_hit jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_apex_subscriber boolean DEFAULT false NOT NULL,
    apex_subscription_started_at timestamp with time zone,
    apex_credits_until timestamp with time zone,
    legend_pinned boolean DEFAULT false NOT NULL,
    is_premium boolean DEFAULT false NOT NULL
);


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    platform text DEFAULT 'unknown'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_id uuid NOT NULL,
    referred_id uuid NOT NULL,
    rewarded boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    converted boolean DEFAULT false NOT NULL,
    converted_at timestamp with time zone
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    post_id uuid,
    reason text NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tribe_battles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tribe_battles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenger_tribe_id uuid NOT NULL,
    opponent_tribe_id uuid NOT NULL,
    challenger_owner_id uuid NOT NULL,
    opponent_owner_id uuid NOT NULL,
    status public.tribe_battle_status DEFAULT 'pending'::public.tribe_battle_status NOT NULL,
    duration_days integer DEFAULT 7 NOT NULL,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    challenger_score integer DEFAULT 0 NOT NULL,
    opponent_score integer DEFAULT 0 NOT NULL,
    winner_tribe_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tribe_battles_check CHECK ((challenger_tribe_id <> opponent_tribe_id)),
    CONSTRAINT tribe_battles_duration_days_check CHECK ((duration_days = ANY (ARRAY[3, 7, 14])))
);


--
-- Name: tribe_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tribe_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tribe_id uuid NOT NULL,
    inviter_id uuid NOT NULL,
    invitee_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone
);


--
-- Name: tribe_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tribe_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tribe_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tribe_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text]))),
    CONSTRAINT tribe_members_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text, 'banned'::text])))
);


--
-- Name: tribe_post_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tribe_post_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    parent_id uuid,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tribe_post_kudos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tribe_post_kudos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    giver_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tribe_post_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tribe_post_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tribe_post_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tribe_post_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    reason text NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tribe_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tribe_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tribe_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text,
    image_url text,
    likes_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    video_url text,
    comments_count integer DEFAULT 0 NOT NULL,
    kudos_count integer DEFAULT 0 NOT NULL,
    reported boolean DEFAULT false NOT NULL
);


--
-- Name: tribes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tribes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    cover_url text,
    visibility text DEFAULT 'public'::text NOT NULL,
    member_count integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_paused boolean DEFAULT false NOT NULL,
    paused_at timestamp with time zone,
    paused_reason text,
    CONSTRAINT tribes_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'private'::text])))
);


--
-- Name: user_badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    badge_id uuid NOT NULL,
    earned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_habit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_habit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    habit_id uuid NOT NULL,
    user_id uuid NOT NULL,
    logged_on date NOT NULL,
    xp_awarded integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_habits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_habits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    protocol_id text NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    current_streak integer DEFAULT 0 NOT NULL,
    best_streak integer DEFAULT 0 NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    last_logged_on date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);


--
-- Name: vault_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vault_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    subtitle text,
    summary text NOT NULL,
    evidence_tier text NOT NULL,
    read_time_min integer DEFAULT 4 NOT NULL,
    protocol jsonb DEFAULT '{}'::jsonb NOT NULL,
    benefits text[] DEFAULT '{}'::text[] NOT NULL,
    risks text[] DEFAULT '{}'::text[] NOT NULL,
    body_md text NOT NULL,
    references_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lesson_number integer,
    why_it_matters text,
    try_today text[] DEFAULT '{}'::text[] NOT NULL,
    key_takeaways text[] DEFAULT '{}'::text[] NOT NULL,
    quiz jsonb DEFAULT '[]'::jsonb NOT NULL,
    course_role text DEFAULT 'protocol'::text NOT NULL,
    CONSTRAINT vault_articles_category_id_check CHECK ((category_id = ANY (ARRAY['recipes'::text, 'training'::text, 'recovery'::text, 'mind'::text, 'nervous-system'::text]))),
    CONSTRAINT vault_articles_course_role_chk CHECK ((course_role = ANY (ARRAY['foundations'::text, 'protocol'::text, 'recap'::text]))),
    CONSTRAINT vault_articles_evidence_tier_check CHECK ((evidence_tier = ANY (ARRAY['strong'::text, 'promising'::text, 'speculative'::text])))
);


--
-- Name: vault_lesson_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vault_lesson_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    article_id uuid NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    quiz_score integer
);


--
-- Name: weekly_briefings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_briefings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    week_start date NOT NULL,
    week_end date NOT NULL,
    headline text NOT NULL,
    summary_md text NOT NULL,
    key_insights jsonb DEFAULT '[]'::jsonb NOT NULL,
    next_week_protocol jsonb DEFAULT '[]'::jsonb NOT NULL,
    stats_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    viewed_at timestamp with time zone
);


--
-- Data for Name: badges; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.badges (id, name, description, icon, rarity, category, requirement_type, requirement_value, created_at) FROM stdin;
62ac55a5-c165-4bf2-acba-b52c762ce247	30-Day Streak	Maintain a 30-day streak	💎	epic	streak	streak	30	2026-03-22 09:42:41.565285+00
9e8f39b0-8b25-4308-bd9a-06834f339d05	Founder	Early adopter of The W Tracker	⭐	legendary	special	\N	\N	2026-03-22 09:42:41.565285+00
93bda98c-5deb-4cbf-9c7e-e63fa3818beb	Spring 26	Active during Spring 2026	🌸	rare	seasonal	\N	\N	2026-03-22 09:42:41.565285+00
f4b609e0-142a-40d6-8dd5-d63f5c653336	Double Down	Complete 2 workouts in one day	💪	rare	discipline	double_workout	1	2026-03-22 09:42:41.565285+00
d28f553a-1d7f-4dc6-9ee0-3f2781a2a8fc	Gladiator	Win 5 battles — you're a warrior	🏟️	epic	battles	battles_won	5	2026-03-22 10:06:55.447702+00
b12eea2a-6592-4897-a2bb-fd810e4d0877	Undefeated	Win 10 battles without losing	👑	legendary	battles	battles_won	10	2026-03-22 10:06:55.447702+00
1d46fb68-e233-4708-a24d-73b8c39982e0	Top 10%	Reach the top 10% on the leaderboard	📊	rare	leaderboard	leaderboard_percentile	10	2026-03-22 10:06:55.447702+00
46836f9f-ca30-4716-8b72-67fe92ce51a6	Top 5%	Reach the top 5% — elite territory	🏅	epic	leaderboard	leaderboard_percentile	5	2026-03-22 10:06:55.447702+00
71a129e4-5416-4fce-86cb-299fb44f3825	Top 1%	The top 1%. You are the standard.	💎	legendary	leaderboard	leaderboard_percentile	1	2026-03-22 10:06:55.447702+00
1561eb73-ef9a-45ef-af1c-b8e994ad349c	Iron Mind	14 days of meditation without missing	🧠	epic	discipline	meditation_streak	14	2026-03-22 10:06:55.447702+00
f29fc33b-d5fb-4482-804b-b141ccf42e1b	90-Day Streak	90 days. You are the habit.	🐉	legendary	streak	streak	90	2026-03-22 15:23:07.360472+00
5bcc9035-1d32-48ad-9228-9f49fe9fa9ed	Early Riser	No phone after waking 10 times	🌅	common	discipline	no_phone_morning	10	2026-03-22 15:23:07.360472+00
d24aaeb8-e9cd-4936-a54b-d4056ae59711	Night Owl Discipline	No phone before sleep 10 times	🌙	common	discipline	no_phone_evening	10	2026-03-22 15:23:07.360472+00
3fc68d08-50f9-4b93-a804-8cc12ac4346d	Zen Master	Meditated 50 times total	🧘	epic	discipline	meditation	50	2026-03-22 15:23:07.360472+00
9d4284f0-5229-46d5-b265-036fd762df60	Hydration King	Hit 3L+ water 30 days	💧	rare	discipline	hydration	30	2026-03-22 15:23:07.360472+00
a63ad1dc-4bca-4c38-b257-93df9f7f6a5e	Clean Eater	Healthy food logged 30 days	🥗	rare	discipline	healthy_food	30	2026-03-22 15:23:07.360472+00
2d547cde-9384-4065-a1ca-9402a1d3d6b0	Protein Beast	Hit protein target 20 days	🥩	common	discipline	protein	20	2026-03-22 15:23:07.360472+00
ba895bb8-e2f1-44f4-9039-cceb57b5208b	Gym Rat	Log 50 workouts total	🏋️	rare	sport	workouts	50	2026-03-22 15:23:07.360472+00
d66cf5ed-4153-489d-b150-1d68177c14c6	200 Workouts	200 total workouts. Machine.	💪	legendary	sport	workouts	200	2026-03-22 15:23:07.360472+00
5ed5774e-d458-4378-af41-ba1f77614a7a	Recruiter	Refer your first friend	📣	common	social	referrals	1	2026-03-22 15:23:07.360472+00
684e11e5-50e6-4f22-918a-6f6a7d84226e	Squad Leader	Refer 5 friends	🫂	rare	social	referrals	5	2026-03-22 15:23:07.360472+00
e4322c1b-ff89-4c7b-ba0d-2738c654a8e8	Army Builder	Refer 15 friends	🪖	epic	social	referrals	15	2026-03-22 15:23:07.360472+00
f061abfa-5b60-4a71-94cc-bbb43e2a4e60	First 1K	Earn 1,000 XP total	🎯	common	xp	xp	1000	2026-03-22 15:23:07.360472+00
2633b76b-f8ee-489e-88f5-242a406c9eb8	10K Club	Earn 10,000 XP total	🏅	rare	xp	xp	10000	2026-03-22 15:23:07.360472+00
e33fb4e4-4fb0-410c-b3b3-7a8119513262	100K Legend	Earn 100,000 XP. Mythical.	👑	legendary	xp	xp	100000	2026-03-22 15:23:07.360472+00
a7d4f29c-1bde-472d-abb3-a6106715341e	First Blood	Win your first battle	⚔️	common	battles	battles_won	1	2026-03-22 15:23:07.360472+00
69d6d0fc-b55e-4276-823c-38e732280a56	Warlord	Win 25 battles	🔱	epic	battles	battles_won	25	2026-03-22 15:23:07.360472+00
83dad162-e6e6-4b2c-8a0b-c7c58372d50c	Ice Breaker	First cold shower logged	❄️	common	discipline	cold_shower	1	2026-03-22 15:23:07.360472+00
bc7dda3f-7bed-4b7d-afa4-9f28f73d89e2	Polar Bear	30 cold showers total	🐻‍❄️	rare	discipline	cold_shower	30	2026-03-22 15:23:07.360472+00
7914436f-cce3-40d1-97ed-285f1654f4bf	Frost King	100 cold showers. Inhuman.	🧊	epic	discipline	cold_shower	100	2026-03-22 15:23:07.360472+00
52c572d9-74ae-474d-b74b-e89b48b28495	Level 5	Reach level 5	⭐	common	level	level	5	2026-03-22 15:23:07.360472+00
6e4a3ea1-45d3-419b-80bd-b634ab296a6d	Level 15	Reach level 15	🌟	rare	level	level	15	2026-03-22 15:23:07.360472+00
e06f9759-f9d8-4c15-a3b8-98ae05c04993	Level 30	Reach level 30	💫	epic	level	level	30	2026-03-22 15:23:07.360472+00
6eaa25fc-4fd3-4eb6-8332-56b4cd727bc8	10 Check-ins	Log 10 daily check-ins	📋	common	checkin	checkins	10	2026-03-22 15:23:07.360472+00
b490dbb3-7f16-4788-8d67-ded0d0cbb299	50 Check-ins	50 days logged. Committed.	📝	rare	checkin	checkins	50	2026-03-22 15:23:07.360472+00
4e34e862-19be-4106-950c-e951a02f05a7	100 Check-ins	100 days. Triple digits.	📊	epic	checkin	checkins	100	2026-03-22 15:23:07.360472+00
4f3503ed-e111-42f8-83d7-7f9ae2c4d974	500 Check-ins	500 check-ins. Immortal.	🗓️	legendary	checkin	checkins	500	2026-03-22 15:23:07.360472+00
3591af2a-7cd8-49fe-a709-8b9390a73f06	Kudos Master	Received 10 kudos for creating inspiring and educational content	🏆	legendary	social	total_kudos	10	2026-03-24 09:41:24.047377+00
1dbdbb60-7daf-47d6-a16a-bb30c2885573	Season Champion	Finished #1 in a leaderboard season	🏆	legendary	leaderboard	season_champion	1	2026-03-29 08:31:09.866554+00
4887e592-128c-4c23-99d1-68e420eaa2cb	Commentator	Wrote 50 comments	💬	rare	social	total_comments	50	2026-03-24 09:34:43.445588+00
2fea14a9-c08d-490e-ad8b-6d7a7cced29d	Influencer	Received 50 likes on your posts	👑	epic	social	total_likes	50	2026-03-24 09:33:15.597063+00
49af5c10-88bd-4bf0-bad7-20312970eebe	Elite Member	Join the Elite. Status unlocked.	🔱	epic	status	elite_member	1	2026-03-22 10:06:55.447702+00
d5a799bc-9327-4764-8346-2d123dffd08b	Viral	Got 20 likes on a single post	🔥	epic	social	single_post_likes	20	2026-03-24 09:34:43.445588+00
d67f9825-7282-45d9-b7bf-9996eb132060	XP Machine	Earn 5,000 total XP	🔥	epic	xp	xp	5000	2026-03-22 10:06:55.447702+00
27dbb16c-ae96-4b41-8756-80b3108c6cf3	Cold Warrior	Take 10 cold showers	🧊	epic	discipline	cold_shower	10	2026-03-22 09:42:41.565285+00
8f555bad-e87f-4106-9abd-8235190c01bc	First Spark	Maintain a 3-day streak — the fire is lit	🔥	common	streak	streak	3	2026-03-29 12:31:17.207568+00
5ec14eb4-6bbd-4e80-ab96-7e1f5e617692	Fortnight Force	14-day streak. Two weeks of iron will	💫	rare	streak	streak	14	2026-03-29 12:31:17.207568+00
8d020524-e2ab-4b25-93e9-e08375d85854	60-Day Dynasty	60 days. You are built differently	🏛️	epic	streak	streak	60	2026-03-29 12:31:17.207568+00
7b4be89f-92bb-4976-be9e-e5d5e3f7888d	100-Day Legend	100 consecutive days. Absolutely legendary	🗿	legendary	streak	streak	100	2026-03-29 12:31:17.207568+00
6eb46f5d-67da-4c61-9e20-a467ae277810	Year of Steel	365 days. An entire year of discipline	⭐	legendary	streak	streak	365	2026-03-29 12:31:17.207568+00
51f7e82a-e5d5-46c2-aaf5-8db030216d3a	First Sweat	Complete your first workout	💦	common	sport	workouts	1	2026-03-29 12:31:17.207568+00
30694b57-33b4-41d0-8638-c5dae4f2ffbf	Gym Regular	20 workouts completed	🏋️	common	sport	workouts	20	2026-03-29 12:31:17.207568+00
06d0fafa-e44b-400e-91ef-63fd48dd4ac3	Beast Mode	100 workouts. Absolute beast	🐺	epic	sport	workouts	100	2026-03-29 12:31:17.207568+00
b10d6512-b606-4bf6-836f-c512f60eeec6	Titan of Iron	250 workouts. Forged in the fire	🗡️	legendary	sport	workouts	250	2026-03-29 12:31:17.207568+00
43b1e06a-cbac-4456-8971-40b398be263c	Double Trouble	5 double workout days	⚡	rare	sport	double_workout	5	2026-03-29 12:31:17.207568+00
be86ad1a-a1e4-4c9c-b4af-db3a6004f3e7	Overachiever	20 double workout days	🎯	epic	sport	double_workout	20	2026-03-29 12:31:17.207568+00
3f6bcfa6-afb0-45f9-9026-0618da446a4c	First Chill	5 cold showers — embracing the cold	🥶	common	discipline	cold_shower	5	2026-03-29 12:31:17.207568+00
a91b6bc9-775a-4df4-845c-8c78a8357775	Arctic Soul	50 cold showers. Cold is your ally	❄️	epic	discipline	cold_shower	50	2026-03-29 12:31:17.207568+00
804bf935-71d1-4953-888f-87ddc2f08b2e	Absolute Zero	200 cold showers. You are the cold	🧊	legendary	discipline	cold_shower	200	2026-03-29 12:31:17.207568+00
b19d0a33-69ba-4a29-9a67-ab2b7f0c7700	First Chapter	Read for the first time	📖	common	discipline	reading	1	2026-03-29 12:31:17.207568+00
478ef1bf-4aa6-465b-86ac-9f86a22b9d8d	Bookworm	10 reading sessions	📚	common	discipline	reading	10	2026-03-29 12:31:17.207568+00
6b106ae6-a62b-40b5-b6ee-f96bf317f225	Knowledge Seeker	30 reading sessions — always learning	🔍	rare	discipline	reading	30	2026-03-29 12:31:17.207568+00
9c138225-8b78-47c0-b32e-a5f3d416c7ae	Scholar	75 reading sessions. A true intellectual	🎓	epic	discipline	reading	75	2026-03-29 12:31:17.207568+00
78b22244-b240-437a-aa65-4e0bbf3733d7	Library Legend	150 reading sessions. Your mind is a weapon	🏛️	legendary	discipline	reading	150	2026-03-29 12:31:17.207568+00
033b1566-e7a0-4526-9e4f-5db4929889e7	First Clean Meal	Log your first healthy meal	🥦	common	discipline	healthy_food	1	2026-03-29 12:31:17.207568+00
96aad20b-f693-437b-b581-7971859c9f7c	Nutrition Nerd	50 days of clean eating	🧬	rare	discipline	healthy_food	50	2026-03-29 12:31:17.207568+00
3f2b5d03-7ac0-4a9e-8678-ee486a87912e	Diet King	100 days of healthy food. Iron discipline	👑	epic	discipline	healthy_food	100	2026-03-29 12:31:17.207568+00
eb128bdb-8b03-4125-8c18-55fd29368684	Protein Machine	50 days hitting protein targets	🥩	rare	discipline	protein	50	2026-03-29 12:31:17.207568+00
5b024818-9a1a-4f8c-bd30-35262f19644c	Protein Titan	100 days of protein perfection	🏆	epic	discipline	protein	100	2026-03-29 12:31:17.207568+00
e0787d62-dbee-403f-90ff-a7c9429c82e4	Ocean Inside	60 days of 3L+ hydration	🌊	epic	discipline	hydration	60	2026-03-29 12:31:17.207568+00
b713c057-b26d-4bd9-9834-50b291099f90	Water God	100 days of perfect hydration	💎	legendary	discipline	hydration	100	2026-03-29 12:31:17.207568+00
a9bb9a0c-b0a7-41e5-b3b3-056bf8f5ef31	First Breath	Your first meditation session	🌬️	common	discipline	meditation	1	2026-03-29 12:31:17.207568+00
be470f6f-45ce-47e7-be9c-b8d65d37ca16	Inner Peace	10 meditation sessions	☮️	common	discipline	meditation	10	2026-03-29 12:31:17.207568+00
feec0d82-2d55-4b37-9eda-7878894a631d	Mind Over Matter	30 meditation sessions	🧠	rare	discipline	meditation	30	2026-03-29 12:31:17.207568+00
bef233f6-cb70-4a45-9183-8f917b096a6c	Enlightened	100 meditation sessions. True enlightenment	✨	legendary	discipline	meditation	100	2026-03-29 12:31:17.207568+00
51ddf51f-003d-46fa-bed8-f278c24a076f	Morning Monk	30 mornings without phone	🌄	rare	discipline	no_phone_morning	30	2026-03-29 12:31:17.207568+00
23974934-98b7-4851-b12e-34c6eab28c5f	Digital Ascetic	60 phone-free mornings	📵	epic	discipline	no_phone_morning	60	2026-03-29 12:31:17.207568+00
30ec56a0-1750-47ef-bd8f-61c0cfd5afcf	Night Guardian	30 nights without phone	🌙	rare	discipline	no_phone_evening	30	2026-03-29 12:31:17.207568+00
179652ec-5e08-494d-a4ee-78359eedf4f0	Sunset Sage	60 phone-free evenings	🌅	epic	discipline	no_phone_evening	60	2026-03-29 12:31:17.207568+00
0cffdd33-83e3-44a5-8faf-66ef3b7407fd	Flawless	Complete EVERY habit in one day	💎	epic	checkin	perfect_day	1	2026-03-29 12:31:17.207568+00
63f54871-9ae9-47b5-91fb-bedc68f06778	Perfect Week	7 perfect days total	🌟	epic	checkin	perfect_day	7	2026-03-29 12:31:17.207568+00
1d71287f-3b98-48da-bb82-3c6aa7d7e973	Perfectionist	30 perfect days. Inhuman consistency	👑	legendary	checkin	perfect_day	30	2026-03-29 12:31:17.207568+00
3e94fde2-83ec-4754-a9fa-f21ac67265ec	Show Don't Tell	Upload 5 proof photos	📸	common	checkin	proofs	5	2026-03-29 12:31:17.207568+00
e49026d1-eea4-4011-9e27-b4233c33110f	Receipts Only	25 proof photos — all documented	🧾	rare	checkin	proofs	25	2026-03-29 12:31:17.207568+00
1d7a0e89-aef5-41c6-b9ca-254f67c5b28c	Proof Machine	50 proof photos. Absolute accountability	📹	epic	checkin	proofs	50	2026-03-29 12:31:17.207568+00
a00639a4-faa2-46d7-8488-4cc8385b311c	Rising Star	Earn 500 XP	⭐	common	xp	xp	500	2026-03-29 12:31:17.207568+00
92be1955-081a-40f3-9204-d9b867cddf6e	XP Collector	Earn 2,000 XP	💰	common	xp	xp	2000	2026-03-29 12:31:17.207568+00
0c6ea29c-9c4f-4b6f-8095-023f409433db	XP Overlord	Earn 15,000 XP	🔮	epic	xp	xp	15000	2026-03-29 12:31:17.207568+00
d0d1388c-e14e-4741-a720-2bf009448850	XP Immortal	Earn 50,000 XP. Absolute domination	💀	legendary	xp	xp	50000	2026-03-29 12:31:17.207568+00
258c8ff1-b548-474f-a84f-7b06b44b21ef	Apprentice	Reach Level 3	🎖️	common	level	level	3	2026-03-29 12:31:17.207568+00
61f9c6e7-e9d5-4ad9-8448-b14c43a6f911	Warrior	Reach Level 10	⚔️	rare	level	level	10	2026-03-29 12:31:17.207568+00
b5cd6621-e505-44c3-9a0e-f5b547a209b7	Champion	Reach Level 25	🏅	epic	level	level	25	2026-03-29 12:31:17.207568+00
bd51111c-99a0-4d97-9b22-df2042e81c85	Grandmaster	Reach Level 50. The highest order	♔	legendary	level	level	50	2026-03-29 12:31:17.207568+00
cce683db-4c5c-4b8f-a467-eaf28a0c4f20	Battle Hardened	Win 3 battles	🛡️	rare	battles	battles_won	3	2026-03-29 12:31:17.207568+00
5e3a907b-a765-455e-bea9-0d56d00259fe	Champion Fighter	Win 15 battles	🥊	epic	battles	battles_won	15	2026-03-29 12:31:17.207568+00
b8558af7-3923-4d48-802e-07491e051116	Battle God	Win 50 battles. Unbeatable	⚡	legendary	battles	battles_won	50	2026-03-29 12:31:17.207568+00
d8e39050-0560-442a-83b8-67c60fcd2bad	First Step	Complete your very first check-in	👣	common	checkin	checkins	1	2026-03-29 12:31:17.207568+00
280d4d98-3d2a-4d78-9c55-fbc07baa8af4	Consistent	25 check-ins logged	📊	common	checkin	checkins	25	2026-03-29 12:31:17.207568+00
d6181464-1d07-40df-9cb0-de94e1da9c38	Devoted	75 check-ins. Truly devoted	🔒	rare	checkin	checkins	75	2026-03-29 12:31:17.207568+00
4c576516-d722-498b-a3fa-6e9b06e2661f	Unstoppable	200 check-ins. Nothing stops you	🚀	epic	checkin	checkins	200	2026-03-29 12:31:17.207568+00
76416c28-d1d2-4dce-b49d-a5190148541d	Eternal	1,000 check-ins. You are eternal	♾️	legendary	checkin	checkins	1000	2026-03-29 12:31:17.207568+00
20b3ea38-8065-4bf4-b17e-a037a3bbcd9d	Week Warrior	7-day streak. A full week of dominance	⚡	rare	streak	streak	7	2026-03-29 12:31:17.207568+00
83e1ed5a-735e-4248-bcb6-7b2bf4f03c38	First Recruit	Invited your first paying member	🎯	rare	social	paid_referrals	1	2026-04-21 16:33:19.19599+00
19b8336d-5de4-41b4-b2c0-6f6d706ccecc	Brand Ambassador	5 paying members invited	🌟	epic	social	paid_referrals	5	2026-04-21 16:33:19.19599+00
08133140-6bf0-4361-a0c5-1d5d38d6c1dd	Inner Circle Founder	10 paying members invited	👑	legendary	social	paid_referrals	10	2026-04-21 16:33:19.19599+00
b3541814-f87f-49a3-9723-fe6aa099c603	Kingmaker	25 paying members invited — lifetime membership	🏆	legendary	social	paid_referrals	25	2026-04-21 16:33:19.19599+00
00570420-e0ff-4195-aed1-6121f9f8abdc	Founders Circle	Recruit 50 paid friends — Legend status pinned for life	🔱	legendary	referral	paid_referrals	50	2026-04-22 10:03:57.551193+00
5fd0173b-2ab6-473e-b247-964a82303376	Spark Brother	Your tribe burned together for 7 days straight	🔥	common	tribe	tribe_collective_streak	7	2026-04-22 18:23:56.182285+00
fffbd601-6532-477f-9542-ef6aedf14bd8	Tribe Ember	Tribe collective streak hit 30 days	🪵	rare	tribe	tribe_collective_streak	30	2026-04-22 18:23:56.182285+00
de1dc223-af54-4ef4-85ea-aaa9061800cf	Tribe Inferno	Tribe collective streak hit 90 days	🌋	epic	tribe	tribe_collective_streak	90	2026-04-22 18:23:56.182285+00
0220b1ec-1274-4cb2-84ba-9048cacb638b	Eternal Pyre	Tribe collective streak reached 180 days	☄️	legendary	tribe	tribe_collective_streak	180	2026-04-22 18:23:56.182285+00
ddffc11f-3acf-463c-8b82-037b4fae7adc	Tribe Founder	A tribe you founded reached collective streak 30	👑	epic	tribe	tribe_founder_streak	30	2026-04-22 18:23:56.182285+00
3581138c-6de2-41ff-b304-3db3a1481155	First Tribe Blood	Won your first tribe battle	⚔️	common	tribe	tribe_battles_won	1	2026-04-22 18:23:56.182285+00
4d601f13-9cc5-4af5-a3cd-e0795343ba11	War Chief	Won 5 tribe battles	🛡️	rare	tribe	tribe_battles_won	5	2026-04-22 18:23:56.182285+00
53f61827-31ed-421b-a213-3f43a29703d4	Tribe Conqueror	Won 15 tribe battles	🏆	epic	tribe	tribe_battles_won	15	2026-04-22 18:23:56.182285+00
b5b6020b-3b13-4a90-9bb1-c2652d21fc80	Apex Reached	Reached the Apex tier	💎	epic	tier	apex_reached	1	2026-04-22 18:23:56.182285+00
d6b20e7e-0440-48de-b5ab-fa78c2f589e0	Apex Stronghold	Held Apex tier for 14 days	🏔️	epic	tier	apex_held_days	14	2026-04-22 18:23:56.182285+00
71c00995-a87b-4a86-8278-37f783f24f77	Founding Apex	Joined Apex through paid Instant subscription	✨	legendary	tier	apex_founding	1	2026-04-22 18:23:56.182285+00
9c21b446-7292-46ab-b3a9-3c873463afa5	Legend Ascendant	Reached the Legend tier	🌟	legendary	tier	legend_reached	1	2026-04-22 18:23:56.182285+00
ea64029e-2d9f-4bf5-90a2-cde00db384df	Eternal Legend	Held Legend tier for 30 days	👁️	legendary	tier	legend_held_days	30	2026-04-22 18:23:56.182285+00
853b0d25-f846-452f-a976-95fd685e8a26	Inferno Personal	Reached a personal streak of 100 days	🔥	epic	streak	personal_streak	100	2026-04-22 18:23:56.182285+00
1524175a-9fad-42c4-be08-e85753fd3d3b	Phoenix	Rebuilt to a 30+ streak after losing one	🦅	rare	streak	phoenix_recovery	1	2026-04-22 18:23:56.182285+00
\.


--
-- Data for Name: battle_votes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.battle_votes (id, battle_id, voter_id, voted_for, created_at) FROM stdin;
\.


--
-- Data for Name: battles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.battles (id, challenger_id, opponent_id, status, winner_id, battle_type, duration_days, started_at, ended_at, created_at, challenger_score, opponent_score, challenger_proof_url, opponent_proof_url, challenger_start_xp, opponent_start_xp) FROM stdin;
d857786a-d5f5-4939-add2-ec2fb4e68865	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	completed	01a63c98-3dcd-4666-9be1-182d11c3e066	xp	7	2026-03-22 10:20:14.243+00	2026-03-29 10:30:06.201+00	2026-03-22 10:18:59.422095+00	0	0	https://zjdljojkgrpgxurugixf.supabase.co/storage/v1/object/public/proof-photos/battle-proofs/d857786a-d5f5-4939-add2-ec2fb4e68865/01a63c98-3dcd-4666-9be1-182d11c3e066-1774193632866.JPG	https://zjdljojkgrpgxurugixf.supabase.co/storage/v1/object/public/proof-photos/battle-proofs/d857786a-d5f5-4939-add2-ec2fb4e68865/63752d9b-c1ce-498f-9994-d38c462c3c6b-1774261667385.JPG	0	0
\.


--
-- Data for Name: coach_athlete_profile; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coach_athlete_profile (user_id, age, sex, height_cm, weight_kg, body_fat_pct, primary_goal, secondary_goal, target_horizon_weeks, timezone, wake_time, sleep_time, training_days_pref, busy_blocks, injuries, dietary, equipment, no_go_protocols, language_pref, tone_pref, preferred_session_length_min, i_am, onboarded, created_at, updated_at) FROM stdin;
63752d9b-c1ce-498f-9994-d38c462c3c6b	25	male	175	68	\N	all	\N	12	Europe/Helsinki	07:00:00	23:00:00	{1,2,4,5}	[]	{}	{Gluten-free,Lactose-free}	{Barbell,Dumbbells,"Pull-up bar","Cold plunge",Treadmill}	{}	en	hype	90	Olen mies joka haluaa kehittyä elämän jokaisella osa alueella. olen käynyt salilla noin 10 vuotta ja harrastan thainyrkkeilyä. olen käistellyt ja purka\n\n	t	2026-05-03 13:49:18.970384+00	2026-05-03 13:49:18.970384+00
01a63c98-3dcd-4666-9be1-182d11c3e066	25	male	175	67	\N	all	\N	12	Europe/Helsinki	08:00:00	00:00:00	{1,2,3,4,5,6}	[]	{}	{Lactose-free,Gluten-free}	{Barbell,Dumbbells,"Pull-up bar","Cold plunge",Treadmill}	{}	en	hype	90	i train muay thai and gym	t	2026-05-05 09:03:41.734763+00	2026-05-12 09:22:52.733161+00
\.


--
-- Data for Name: coach_chat_memory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coach_chat_memory (id, user_id, fact, source, confidence, created_at) FROM stdin;
c34e683c-186e-4c17-9251-46a11de52079	63752d9b-c1ce-498f-9994-d38c462c3c6b	I train muay thai	manual	1	2026-05-03 14:17:36.81092+00
1e019cf3-7de3-4256-882d-e2db7210df2a	63752d9b-c1ce-498f-9994-d38c462c3c6b	User prefers light cardio for recovery.	chat-extract	0.8	2026-05-03 16:15:25.797736+00
b4619b3e-15af-4b9c-9d05-8506de920efd	63752d9b-c1ce-498f-9994-d38c462c3c6b	User will perform a 25-minute treadmill session at 3% incline.	chat-extract	0.9	2026-05-03 16:15:25.797736+00
c78ac85c-d4a9-423d-86c8-0a67434ee0ba	63752d9b-c1ce-498f-9994-d38c462c3c6b	User aims for 3L of hydration daily.	chat-extract	0.7	2026-05-03 16:15:25.797736+00
5a4bc69d-1b57-4997-9ca9-352093bdf151	63752d9b-c1ce-498f-9994-d38c462c3c6b	User aims for 8 hours of sleep per night.	chat-extract	0.7	2026-05-03 16:15:25.797736+00
31499aaa-ef89-4f28-a189-ec607f96c16d	63752d9b-c1ce-498f-9994-d38c462c3c6b	User prefers light cardio for recovery.	chat-extract	0.9	2026-05-03 16:15:51.746906+00
b11645eb-58a2-4342-93a8-c93c9b5d3f25	63752d9b-c1ce-498f-9994-d38c462c3c6b	User aims for 3 L of hydration daily.	chat-extract	0.9	2026-05-03 16:15:51.746906+00
b6dc7a5f-e233-42bd-80f6-4b0596e710c8	63752d9b-c1ce-498f-9994-d38c462c3c6b	User aims for 8 hours of sleep per night.	chat-extract	0.9	2026-05-03 16:15:51.746906+00
f486e6d8-b51a-45c9-b23b-0f1056a76092	63752d9b-c1ce-498f-9994-d38c462c3c6b	User completed a 25-minute treadmill session at 3% incline.	chat-extract	0.8	2026-05-03 16:15:51.746906+00
7bf9405e-a2ab-44f9-85ca-7920f5fc84f1	63752d9b-c1ce-498f-9994-d38c462c3c6b	User will perform mobility exercises for hips, ankles, and T-spine.	chat-extract	0.7	2026-05-03 16:15:51.746906+00
\.


--
-- Data for Name: coach_daily_briefs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coach_daily_briefs (id, user_id, brief_date, payload, created_at) FROM stdin;
fe5ed3a1-1491-4b5c-9e54-0b15ab422a58	63752d9b-c1ce-498f-9994-d38c462c3c6b	2026-05-03	{"week": 1, "ribbon": "Week 1 · All · High performer", "brief_md": "Alright Olen, active recovery is the name of the game today! With 7.5 hours of sleep last night, your body is primed to make the most of this rest. We're keeping things light, but stay ready to attack tomorrow's session.\\n\\n— W Coach", "day_index": 6, "prescriptions": [{"label": "Sleep Target", "value": "7-9 hours"}, {"label": "Protein Target", "value": "150g+\\n(2.2g/kg)"}, {"label": "Today's Intent", "value": "Active Recovery"}], "session_focus": "Rest", "suggested_questions": ["What's the best active recovery for me?", "Can I do a light cardio session?", "What should I eat on a rest day?"]}	2026-05-03 16:10:39.611599+00
3795341e-5f94-4a86-8cc1-76160a1dfcef	63752d9b-c1ce-498f-9994-d38c462c3c6b	2026-05-04	{"week": 1, "ribbon": "Week 1 · All · Day 1", "brief_md": "Olen, fantastic start to your week yesterday! That 7.5 hours of sleep means you're primed and ready. Today's Full-body Strength A is all about hitting it hard from the start; with a barbell, you're set to crush those Back Squats. Let's make every rep count!\\n\\n— W Coach", "day_index": 0, "prescriptions": [{"label": "Sleep Target", "value": "7.5-8.5 hours"}, {"label": "Protein Target", "value": "120-150g"}, {"label": "Today's Intent", "value": "Dominate the Squat"}], "session_focus": "Full-body Strength A", "suggested_questions": ["What's the best way to warm up for squats?", "How can I maintain proper form throughout the workout?", "What should I focus on for recovery after my workout?"]}	2026-05-04 05:35:44.972976+00
54af46e2-5e58-4ca8-92bd-0b4c0e1eb786	01a63c98-3dcd-4666-9be1-182d11c3e066	2026-05-05	{"week": 1, "ribbon": "Week 1 · All-around · Day 1 / 7", "brief_md": "Willehard, you crushed your sleep last night with a solid 8 hours! Ready to bring that same energy into today's 50-minute Lower Body + Core? Let's hit every rep with fire, especially the DB Goblet Squats—focus on depth and control to build that rock-solid foundation. Let's get after it today. — W Coach", "day_index": 1, "prescriptions": [{"label": "Sleep Target", "value": "8 hours"}, {"label": "Protein Target", "value": "120g"}, {"label": "Today's Intent", "value": "Lower Body Power"}], "session_focus": "Lower Body + Core", "suggested_questions": ["What's the best way to warm up for goblet squats?", "Can I swap out any exercises if I'm feeling a bit tight today?", "How can I make sure I'm activating my core effectively in this session?"]}	2026-05-05 09:03:48.866922+00
1ae8d692-cdf2-405d-b2dd-9d516a8152ab	63752d9b-c1ce-498f-9994-d38c462c3c6b	2026-05-05	{"week": 1, "ribbon": "Week 1 · All Out! · 1/7 workouts", "brief_md": "Olen, morning! You put in a solid 7.5 hours of sleep last night, keeping that average dialed in. Today, we're hitting a full-body hypertrophy and engine session—let's make it 80 minutes to keep that intensity razor-sharp. Own that session!", "day_index": 1, "prescriptions": [{"label": "Sleep Target", "value": "7.5-8.5 hrs"}, {"label": "Protein Target", "value": "180-200g"}, {"label": "Today's Intent", "value": "Full-body pump + push the pace"}], "session_focus": "Full-body Hypertrophy + Engine", "suggested_questions": ["Why 80 minutes instead of 88?", "Can I do more cardio if I'm feeling good?", "What's the best way to leverage my cold plunge today?"]}	2026-05-05 10:18:42.840701+00
bc20bbb6-e7fc-4347-abe0-fdbe5d3cae80	63752d9b-c1ce-498f-9994-d38c462c3c6b	2026-05-06	{"week": 1, "ribbon": "Week 1 · All · On Track", "brief_md": "Olen, hey! Don't let that 'Rest' on your program fool you – today is all about ACTIVE recovery! With a 1-day streak already under your belt, let's keep that momentum flowing by dialing in your nutrition. Your move for the next 24: dial in your macros, especially that protein intake. — W Coach", "day_index": 2, "prescriptions": [{"label": "Sleep Target", "value": "7-9 hours"}, {"label": "Protein Target", "value": "120-150g"}, {"label": "Today's Intent", "value": "Active Recovery & Nutrition Focus"}], "session_focus": "Rest", "suggested_questions": ["What active recovery should I do?", "Can you recommend some high-protein meals?", "How does sleep impact my performance?"]}	2026-05-06 09:02:39.876847+00
1d380733-b6fe-48eb-8a2e-65e38b7ab711	01a63c98-3dcd-4666-9be1-182d11c3e066	2026-05-06	{"week": 1, "ribbon": "Week 1 · All · Rest & Recharge", "brief_md": "Alright Willehard, we've got a rest day on the books for you today, but that doesn't mean we're slowing down on recovery! You crushed an average of 8 hours of sleep recently—let's make tonight another 8-hour masterpiece to keep those gains coming. Focus on fueling up, staying hydrated, and getting ready to attack tomorrow's session!", "day_index": 2, "prescriptions": [{"label": "Sleep Target", "value": "8h+"}, {"label": "Protein Target", "value": "150g+"}, {"label": "Today's Intent", "value": "Optimal Recovery"}], "session_focus": "Rest", "suggested_questions": ["What are the best recovery foods?", "Can I do some light stretching today?", "What's in store for my next workout?"]}	2026-05-06 09:05:00.140406+00
9235ff54-2394-4f4f-a1b9-7d57d099980d	01a63c98-3dcd-4666-9be1-182d11c3e066	2026-05-13	{"week": 2, "ribbon": "Week 1 · All · Legend", "brief_md": "Alright i, you crushed that 8 hours of sleep last night – that's how we stay on top! Today's a rest day, so let's use that recovery time wisely. Your only mission for the next 24 hours: prep for tomorrow's session.", "day_index": 2, "prescriptions": [{"label": "Sleep Target", "value": "8 hours"}, {"label": "Protein Target", "value": "150g"}, {"label": "Today's Intent", "value": "Active Recovery Prep"}], "session_focus": "Rest", "suggested_questions": ["What kind of active recovery should I do today?", "How does rest help me reach my 'all' goal?", "What's the best way to prep for tomorrow's session?"]}	2026-05-13 08:25:32.606093+00
42e32a98-0b5d-4b53-b247-7cd62d59d80a	01a63c98-3dcd-4666-9be1-182d11c3e066	2026-05-14	{"week": 2, "ribbon": "Week 1 · All-round · 1-day Streak", "brief_md": "Rise up, i! Today, we're building that powerful upper body with an Upper Pull + Arms session, led by the 1-Arm DB Row. You crushed 8 hours of sleep last night, so let's channel that recovery into some serious gains and dominate every single rep. You're a Legend for a reason—let's go prove it! – W Coach", "day_index": 3, "prescriptions": [{"label": "Sleep Target", "value": "8 hours"}, {"label": "Protein Target", "value": "180g"}, {"label": "Today's Intent", "value": "Upper Body Power"}], "session_focus": "Upper Pull + Arms", "suggested_questions": ["How can I maximize my 1-Arm DB Row today?", "What's the best way to warm up for this session?", "Can I swap a bicep exercise for a tricep one?"]}	2026-05-14 11:12:32.51865+00
88640d00-7611-4d8a-9c53-e7fc54ef9093	01a63c98-3dcd-4666-9be1-182d11c3e066	2026-05-19	{"week": 3, "ribbon": "Week 1 · All · Get after it!", "brief_md": "Let's GO, i! You crushed 8 hours of sleep last night, so you're primed and ready to dominate this Lower Body + Core session. I'm feeling extra spicy today, so let's tack on an extra set to each block – really push that legendary streak of yours to new heights!\\n\\n— W Coach", "day_index": 1, "prescriptions": [{"label": "Sleep Target", "value": "8h+"}, {"label": "Protein Target", "value": "160g+"}, {"label": "Today's Intent", "value": "Explode & Stabilize"}], "session_focus": "Lower Body + Core", "suggested_questions": ["Why an extra set today?", "Can I swap out Goblet Squats?", "What's the best way to activate my core?"]}	2026-05-19 08:16:53.189713+00
\.


--
-- Data for Name: coach_daily_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coach_daily_plans (id, user_id, plan_date, readiness_score, readiness_breakdown, adjustment, headline, missions, generated_with, generated_at, created_at, updated_at, rationale, framework_version) FROM stdin;
6c0ce3a9-a258-473a-82f2-f9c8014d615a	01a63c98-3dcd-4666-9be1-182d11c3e066	2026-05-02	56	{"streak": 1, "rpe_pts": 18, "last_rpe": null, "missed_7d": 5, "sleep_pts": 37, "missed_pts": 0, "streak_pts": 1, "avg_sleep_h": 7.8}	deload	Deload Day: Rebuild & Recover	[{"id": "lower-deload", "xp": 50, "why": "Your readiness is low; a deloaded lower body session supports recovery while maintaining neuromuscular connection.", "kind": "primary", "title": "Lower Body Deload", "pillar": "movement", "evidence": "strong", "priority": "high", "protocol_id": "strength-2-3x"}, {"id": "morning-light", "xp": 20, "why": "Optimizing circadian rhythm with early light exposure supports improved sleep and energy levels for recovery.", "kind": "habit", "title": "Morning Light Exposure", "pillar": "sleep", "evidence": "strong", "priority": "high", "protocol_id": "morning-light-10min"}, {"id": "cold-exposure", "xp": 30, "why": "Despite a missed cold session, consistent practice reduces inflammation and supports recovery from training stress.", "kind": "recovery", "title": "Cold Exposure", "pillar": "recovery", "evidence": "promising", "priority": "medium", "protocol_id": "cold-2-3min"}, {"id": "deep-work", "xp": 25, "why": "Even on a deload day, focused work enhances mental clarity and discipline, supporting overall wellness.", "kind": "focus", "title": "Deep Work Block", "pillar": "stress", "evidence": "strong", "priority": "medium", "protocol_id": "deep-work-90min"}]	google/gemini-2.5-flash	2026-05-02 16:35:41.147204+00	2026-05-02 16:34:20.941029+00	2026-05-02 16:35:41.147204+00	Your readiness is low due to missed sessions. Today, we prioritize active recovery and foundational habits to get you back on track. This deload will help mitigate fatigue and prepare you for subsequent training.	1.0
0c2c2ce8-a385-4ee2-8727-0d5aa0e5bce2	63752d9b-c1ce-498f-9994-d38c462c3c6b	2026-05-03	54	{"streak": 1, "rpe_pts": 18, "last_rpe": null, "missed_7d": 3, "sleep_pts": 33, "missed_pts": 2, "streak_pts": 1, "avg_sleep_h": 7.5}	deload	DELOAD DAY: Recharge & Reclaim Your Power!	[{"id": "deload-movement", "xp": 55, "why": "Your body needs this deload to come back even stronger, Mogger! Zone 2 cardio is how we build that aerobic base and unleash new levels of performance for Muay Thai.", "kind": "primary", "title": "Zone 2 Cardio Power-Up", "pillar": "movement", "evidence": "strong", "priority": "high", "protocol_id": "zone-2-cardio"}, {"id": "refuel-recovery", "xp": 30, "why": "You crushed it yesterday with the cold plunge, let's keep that momentum, Mogger! This is how you accelerate recovery and own that 'high performer' identity.", "kind": "recovery", "title": "Cold Plunge for Elite Recovery", "pillar": "recovery", "evidence": "promising", "priority": "high", "protocol_id": "cold-2-3min"}, {"id": "focus-mindfulness", "xp": 25, "why": "Elite performance isn't just about the body; it's about the mind, Mogger! Sharpen your focus and reduce stress to dominate every aspect of your life.", "kind": "focus", "title": "Mindfulness for Mental Edge", "pillar": "stress", "evidence": "strong", "priority": "medium", "protocol_id": "mindfulness-10min"}, {"id": "nightly-gratitude", "xp": 18, "why": "Building a winning mindset starts with appreciation, Mogger! Cultivate gratitude to fuel your drive and recognize every victory.", "kind": "habit", "title": "Gratitude for Lasting Wins", "pillar": "connection", "evidence": "promising", "priority": "low", "protocol_id": "gratitude-3x"}]	google/gemini-2.5-flash	2026-05-03 15:52:52.251756+00	2026-05-03 15:52:52.251756+00	2026-05-03 15:52:52.251756+00	Mogger, your readiness score is calling for a deload! We're pulling back on intensity to let your body supercharge. This strategic pause is key for adapting, growing stronger, and keeping that incredible momentum going. Get ready to bounce back BIG!	1.0
a2424bd1-50e7-4634-8a39-08ddf48622ba	01a63c98-3dcd-4666-9be1-182d11c3e066	2026-05-06	59	{"streak": 1, "rpe_pts": 18, "last_rpe": null, "missed_7d": 4, "sleep_pts": 40, "missed_pts": 0, "streak_pts": 1, "avg_sleep_h": 8}	deload	Deload Day Dominance: Rebuild and Rise!	[{"id": "rebuild-strength", "xp": 50, "why": "Even on a deload, we lay the groundwork for massive gains. Hit some controlled sets to keep momentum for your all-in goal!", "kind": "primary", "title": "Strength Rebuild Session", "detail": "Today, we re-engage with your movement identity! Focus on 3 sets of 8-10 reps at a lighter load for 2-3 exercises. This is about perfect form and muscle activat", "pillar": "movement", "evidence": "strong", "priority": "high", "protocol_id": "strength-2-3x"}, {"id": "recharge-sleep", "xp": 30, "why": "You crushed 8h sleep yesterday! Let's lock in 7-9 hours tonight for peak recovery and next-level performance.", "kind": "recovery", "title": "7-9 Hours Sleep Masterclass", "detail": "Aim for 7-9 hours of quality sleep tonight. This is where your body repairs, rebuilds, and gets ready to dominate. Optimize your sleep environment: cool, dark, ", "pillar": "sleep", "evidence": "strong", "priority": "high", "protocol_id": "sleep-7-9h"}, {"id": "mindful-moment", "xp": 25, "why": "Sharpen your mental edge and enhance focus; a key to unlocking elite performance in all areas.", "kind": "focus", "title": "10-Min Mindfulness Power-Up", "detail": "Dedicate 10 minutes today to mindfulness. Find a quiet space, close your eyes, and focus on your breath. Observe any thoughts or sensations without judgment, le", "pillar": "stress", "evidence": "strong", "priority": "medium", "protocol_id": "mindfulness-10min"}, {"id": "hydration-hero", "xp": 15, "why": "Hydration is the foundation of energy and performance; maintaining your 3L win supports every cell!", "kind": "habit", "title": "Hydration Champion: 30ml/kg", "detail": "Hit your target of ~2 liters of water today. Front-load your hydration but taper off after 7 PM to avoid disrupting sleep. Keep a water bottle handy and sip thr", "pillar": "nutrition", "evidence": "promising", "priority": "high", "protocol_id": "hydration-30ml-kg"}]	google/gemini-2.5-flash	2026-05-06 09:05:47.850258+00	2026-05-06 09:05:47.850258+00	2026-05-06 09:05:47.850258+00	Your body's calling for a deload, and we're answering with a strategic plan to supercharge your recovery and prime you for epic wins! This isn't a step back, it's a slingshot forward, focusing on deep recovery.	1.0
08de93b4-df03-4493-a932-a010f2dab7d1	63752d9b-c1ce-498f-9994-d38c462c3c6b	2026-05-06	61	{"streak": 1, "rpe_pts": 18, "last_rpe": null, "missed_7d": 3, "sleep_pts": 40, "missed_pts": 2, "streak_pts": 1, "avg_sleep_h": 8}	hold	Unleash Your Inner Beast, Moneymogger888!	[{"id": "zone2-cardio-blast", "xp": 55, "why": "Crush this 25-min treadmill session to boost your endurance and elevate your 'all over' goal!", "kind": "primary", "title": "Zone 2 Cardio Blast", "pillar": "movement", "evidence": "strong", "priority": "high", "protocol_id": "zone-2-cardio"}, {"id": "mobility-flow", "xp": 30, "why": "Unlock full range of motion for hips, ankles, and T-spine — essential for your Muay Thai mastery!", "kind": "recovery", "title": "Mobility Flow for Optimal Movement", "pillar": "recovery", "evidence": "promising", "priority": "medium", "protocol_id": "mobility-10min"}, {"id": "deep-work-power", "xp": 25, "why": "Unleash laser focus to conquer your tasks and elevate your all-around development, champion!", "kind": "focus", "title": "90-Minute Deep Work Power Hour", "pillar": "stress", "evidence": "strong", "priority": "high", "protocol_id": "deep-work-90min"}, {"id": "hydration-domination", "xp": 18, "why": "Hit your 3L target to fuel peak performance and support your body as you evolve. Let’s go!", "kind": "habit", "title": "Hydration Domination", "pillar": "nutrition", "evidence": "promising", "priority": "medium", "protocol_id": "hydration-30ml-kg"}]	google/gemini-2.5-flash	2026-05-06 10:13:52.096285+00	2026-05-06 10:13:52.096285+00	2026-05-06 10:13:52.096285+00	Ready to dominate, "mies joka haluaa kehittyä elämän jokaisella osa alueella!" Your readiness score is holding steady at 61/100, driven by a solid 8 hours of sleep! Today we build on that momentum, focusing on recovery to prime you for future wins!	1.0
\.


--
-- Data for Name: coach_goals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coach_goals (id, user_id, title, metric, unit, baseline_value, current_value, target_value, deadline, weekly_milestone, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: coach_mission_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coach_mission_logs (id, user_id, daily_plan_id, mission_id, xp_awarded, completed_at) FROM stdin;
\.


--
-- Data for Name: coach_nudges; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coach_nudges (id, user_id, content, headline, created_at, seen_at) FROM stdin;
f6ed0aed-1379-4eb3-adc5-2d5395ccfe5a	01a63c98-3dcd-4666-9be1-182d11c3e066	Your 8.5h sleep fueled a solid performance yesterday, but the morning phone usage broke your focus. Lock your phone in another room until 09:00 today to protect your recovery gains.	Silence the Morning Noise	2026-04-20 07:00:06.626495+00	2026-04-20 07:42:56.369+00
e033229d-d10b-41a7-897f-81129a2ef6b5	01a63c98-3dcd-4666-9be1-182d11c3e066	You dominated the physical goals yesterday but slipped on the evening phone lockout. Secure your level 18 streak by placing your phone in another room at 9:00 PM tonight.	Seal the Evening Leak	2026-04-22 07:00:07.882235+00	2026-04-22 15:27:13.622+00
1d0b243b-96dc-431d-85e5-c6ef4bc4ddb7	01a63c98-3dcd-4666-9be1-182d11c3e066	You hit every mark yesterday except for the morning scroll. Leave your phone in another room until you've finished your first 20 minutes of reading today.	Lock the Morning Focus	2026-04-23 07:00:09.911351+00	\N
1f5b0625-3671-4c25-b861-f9349c77934e	01a63c98-3dcd-4666-9be1-182d11c3e066	Your perfect streak and 283 XP show elite discipline, but your 7.5h sleep is just below the recovery threshold. Keep the momentum by adding a 10-minute stretching session tonight to maximize physical recovery.	Maintain Peak Performance	2026-04-24 07:00:13.818572+00	\N
c2d4f08e-8c85-49aa-882e-18a77e1bb74c	01a63c98-3dcd-4666-9be1-182d11c3e066	You hit your sleep and hydration targets, but the evening phone use and poor nutrition choices stalled your momentum. Complete a 30-minute workout before 6 PM today to reset your discipline and earn that level 20.	Reclaim the evening edge	2026-04-25 07:00:07.796999+00	\N
5bfba7fb-6ceb-47bf-b887-eae629b1fb69	01a63c98-3dcd-4666-9be1-182d11c3e066	You slipped on evening screen time and nutrition yesterday despite a strong workout. Fix the diet today by prepping a high-protein dinner before 6:00 PM to avoid late-night scrolling and snacking.	Tighten the Evening Perimeter	2026-04-27 07:00:05.229119+00	\N
93f51a3d-d606-424a-aa05-6d0270d5c221	01a63c98-3dcd-4666-9be1-182d11c3e066	You maintained perfect discipline across all habits yesterday, but your 7.5h sleep could be deeper. Add 5 minutes of focused breathwork before bed tonight to optimize your recovery.	Perfect Streak, Refine Recovery	2026-04-29 07:00:10.787749+00	\N
c3693083-601f-46cf-b33d-340cf1b9ee71	01a63c98-3dcd-4666-9be1-182d11c3e066	You executed a perfect day yesterday with total consistency across all habits. Push your workout intensity today by adding 2.5kg to your main compound lift or performing 2 extra reps per set.	Total execution. Up the intensity.	2026-04-30 07:00:31.68789+00	\N
978c338b-fe9f-4402-981c-85e7211942e3	63752d9b-c1ce-498f-9994-d38c462c3c6b	Despite the solid workout, yesterday's diet and screen habits slowed your momentum. Block your phone in a drawer for the first 30 minutes today and eat a high-protein breakfast before any carbs.	Kill the screen, fuel better.	2026-04-29 07:00:08.710625+00	2026-05-02 17:14:44.551+00
1d32c05b-f349-4834-9ade-a98fd8a0729c	01a63c98-3dcd-4666-9be1-182d11c3e066	Yesterday's processed food intake and evening phone usage broke your discipline. Power off your phone by 9:00 PM tonight and eat three whole-food meals to reset your streak.	Cut Processed Food and Screens	2026-05-03 07:00:07.864069+00	\N
23e0537a-ef7e-49be-8d64-bf661577a5ee	01a63c98-3dcd-4666-9be1-182d11c3e066	Yesterday's phone use sabotaged your focus. Replace the morning scroll with 10 minutes of reading before you touch your device today.	Kill the morning scroll	2026-05-06 07:00:13.984376+00	\N
2f076a83-d2fb-4eb2-8cdb-86b282002869	01a63c98-3dcd-4666-9be1-182d11c3e066	Yesterday's phone use sabotaged your momentum despite the perfect workout and sleep. Lock your phone in another room for the next 60 minutes to reclaim your morning focus.	Kill the digital noise.	2026-05-08 07:00:09.959471+00	\N
1f149f3a-21c7-4320-86a9-da762bde2387	01a63c98-3dcd-4666-9be1-182d11c3e066	You missed your protein and morning phone lockout yesterday. Start today by hitting 30g of protein within 30 minutes of waking and keeping your phone in another room until breakfast.	Fix the Protein Gap	2026-05-11 07:00:08.65257+00	\N
cffdabb8-cf8e-4628-bb2e-e7bc9f21786c	63752d9b-c1ce-498f-9994-d38c462c3c6b	You slept 8 hours but missed your workout and clean eating yesterday. Do 50 pushups today and log a clean meal to keep your level 5 progress alive.	Turn Sleep Into Power	2026-05-07 07:00:13.960406+00	2026-05-11 10:15:48.938+00
61a374fb-fb7e-40ef-9208-0bcd08d92f5f	01a63c98-3dcd-4666-9be1-182d11c3e066	Your hydration and recovery were solid, but missing the morning phone-free goal killed your momentum. Lock your phone away for the first 30 minutes today and complete a 20-minute bodyweight circuit to get back on track.	Morning Focus, Physical Output.	2026-05-14 07:00:05.912864+00	\N
\.


--
-- Data for Name: coach_performance_snapshots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coach_performance_snapshots (id, user_id, snapshot_date, performance_score, components, created_at) FROM stdin;
\.


--
-- Data for Name: coach_preference_signals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coach_preference_signals (id, user_id, signal_type, protocol_id, value, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: coach_program_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coach_program_logs (id, user_id, program_id, week, day_index, completed, perceived_rpe, notes, logged_at) FROM stdin;
72709513-e9db-4f89-93f3-3d607fc25dd9	01a63c98-3dcd-4666-9be1-182d11c3e066	14dd20d3-fc86-4796-8689-7ae23a36d7fa	1	5	t	\N	\N	2026-05-02 16:37:03.009852+00
34406a27-6f26-4b01-a9e5-81769c6f2e03	63752d9b-c1ce-498f-9994-d38c462c3c6b	2105ed9a-316a-4ec7-8fa6-3e12d4b40c23	1	6	t	\N	\N	2026-05-03 14:18:06.848725+00
03955084-3139-4c2d-ac95-64da1c8500ba	01a63c98-3dcd-4666-9be1-182d11c3e066	14dd20d3-fc86-4796-8689-7ae23a36d7fa	2	3	t	\N	\N	2026-05-14 11:19:01.463591+00
\.


--
-- Data for Name: coach_programs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coach_programs (id, user_id, status, goal, experience, days_per_week, equipment, body_focus, constraints, weeks, plan_json, ai_summary, generated_with, started_on, created_at, updated_at) FROM stdin;
14dd20d3-fc86-4796-8689-7ae23a36d7fa	01a63c98-3dcd-4666-9be1-182d11c3e066	active	General health	advanced	5	Dumbbells at home	{Arms}		4	{"weeks": [{"days": [{"day": "Mon", "focus": "Upper Push + Arms", "blocks": [{"rpe": 7, "name": "DB Flat Bench Press", "reps": "8", "sets": 3, "notes": "2–3 min rest. Tempo 2-0-1. Leave ~3 reps in reserve."}, {"rpe": 7, "name": "DB Incline Press", "reps": "10", "sets": 2, "notes": "90 sec rest. Keep shoulder blades retracted."}, {"rpe": 7, "name": "DB Seated Shoulder Press", "reps": "8", "sets": 3, "notes": "2 min rest. Avoid excessive arch."}, {"rpe": 6, "name": "DB Lateral Raise", "reps": "12", "sets": 2, "notes": "60–75 sec rest. Soft elbows; raise to just below shoulder height."}, {"rpe": 7, "name": "DB Overhead Triceps Extension (2‑hand)", "reps": "10", "sets": 3, "notes": "75–90 sec rest. Elbows tucked; full stretch overhead."}], "conditioning": "Optional finisher: 8 min brisk walk or march, nasal breathing only.", "duration_min": 55}, {"day": "Tue", "focus": "Lower Body + Core", "blocks": [{"rpe": 7, "name": "DB Goblet Squat", "reps": "8", "sets": 3, "notes": "2–3 min rest. Tempo 3-1-1. Maintain torso bracing."}, {"rpe": 7, "name": "DB Romanian Deadlift", "reps": "8", "sets": 3, "notes": "2 min rest. Hinge at hips; keep lats tight."}, {"rpe": 7, "name": "DB Reverse Lunge", "reps": "10/side", "sets": 2, "notes": "90 sec rest. Light torso lean forward; knee tracks toes."}, {"rpe": 7, "name": "DB Standing Calf Raise", "reps": "12", "sets": 3, "notes": "60–75 sec rest. 1–2 sec pause at top/bottom."}, {"rpe": 6, "name": "Side Plank", "reps": "40 sec/side", "sets": 2, "notes": "Nasal breathing; ribs down."}, {"rpe": 6, "name": "Dead Bug", "reps": "8/side", "sets": 2, "notes": "Slow, controlled; low back to floor."}], "conditioning": "Optional: 8–10 min easy walk post‑lift.", "duration_min": 50}, {"day": "Wed", "focus": "Rest", "blocks": [], "duration_min": 0}, {"day": "Thu", "focus": "Upper Pull + Arms", "blocks": [{"rpe": 7, "name": "1‑Arm DB Row", "reps": "10/side", "sets": 3, "notes": "2 min rest. Pull to hip; pause 1 sec at top."}, {"rpe": 7, "name": "DB Rear Delt Fly", "reps": "12", "sets": 3, "notes": "60–90 sec rest. Slight torso hinge; pinkies high."}, {"rpe": 7, "name": "DB Pullover (bench or floor)", "reps": "10", "sets": 2, "notes": "90 sec rest. Keep ribs down; feel lats."}, {"rpe": 7, "name": "DB Hammer Curl", "reps": "10", "sets": 3, "notes": "75–90 sec rest. Full range; control eccentric."}, {"rpe": 6, "name": "DB Biceps Curl (supinated)", "reps": "12", "sets": 2, "notes": "60–75 sec rest. Don’t swing; squeeze at top."}], "conditioning": "Optional: 6–8 min easy jump rope or step count boost.", "duration_min": 55}, {"day": "Fri", "focus": "Conditioning + Arms + Core", "blocks": [{"rpe": 7, "name": "DB Complex (RDL → Row → Clean → Push Press)", "reps": "5 each/round", "sets": 5, "notes": "90 sec rest between rounds. Use one pair of DBs; no drops during round."}, {"rpe": 7, "name": "Farmer Carry", "reps": "30–40 m", "sets": 5, "notes": "Tall posture; anti‑tilt core."}, {"rpe": 7, "name": "Alternating DB Curl", "reps": "12 (total)", "sets": 3, "notes": "60–75 sec rest. Supinated; strict form."}, {"rpe": 7, "name": "DB Triceps Kickback", "reps": "12", "sets": 3, "notes": "60–75 sec rest. Upper arm parallel to floor."}, {"rpe": 6, "name": "Front Plank", "reps": "45 sec", "sets": 3, "notes": "Nasal breathing; glutes on."}], "conditioning": "Primary work is the complex/carries—keep heart rate conversational.", "duration_min": 50}, {"day": "Sat", "focus": "Lower (Posterior/Glutes Emphasis)", "blocks": [{"rpe": 7, "name": "DB Romanian Deadlift", "reps": "10", "sets": 3, "notes": "2 min rest. Hips back; shins mostly vertical."}, {"rpe": 7, "name": "DB Hip Thrust (floor or bench)", "reps": "12", "sets": 3, "notes": "90 sec rest. 1–2 sec squeeze at top."}, {"rpe": 7, "name": "DB Step‑Up", "reps": "10/side", "sets": 2, "notes": "90 sec rest. Drive through whole foot; control down."}, {"rpe": 7, "name": "Paused Goblet Squat (2‑sec)", "reps": "8", "sets": 2, "notes": "2 min rest. Stay braced in the hole."}, {"rpe": 6, "name": "Single‑Leg Calf Raise (DB supported)", "reps": "12/side", "sets": 2, "notes": "60–75 sec rest. Full range."}], "conditioning": "Optional: 8–10 min easy walk or bike.", "duration_min": 50}, {"day": "Sun", "focus": "Rest", "blocks": [], "duration_min": 0}], "week": 1, "theme": "Foundation", "recovery": {"breathwork": "Daily: 5 min box breathing (4‑4‑4‑4) or 6 breaths/min nasal. Rest days: add 10–15 min easy walk + 10 min gentle mobility (hips, T‑spine, shoulders). Post‑lift: 3–5 min easy nasal breathing cooldown.", "mobility_min": 10, "sleep_target_h": 8}, "nutrition": {"notes": "Distribute protein across 3–5 meals (25–40 g each). Center most carbs around training; prioritize fruit/veg and minimally processed foods. Hydrate with ~500 ml water in the first hour after waking and before training.", "daily_kcal_band": "Maintenance ±200 kcal", "protein_g_per_kg": 1.8}}, {"days": [{"day": "Mon", "focus": "Upper Push + Arms", "blocks": [{"rpe": 8, "name": "DB Flat Bench Press", "reps": "8", "sets": 4, "notes": "2–3 min rest. Add small load if W1 was ≤RPE7."}, {"rpe": 8, "name": "DB Incline Press", "reps": "10", "sets": 3, "notes": "90 sec rest. Maintain shoulder retraction."}, {"rpe": 8, "name": "DB Seated Shoulder Press", "reps": "8", "sets": 4, "notes": "2 min rest. Smooth lockout; no grinding."}, {"rpe": 7, "name": "DB Lateral Raise", "reps": "12–15", "sets": 3, "notes": "60–75 sec rest. Control top/bottom range."}, {"rpe": 8, "name": "DB Overhead Triceps Extension (2‑hand)", "reps": "10", "sets": 4, "notes": "75–90 sec rest. Keep elbows from flaring."}], "conditioning": "Optional finisher: 8–10 min brisk walk, nasal breathing.", "duration_min": 60}, {"day": "Tue", "focus": "Lower Body + Core", "blocks": [{"rpe": 8, "name": "DB Goblet Squat", "reps": "8", "sets": 4, "notes": "2–3 min rest. Slight load bump if form solid."}, {"rpe": 8, "name": "DB Romanian Deadlift", "reps": "8", "sets": 4, "notes": "2 min rest. Feel hamstrings; neutral spine."}, {"rpe": 8, "name": "DB Reverse Lunge", "reps": "10/side", "sets": 3, "notes": "90 sec rest. Tall posture; light torso lean."}, {"rpe": 8, "name": "DB Standing Calf Raise", "reps": "15", "sets": 3, "notes": "60–75 sec rest. Pause at stretch/peak."}, {"rpe": 6, "name": "Side Plank", "reps": "45 sec/side", "sets": 3, "notes": "Ribs down; glutes engaged."}, {"rpe": 6, "name": "Dead Bug", "reps": "8/side", "sets": 3, "notes": "Slow exhale; brace before each rep."}], "conditioning": "Optional: 8–12 min Zone 2 walk post‑lift.", "duration_min": 55}, {"day": "Wed", "focus": "Rest", "blocks": [], "duration_min": 0}, {"day": "Thu", "focus": "Upper Pull + Arms", "blocks": [{"rpe": 8, "name": "1‑Arm DB Row", "reps": "10/side", "sets": 4, "notes": "2 min rest. Pull from lat; slight pause at top."}, {"rpe": 7, "name": "DB Rear Delt Fly", "reps": "12–15", "sets": 3, "notes": "60–90 sec rest. Sweep wide; no shrugging."}, {"rpe": 8, "name": "DB Pullover", "reps": "10", "sets": 3, "notes": "90 sec rest. Keep ribs stacked."}, {"rpe": 8, "name": "DB Hammer Curl", "reps": "10", "sets": 4, "notes": "75–90 sec rest. Full range; steady tempo."}, {"rpe": 7, "name": "DB Biceps Curl (supinated)", "reps": "12", "sets": 3, "notes": "60–75 sec rest. Squeeze at top."}], "conditioning": "Optional: 8 min easy steps or rope.", "duration_min": 60}, {"day": "Fri", "focus": "Conditioning + Arms + Core", "blocks": [{"rpe": 8, "name": "DB Complex (RDL → Row → Clean → Push Press)", "reps": "5 each/round", "sets": 6, "notes": "90 sec rest. Choose load to finish strong without form breakdown."}, {"rpe": 8, "name": "Farmer Carry", "reps": "30–40 m", "sets": 6, "notes": "Braced torso; steady pace."}, {"rpe": 8, "name": "Alternating DB Curl", "reps": "12–15 (total)", "sets": 3, "notes": "60–75 sec rest. Keep elbows pinned."}, {"rpe": 8, "name": "DB Triceps Kickback", "reps": "12–15", "sets": 3, "notes": "60–75 sec rest. Squeeze at lockout."}, {"rpe": 6, "name": "Front Plank", "reps": "60 sec", "sets": 3, "notes": "Nasal breathing; maintain neutral spine."}], "conditioning": "Keep HR in low‑to‑mid Zone 2 throughout.", "duration_min": 55}, {"day": "Sat", "focus": "Lower (Posterior/Glutes Emphasis)", "blocks": [{"rpe": 8, "name": "DB Romanian Deadlift", "reps": "10", "sets": 4, "notes": "2 min rest. Hips back; strong lats."}, {"rpe": 8, "name": "DB Hip Thrust", "reps": "12", "sets": 4, "notes": "90 sec rest. Full hip lockout; slow lower."}, {"rpe": 8, "name": "DB Step‑Up", "reps": "10/side", "sets": 3, "notes": "90 sec rest. Control eccentric; stable knee."}, {"rpe": 8, "name": "Paused Goblet Squat (2‑sec)", "reps": "8", "sets": 3, "notes": "2 min rest. Stay braced in the hole."}, {"rpe": 7, "name": "Single‑Leg Calf Raise (DB supported)", "reps": "12/side", "sets": 3, "notes": "60–75 sec rest. Full ROM, balance first."}], "conditioning": "Optional: 10 min easy walk or cycle.", "duration_min": 55}, {"day": "Sun", "focus": "Rest", "blocks": [], "duration_min": 0}], "week": 2, "theme": "Build", "recovery": {"breathwork": "Daily: 5–8 min slow nasal breathing (4–6 breaths/min). Rest days: 15–20 min easy walk + 10–12 min mobility flow (hips/ankles/T‑spine/shoulders). After hard sessions: 3 min down‑regulation (inhale 4s, exhale 6–8s).", "mobility_min": 12, "sleep_target_h": 8}, "nutrition": {"notes": "Slightly favor carbs pre/post‑training (fruit, oats, rice, potatoes). Keep protein steady; include 20–30 g protein in your last meal to support sleep.", "daily_kcal_band": "Maintenance to +150 kcal", "protein_g_per_kg": 1.8}}, {"days": [{"day": "Mon", "focus": "Upper Push + Arms", "blocks": [{"rpe": 9, "name": "DB Flat Bench Press", "reps": "6–8", "sets": 4, "notes": "2–3 min rest. Add load; leave ~1 rep in reserve."}, {"rpe": 9, "name": "DB Incline Press", "reps": "8–10", "sets": 3, "notes": "90–120 sec rest. Solid scapular position."}, {"rpe": 9, "name": "DB Seated Shoulder Press", "reps": "6–8", "sets": 4, "notes": "2 min rest. No grind; strong lockout."}, {"rpe": 8, "name": "DB Lateral Raise", "reps": "12–15", "sets": 3, "notes": "60–75 sec rest. Smooth top range; slight lean allowed."}, {"rpe": 9, "name": "DB Overhead Triceps Extension (2‑hand)", "reps": "8–10", "sets": 4, "notes": "75–90 sec rest. Keep elbows narrow; full stretch."}], "conditioning": "Optional 8–10 min brisk walk; nasal-only breathing to recover.", "duration_min": 60}, {"day": "Tue", "focus": "Lower Body + Core", "blocks": [{"rpe": 9, "name": "DB Goblet Squat", "reps": "6–8", "sets": 4, "notes": "2–3 min rest. Braced torso; drive evenly through feet."}, {"rpe": 9, "name": "DB Romanian Deadlift", "reps": "6–8", "sets": 4, "notes": "2 min rest. Maintain tension; no hitching."}, {"rpe": 9, "name": "DB Reverse Lunge", "reps": "8–10/side", "sets": 3, "notes": "90 sec rest. Upright chest; smooth tempo."}, {"rpe": 8, "name": "DB Standing Calf Raise", "reps": "12–15", "sets": 4, "notes": "60–75 sec rest. Pause at peak/stretch."}, {"rpe": 7, "name": "Side Plank", "reps": "60–75 sec/side", "sets": 3, "notes": "Straight line head‑to‑heel; steady breath."}, {"rpe": 7, "name": "Dead Bug", "reps": "10/side", "sets": 3, "notes": "Slow exhale; ribs down."}], "conditioning": "Optional: 10–12 min Zone 2 walk post‑lift.", "duration_min": 60}, {"day": "Wed", "focus": "Rest", "blocks": [], "duration_min": 0}, {"day": "Thu", "focus": "Upper Pull + Arms", "blocks": [{"rpe": 9, "name": "1‑Arm DB Row", "reps": "8–10/side", "sets": 4, "notes": "2 min rest. Pull to hip; strong pause at top."}, {"rpe": 8, "name": "DB Rear Delt Fly", "reps": "15", "sets": 3, "notes": "60–90 sec rest. Control; no swinging."}, {"rpe": 9, "name": "DB Pullover", "reps": "8–10", "sets": 3, "notes": "90 sec rest. Lats engaged; ribs down."}, {"rpe": 9, "name": "DB Hammer Curl", "reps": "8–10", "sets": 4, "notes": "75–90 sec rest. Full ROM; last 2 reps challenging."}, {"rpe": 8, "name": "DB Biceps Curl (supinated)", "reps": "10–12", "sets": 3, "notes": "60–75 sec rest. Squeeze hard; slow lower."}], "conditioning": "Optional: 8–10 min easy steps to cool down.", "duration_min": 60}, {"day": "Fri", "focus": "Conditioning + Arms + Core", "blocks": [{"rpe": 9, "name": "DB Complex (RDL → Row → Clean → Push Press)", "reps": "4–5 each/round", "sets": 7, "notes": "90 sec rest. Keep quality high; stop if form degrades."}, {"rpe": 8, "name": "Farmer Carry", "reps": "40–50 m", "sets": 6, "notes": "Braced, steady steps; no rushing."}, {"rpe": 9, "name": "Alternating DB Curl", "reps": "10–12 (total)", "sets": 4, "notes": "60–75 sec rest. Strict form; slight load bump if needed."}, {"rpe": 9, "name": "DB Triceps Kickback", "reps": "10–12", "sets": 4, "notes": "60–75 sec rest. Pause at lockout."}, {"rpe": 7, "name": "Front Plank", "reps": "60–75 sec", "sets": 3, "notes": "Focus on long exhales to recover."}], "conditioning": "Primary is the complex and carries; breathe nasally between sets.", "duration_min": 55}, {"day": "Sat", "focus": "Lower (Posterior/Glutes Emphasis)", "blocks": [{"rpe": 9, "name": "DB Romanian Deadlift", "reps": "8", "sets": 4, "notes": "2 min rest. Brace hard; smooth hips back."}, {"rpe": 9, "name": "DB Hip Thrust", "reps": "10–12", "sets": 4, "notes": "90 sec rest. 1–2 sec squeeze at top."}, {"rpe": 9, "name": "DB Step‑Up", "reps": "10/side", "sets": 3, "notes": "90 sec rest. Control down; light touch."}, {"rpe": 9, "name": "Paused Goblet Squat (2‑sec)", "reps": "6–8", "sets": 3, "notes": "2 min rest. Maintain tension in the hole."}, {"rpe": 8, "name": "Single‑Leg Calf Raise (DB supported)", "reps": "15/side", "sets": 3, "notes": "60–75 sec rest. Full ROM."}], "conditioning": "Optional: 10 min easy walk; shake out legs.", "duration_min": 60}, {"day": "Sun", "focus": "Rest", "blocks": [], "duration_min": 0}], "week": 3, "theme": "Push", "recovery": {"breathwork": "Daily: 6–8 min slow nasal breathing before bed. Rest days: 20–30 min easy walk + 10–12 min mobility. After sessions: 3–5 min extended exhale breathing (inhale 4s, exhale 6–8s).", "mobility_min": 12, "sleep_target_h": 8.2}, "nutrition": {"notes": "Fuel the push week: add 20–40 g extra carbs pre‑ and/or post‑workout. Keep sodium/potassium adequate (salt foods to taste, include fruit/veg). Consider 1–2 g EPA/DHA if diet is low in fatty fish.", "daily_kcal_band": "Maintenance to +200 kcal", "protein_g_per_kg": 1.8}}, {"days": [{"day": "Mon", "focus": "Upper Push + Arms", "blocks": [{"rpe": 7, "name": "DB Flat Bench Press", "reps": "8", "sets": 2, "notes": "2 min rest. Use ~80–85% of W3 load."}, {"rpe": 7, "name": "DB Incline Press", "reps": "10", "sets": 2, "notes": "90 sec rest. Smooth tempo."}, {"rpe": 7, "name": "DB Seated Shoulder Press", "reps": "8", "sets": 2, "notes": "2 min rest. No grinder reps."}, {"rpe": 6, "name": "DB Lateral Raise", "reps": "12", "sets": 2, "notes": "60 sec rest. Easy quality reps."}, {"rpe": 7, "name": "DB Overhead Triceps Extension (2‑hand)", "reps": "10", "sets": 2, "notes": "75 sec rest. Full range without strain."}], "conditioning": "Optional: 8 min easy walk; keep HR very easy.", "duration_min": 45}, {"day": "Tue", "focus": "Lower Body + Core", "blocks": [{"rpe": 7, "name": "DB Goblet Squat", "reps": "8", "sets": 2, "notes": "2 min rest. Submaximal; prioritize positions."}, {"rpe": 7, "name": "DB Romanian Deadlift", "reps": "8", "sets": 2, "notes": "2 min rest. Smooth hinge; no stretch discomfort."}, {"rpe": 7, "name": "DB Reverse Lunge", "reps": "8/side", "sets": 2, "notes": "90 sec rest. Controlled steps."}, {"rpe": 6, "name": "DB Standing Calf Raise", "reps": "12", "sets": 2, "notes": "60 sec rest. Easy tempo."}, {"rpe": 6, "name": "Side Plank", "reps": "45 sec/side", "sets": 2, "notes": "Relaxed breathing."}, {"rpe": 6, "name": "Dead Bug", "reps": "8/side", "sets": 2, "notes": "Slow, smooth reps."}], "conditioning": "Optional: 8–10 min Zone 1 walk post‑lift.", "duration_min": 45}, {"day": "Wed", "focus": "Rest", "blocks": [], "duration_min": 0}, {"day": "Thu", "focus": "Upper Pull + Arms", "blocks": [{"rpe": 7, "name": "1‑Arm DB Row", "reps": "10/side", "sets": 2, "notes": "2 min rest. Keep reps crisp."}, {"rpe": 6, "name": "DB Rear Delt Fly", "reps": "12", "sets": 2, "notes": "60–75 sec rest. Gentle range."}, {"rpe": 7, "name": "DB Pullover", "reps": "10", "sets": 2, "notes": "90 sec rest. Easy, controlled."}, {"rpe": 7, "name": "DB Hammer Curl", "reps": "12", "sets": 2, "notes": "60–75 sec rest. Leave 3+ reps in reserve."}, {"rpe": 7, "name": "DB Biceps Curl (supinated)", "reps": "12", "sets": 2, "notes": "60–75 sec rest. No swinging."}], "conditioning": "Optional: 6–8 min easy steps; breathe through nose only.", "duration_min": 45}, {"day": "Fri", "focus": "Conditioning + Arms + Core", "blocks": [{"rpe": 7, "name": "DB Complex (RDL → Row → Clean → Push Press)", "reps": "4–5 each/round", "sets": 4, "notes": "90 sec rest. Keep it smooth, not hard."}, {"rpe": 7, "name": "Farmer Carry", "reps": "30 m", "sets": 4, "notes": "Relax shoulders; easy pace."}, {"rpe": 7, "name": "Alternating DB Curl", "reps": "12 (total)", "sets": 2, "notes": "60–75 sec rest. Controlled form."}, {"rpe": 7, "name": "DB Triceps Kickback", "reps": "12", "sets": 2, "notes": "60–75 sec rest. Moderate tempo."}, {"rpe": 6, "name": "Front Plank", "reps": "45 sec", "sets": 2, "notes": "Nasal breathing; relax neck/shoulders."}], "conditioning": "Keep all work easy and technical.", "duration_min": 45}, {"day": "Sat", "focus": "Lower (Posterior/Glutes Emphasis)", "blocks": [{"rpe": 7, "name": "DB Romanian Deadlift", "reps": "10", "sets": 2, "notes": "2 min rest. Reduce load from W3."}, {"rpe": 7, "name": "DB Hip Thrust", "reps": "12", "sets": 2, "notes": "90 sec rest. Comfortable squeeze at top."}, {"rpe": 7, "name": "DB Step‑Up", "reps": "8/side", "sets": 2, "notes": "90 sec rest. Stable, controlled."}, {"rpe": 7, "name": "Paused Goblet Squat (2‑sec)", "reps": "6–8", "sets": 2, "notes": "2 min rest. Keep bracing consistent."}, {"rpe": 6, "name": "Single‑Leg Calf Raise (DB supported)", "reps": "12/side", "sets": 2, "notes": "60–75 sec rest. Easy ROM."}], "conditioning": "Optional: 8–10 min easy walk or mobility flow.", "duration_min": 45}, {"day": "Sun", "focus": "Rest", "blocks": [], "duration_min": 0}], "week": 4, "theme": "Consolidate/Deload", "recovery": {"breathwork": "Daily: 5–8 min box or 4‑7‑8 breathing to downshift. Rest days: 20–30 min easy walk + 10–12 min mobility. Keep overall stress low; short outdoor time daily.", "mobility_min": 12, "sleep_target_h": 8.2}, "nutrition": {"notes": "Slightly reduce carbs/fats on rest and lighter days if appetite is low. Keep protein and hydration high to aid recovery.", "daily_kcal_band": "Maintenance to -150 kcal", "protein_g_per_kg": 1.8}}], "weekly_check_targets": {"workouts": 5, "hydration_l": 3.2, "sleep_avg_h": 8, "perfect_days": 4}}	Here’s a focused, dumbbell-only 4‑week block built for general health with an arms emphasis. You’ll train 5 days/week with conservative volume, clear RPE targets (6–9), and simple progressions week to week (foundation → build → push → consolidate). Hit the weekly checks, move with control, and add load or reps only when you stay within the prescribed RPE range.	openai/gpt-5	2026-05-02	2026-05-02 16:00:00.527969+00	2026-05-02 16:00:00.527969+00
2105ed9a-316a-4ec7-8fa6-3e12d4b40c23	63752d9b-c1ce-498f-9994-d38c462c3c6b	active	all	auto	4	Barbell, Dumbbells, Pull-up bar, Cold plunge, Treadmill	{Shoulders,Back,Chest,Arms,Core,Legs}	treenaan myös thainyrkkeilyä ja olen käynyt salilla 10 vuotta	4	{"weeks": [{"days": [{"day": "Mon", "focus": "Full-body Strength A", "blocks": [{"alt": "Heavy DB Goblet Squat", "rpe": 7, "name": "Back Squat (HB/lowbar valinnalla)", "reps": "5", "sets": 4, "notes": "Syvä, jännite koko ajan. Avaa polvet ulos, pidä core tiukkana. Tavoite: johdonmukainen tekniikka, jätä 2–3 toistoa varastoon.", "tempo": "3-1-1-0", "rest_sec": 150}, {"alt": "DB Floor Press", "rpe": 7, "name": "Barbell Bench Press", "reps": "6", "sets": 4, "notes": "Lapaluut takana ja alhaalla, jaloilla tukea penkkiin. Pidä tankolinja rinta–leuka väliin.", "tempo": "2-1-1-0", "rest_sec": 120}, {"alt": "Barbell Inverted Row (power rack)", "rpe": 7, "name": "Pull-up (pronated)", "reps": "6-8", "sets": 4, "notes": "Täysi ripustus, vedä kyynärpäillä kylkiin. Jos 8 helppoa, lisää painoa vyölle/jalkojen väliin DB:llä.", "tempo": "2-1-1-1", "rest_sec": 120}, {"alt": "DB RDL", "rpe": 7, "name": "Romanian Deadlift", "reps": "8", "sets": 3, "notes": "Lantio taakse, selkä neutraali. Liike pysyy pakaroissa/hamseissa—älä anna tangon irrota jaloista.", "tempo": "3-0-1-0", "rest_sec": 120}, {"alt": "Suitcase Carry (yksi DB kerrallaan) 30 m/puoli", "rpe": 6, "name": "Farmer Carry (DB)", "reps": "40 m", "sets": 3, "notes": "Rinta ylhäällä, askel napakka. Älä anna DB:n vetää vartaloa sivulle.", "tempo": "", "rest_sec": 60}], "warmup": "4–5 min: 1) 1 min kevyttä kävelyä/juoksua, 2) dynaamiset nilkka/kokovartalo (leg swings, arm circles), 3) 2 ramp‑sarjaa kyykkyyn (5 toistoa kevyesti + 3 keskikevyesti).", "cooldown": "3–4 min: rintarangan avaukset + lonkan avaukset, 2 min nenähengitystä. (Kylmäaltaan dippi 2–3 min erikseen, jos haluat.)", "conditioning": "", "duration_min": 80}, {"day": "Tue", "focus": "Full-body Hypertrophy + Engine", "blocks": [{"alt": "Barbell Split Squat", "rpe": 7, "name": "DB Bulgarian Split Squat", "reps": "8/puoli", "sets": 3, "notes": "Polvi eteen, kanta maassa. Pidä lantio neliönä—paloa etureidessä ja pakarassa.", "tempo": "3-1-1-0", "rest_sec": 90}, {"alt": "Seated DB Shoulder Press", "rpe": 7, "name": "Barbell Overhead Press", "reps": "5", "sets": 4, "notes": "Gluteet tiukaksi, kylkiluut alas. Purista tankoa, työnnä suoraan ylös.", "tempo": "2-1-1-0", "rest_sec": 120}, {"alt": "Barbell Bent‑over Row", "rpe": 7, "name": "One‑arm DB Row (penkin tuki optional)", "reps": "10/puoli", "sets": 3, "notes": "Kyynärpää kaartuu taskuun, lapaluu liukuu. Älä kierrä vartaloa.", "tempo": "2-1-1-1", "rest_sec": 90}, {"alt": "DB Hip Thrust / Glute Bridge", "rpe": 7, "name": "Barbell Hip Thrust", "reps": "10", "sets": 3, "notes": "Leuka sisään, lantio täyteen lukkoon, 1 s puristus yläasennossa.", "tempo": "2-1-1-1", "rest_sec": 90}, {"alt": "DB Dead Bug 10/puoli", "rpe": 7, "name": "Hanging Knee Raise", "reps": "10-12", "sets": 3, "notes": "Lantiokippi, nosta polvet rintaa kohti ilman heilumista.", "tempo": "2-1-1-1", "rest_sec": 60}], "warmup": "4–5 min: 2 min kevyt kävely/juoksu + dynaamiset lonkka/olkapää (world’s greatest stretch, banditonta YTWL kevyesti), 2 ramp‑sarjaa OHP:hen.", "cooldown": "3–4 min: rintakehän avaus seinää vasten + lonkankoukistaja, 2 min nenähengitys. (Kylmäallas erikseen ok.)", "conditioning": "Treadmill: 6 kierrosta → 30 s kova (RPE 8) + 60 s kävely. 2 min veryttely ennen ja jälkeen.", "duration_min": 88}, {"day": "Wed", "focus": "Rest", "blocks": [], "warmup": "", "cooldown": "", "duration_min": 0}, {"day": "Thu", "focus": "Full-body Strength B", "blocks": [{"alt": "Barbell Rack Pull (alle polven)", "rpe": 7, "name": "Conventional Deadlift", "reps": "4", "sets": 4, "notes": "Jalkavoima ensin, tanko kiinni sääressä. Lukitse yläasento, palauta hallitusti.", "tempo": "2-1-1-0", "rest_sec": 180}, {"alt": "Double DB Front Squat", "rpe": 7, "name": "Front Squat", "reps": "5", "sets": 3, "notes": "Kyynärpäät ylhäällä, pysy pystympänä. Keskikroppa tiukkana koko sarjan.", "tempo": "3-1-1-0", "rest_sec": 150}, {"alt": "DB Neutral‑grip Bench / Floor Press", "rpe": 7, "name": "Close‑grip Barbell Bench", "reps": "6", "sets": 4, "notes": "Pidä kyynärpäät 30–45° kyljestä, työnnä lattiaa jaloilla.", "tempo": "2-1-1-0", "rest_sec": 120}, {"alt": "Underhand Barbell Inverted Row", "rpe": 7, "name": "Chin‑up (supinated)", "reps": "6", "sets": 3, "notes": "Rinta tankoon, 1 s pito ylhäällä.", "tempo": "2-1-1-1", "rest_sec": 120}, {"alt": "Hollow Body Hold 30–40 s", "rpe": 6, "name": "Side Plank + DB Reach", "reps": "30 s/puoli", "sets": 3, "notes": "Lantio korkealla, kylki tekee töitä. Pidä ranka pitkänä.", "tempo": "", "rest_sec": 45}], "warmup": "4–5 min: 1 min kevyt juoksu/kävely, lonkan ja nilkan dynaamiset + 2 ramp‑sarjaa maastavetoon (5 + 3).", "cooldown": "3–4 min: takaketjun venytys (hamstring hinge), rintarangan kierto, 2 min rauhallista hengitystä.", "conditioning": "", "duration_min": 85}, {"day": "Fri", "focus": "Power/Upper + Engine", "blocks": [{"alt": "Barbell Push Press", "rpe": 7, "name": "DB Push Press", "reps": "4", "sets": 4, "notes": "Pieni dip, räjähtävä työntö. Pidä polvi-linja stabiilina, alhaalla jarru pois.", "tempo": "1-0-1-0", "rest_sec": 120}, {"alt": "Pull‑up (neutraali/pronated)", "rpe": 7, "name": "Barbell Bent‑over Row", "reps": "8", "sets": 4, "notes": "Rinta ylpeänä, vedä kyynärpäillä. Älä nykäise selällä.", "tempo": "2-1-1-0", "rest_sec": 120}, {"alt": "DB Floor Press 3x10", "rpe": 7, "name": "Feet‑elevated Push‑up (weighted)", "reps": "12", "sets": 3, "notes": "Koko kropan jännite, rinta maahan asti kontrollilla.", "tempo": "2-1-1-0", "rest_sec": 90}, {"alt": "DB Walking Lunge", "rpe": 7, "name": "Barbell Reverse Lunge", "reps": "8/puoli", "sets": 3, "notes": "Pitkä askel taakse, etummaisen jalan kantapää maassa.", "tempo": "2-1-1-0", "rest_sec": 90}, {"alt": "Bent‑over DB L‑Raise", "rpe": 7, "name": "DB Rear Delt Fly", "reps": "12", "sets": 3, "notes": "Pikkupaino, polte takaolkapäissä. Peukalot hieman ylöspäin.", "tempo": "2-1-2-1", "rest_sec": 60}], "warmup": "4–5 min: kevyttä juoksua 2 min, olkapäiden dynaamiset + 2 ramp‑sarjaa push pressiin.", "cooldown": "3–4 min: lapaluiden liu’ut seinää vasten, rintalihas venytys + 2 min nenähengitys.", "conditioning": "Treadmill: 12–15 min tasainen (RPE 6–7) tai 5–8% nousu reipas kävely.", "duration_min": 88}, {"day": "Sat", "focus": "Rest", "blocks": [], "warmup": "", "cooldown": "", "duration_min": 0}, {"day": "Sun", "focus": "Rest", "blocks": [], "warmup": "", "cooldown": "", "duration_min": 0}], "week": 1, "theme": "Base: tekninen liike, tasainen volyymi, maltillinen intensiteetti.", "recovery": {"breathwork": "2x/päivä 3–5 min nenähengitys tai 4–7–8; treenin jälkeen 2 min downshift.", "mobility_min": 10, "sleep_target_h": 8}, "nutrition": {"notes": "Gluteeniton + laktoositon. Syö 3–4 pääateriaa + 1–2 välipalaa. Hiilarit treenin ympärille (50–80 g ennen ja jälkeen), proteiini 30–45 g/ateria, hyvä rasva 15–25 g/ateria. Helppoja GF/LF ideoita: riisi + kananpaisti, peruna + lohi, munakas + kauraleipä (GF), kreikkalainen tyyli laktoosittomalla jogurtilla. Juoma: 3.5–4 L/vrk, lisää 0.5–1 L Muay Thai -päivinä.", "daily_kcal_band": "2400–2800 kcal", "protein_g_per_kg": 2}, "progression_note": "Aloitusviikko. RPE pääosin ~7:lla, opetetaan rungolle liikeradat ja rakennetaan työkapasiteetti. Kaksi lyhyttä juoksukunto‑slottia käyntiin."}, {"days": [{"day": "Mon", "focus": "Full-body Strength A", "blocks": [{"alt": "Heavy DB Goblet Squat", "rpe": 7.5, "name": "Back Squat", "reps": "5", "sets": 5, "notes": "Lisää 2.5–5% painoa vs vko1 jos tekniikka säilyy.", "tempo": "3-1-1-0", "rest_sec": 150}, {"alt": "DB Floor Press", "rpe": 7.5, "name": "Barbell Bench Press", "reps": "6", "sets": 5, "notes": "Pysäytä kevyesti rinnassa, ajetaan ulos jaloilla tukea käyttäen.", "tempo": "2-1-1-0", "rest_sec": 120}, {"alt": "Barbell Inverted Row", "rpe": 7.5, "name": "Pull-up (pronated)", "reps": "8", "sets": 4, "notes": "Jos 8 helppoa, lisää painoa 2.5–5 kg.", "tempo": "2-1-1-1", "rest_sec": 120}, {"alt": "DB RDL", "rpe": 7.5, "name": "Romanian Deadlift", "reps": "8", "sets": 4, "notes": "Pidä viimeinen toisto siistinä—ei pomppua polvien yli.", "tempo": "3-0-1-0", "rest_sec": 120}, {"alt": "Suitcase Carry 30 m/puoli", "rpe": 6.5, "name": "Farmer Carry (DB)", "reps": "40 m", "sets": 4, "notes": "Kireä keskikroppa, tasainen askel.", "tempo": "", "rest_sec": 60}], "warmup": "4–5 min: 1 min kävely/jog + dynaamiset + ramp‑sarjat kyykkyyn (5 + 3).", "cooldown": "3–4 min: lonkan ja rintarangan avaukset, 2 min nenähengitys.", "conditioning": "", "duration_min": 88}, {"day": "Tue", "focus": "Full-body Hypertrophy + Engine", "blocks": [{"alt": "Barbell Split Squat", "rpe": 7.5, "name": "DB Bulgarian Split Squat", "reps": "8/puoli", "sets": 4, "notes": "Sama liikerata, hieman raskaampi kahva.", "tempo": "3-1-1-0", "rest_sec": 90}, {"alt": "Seated DB Shoulder Press", "rpe": 7.5, "name": "Barbell Overhead Press", "reps": "5", "sets": 5, "notes": "Viimeinen 1–2 toistoa hitaita mutta puhtaita.", "tempo": "2-1-1-0", "rest_sec": 120}, {"alt": "Barbell Bent‑over Row", "rpe": 7.5, "name": "One‑arm DB Row", "reps": "10/puoli", "sets": 4, "notes": "Pidä lantio neliönä, älä kierrä.", "tempo": "2-1-1-1", "rest_sec": 90}, {"alt": "DB Hip Thrust", "rpe": 7.5, "name": "Barbell Hip Thrust", "reps": "10", "sets": 4, "notes": "Topissa 1 s puristus.", "tempo": "2-1-1-1", "rest_sec": 90}, {"alt": "DB Dead Bug 12/puoli", "rpe": 7, "name": "Hanging Knee Raise", "reps": "12", "sets": 4, "notes": "Hallittu liike, ei heilumista.", "tempo": "2-1-1-1", "rest_sec": 60}], "warmup": "4–5 min: 2 min kevyttä juoksua, dynaamiset + 2 ramp‑sarjaa OHP:hen.", "cooldown": "3–4 min: rintakehän avaus + lonkankoukistaja, 2 min hengitys.", "conditioning": "Treadmill: 8 kierrosta → 30 s kova (RPE 8) + 60 s kävely. 2–3 min veryttely ennen/jälkeen.", "duration_min": 90}, {"day": "Wed", "focus": "Rest", "blocks": [], "warmup": "", "cooldown": "", "duration_min": 0}, {"day": "Thu", "focus": "Full-body Strength B", "blocks": [{"alt": "Barbell Rack Pull (alle polven)", "rpe": 7.5, "name": "Conventional Deadlift", "reps": "4", "sets": 5, "notes": "Lisää 2.5–5% jos tanko pysyy tiellä ja selkä neutraalina.", "tempo": "2-1-1-0", "rest_sec": 180}, {"alt": "Double DB Front Squat", "rpe": 7.5, "name": "Front Squat", "reps": "5", "sets": 4, "notes": "Kyynärpäät korkealle—rintakehä ei romahda.", "tempo": "3-1-1-0", "rest_sec": 150}, {"alt": "DB Neutral‑grip Bench / Floor Press", "rpe": 7.5, "name": "Close‑grip Barbell Bench", "reps": "5", "sets": 5, "notes": "Kova työntö lukoon asti—älä menetä lapojen tukea.", "tempo": "2-1-1-0", "rest_sec": 120}, {"alt": "Underhand Barbell Inverted Row", "rpe": 7.5, "name": "Chin‑up (supinated)", "reps": "6", "sets": 4, "notes": "Lisää lisäpaino kun valmis.", "tempo": "2-1-1-1", "rest_sec": 120}, {"alt": "Hollow Body Hold 35–45 s", "rpe": 6.5, "name": "Side Plank + DB Reach", "reps": "35 s/puoli", "sets": 3, "notes": "Hengitä kylkiin, lantio ylhäällä.", "tempo": "", "rest_sec": 45}], "warmup": "4–5 min: kevyt jog/kävely + dynaamiset nilkka/lonkka + ramp‑sarjat maastavetoon.", "cooldown": "3–4 min: takaketju + rintaranka, 2 min rauhoittava hengitys.", "conditioning": "", "duration_min": 90}, {"day": "Fri", "focus": "Power/Upper + Engine", "blocks": [{"alt": "Barbell Push Press", "rpe": 7.5, "name": "DB Push Press", "reps": "4", "sets": 5, "notes": "Räjähtävyys ensin, sitten rauta. Hae samanlainen nopeus joka sarjaan.", "tempo": "1-0-1-0", "rest_sec": 120}, {"alt": "Pull‑up (neutraali/pronated)", "rpe": 7.5, "name": "Barbell Bent‑over Row", "reps": "8", "sets": 5, "notes": "Pidä lantiokulma vakiona, vedä alavatsaa kohti.", "tempo": "2-1-1-0", "rest_sec": 120}, {"alt": "DB Floor Press 4x10", "rpe": 7.5, "name": "Feet‑elevated Push‑up (weighted)", "reps": "12", "sets": 4, "notes": "Lisää levy/DB selkään jos helppo.", "tempo": "2-1-1-0", "rest_sec": 90}, {"alt": "DB Walking Lunge", "rpe": 7.5, "name": "Barbell Reverse Lunge", "reps": "8/puoli", "sets": 4, "notes": "Polvi varpaiden suuntaan, tasainen painonsiirto.", "tempo": "2-1-1-0", "rest_sec": 90}, {"alt": "Bent‑over DB L‑Raise", "rpe": 7.5, "name": "DB Rear Delt Fly", "reps": "12", "sets": 4, "notes": "Liikerata pieni, tunne palaminen.", "tempo": "2-1-2-1", "rest_sec": 60}], "warmup": "4–5 min: 2 min kevyt juoksu, olkapään aktivoinnit + 2 ramp‑sarjaa push pressiin.", "cooldown": "3–4 min: rintalihas + takaolkapää, 2 min nenähengitys.", "conditioning": "Treadmill: 15–18 min tasainen (RPE 6–7) tai 5–8% nousu reipas kävely.", "duration_min": 90}, {"day": "Sat", "focus": "Rest", "blocks": [], "warmup": "", "cooldown": "", "duration_min": 0}, {"day": "Sun", "focus": "Rest", "blocks": [], "warmup": "", "cooldown": "", "duration_min": 0}], "week": 2, "theme": "Build: lisää sarjoja ja pientä kuormankorotusta, sama laadukas tekniikka.", "recovery": {"breathwork": "Pre‑sparri: 2 min hidas nenähengitys. Post‑treeni: 3–5 min pidentyvät uloshengitykset.", "mobility_min": 12, "sleep_target_h": 8}, "nutrition": {"notes": "Pidä hiilari korkealla treenipäivinä (200–350 g/pv). Gluteeniton/laktoositon: riisi, peruna, maissi, hedelmät, laktoosittomat maitotuotteet. Muista suola + elektrolyytit sparripäivinä.", "daily_kcal_band": "2400–2800 kcal", "protein_g_per_kg": 2}, "progression_note": "Nosta työpainoja 2.5–5% kun RPE pysyy tavoitealueella. Lisää 1 sarja pääliikkeisiin ja hieman pidempi engine."}, {"days": [{"day": "Mon", "focus": "Full-body Strength A", "blocks": [{"alt": "Heavy DB Goblet Squat", "rpe": 8, "name": "Back Squat", "reps": "4", "sets": 5, "notes": "Syvä ja hallittu—laatu edellä. Lisää 2.5–5% jos RPE pysyy 8:ssa.", "tempo": "3-1-1-0", "rest_sec": 150}, {"alt": "DB Floor Press", "rpe": 8, "name": "Barbell Bench Press", "reps": "5", "sets": 5, "notes": "Vahva pysäytys rinnassa, räjähtävä nosto.", "tempo": "2-1-1-0", "rest_sec": 120}, {"alt": "Barbell Inverted Row (raskaampi kulma)", "rpe": 8, "name": "Pull-up (pronated)", "reps": "6-7 (raskaampi)", "sets": 4, "notes": "Lisäpaino prioriteetti. Pidä 1 s pito ylhäällä.", "tempo": "2-1-1-1", "rest_sec": 150}, {"alt": "DB RDL", "rpe": 8, "name": "Romanian Deadlift", "reps": "6-7", "sets": 3, "notes": "Hidas eksentrinen, pakarat vie työn.", "tempo": "3-0-1-0", "rest_sec": 150}, {"alt": "Suitcase Carry 35 m/puoli", "rpe": 6.5, "name": "Farmer Carry (DB)", "reps": "50 m", "sets": 3, "notes": "Rauhallinen hengitys, olkapäät alas.", "tempo": "", "rest_sec": 60}], "warmup": "4–5 min: 1 min kävely/jog, dynaamiset + ramp‑sarjat kyykkyyn (5 + 3).", "cooldown": "3–4 min: lonkan avaukset + 2 min nenähengitys.", "conditioning": "", "duration_min": 88}, {"day": "Tue", "focus": "Full-body Hypertrophy + Engine", "blocks": [{"alt": "Barbell Split Squat", "rpe": 8, "name": "DB Bulgarian Split Squat", "reps": "8/puoli", "sets": 4, "notes": "Sytytä etureisi/pakara, ääripäissä pysähdys.", "tempo": "3-1-1-0", "rest_sec": 90}, {"alt": "Seated DB Shoulder Press", "rpe": 8, "name": "Barbell Overhead Press", "reps": "4", "sets": 4, "notes": "Purista lattiaa jaloilla, kova lukko ylhäällä.", "tempo": "2-1-1-0", "rest_sec": 150}, {"alt": "Barbell Bent‑over Row", "rpe": 8, "name": "One‑arm DB Row", "reps": "8-9/puoli", "sets": 4, "notes": "Lisää kulmaa, vedä kohti lanttiota.", "tempo": "2-1-1-1", "rest_sec": 120}, {"alt": "DB Hip Thrust", "rpe": 8, "name": "Barbell Hip Thrust", "reps": "8-9", "sets": 3, "notes": "Topissa 1–2 s pito.", "tempo": "2-1-1-1", "rest_sec": 120}, {"alt": "DB Dead Bug 12–14/puoli", "rpe": 7.5, "name": "Hanging Knee Raise", "reps": "12-14", "sets": 3, "notes": "Hallittu, ei heilureita.", "tempo": "2-1-1-1", "rest_sec": 60}], "warmup": "4–5 min: 2 min kevyttä juoksua, dynaamiset + 2 ramp‑sarjaa OHP:hen.", "cooldown": "3–4 min: rintakehän avaus + lonkankoukistaja, 2 min hengitys.", "conditioning": "Treadmill: 8 kierrosta → 45 s kova (RPE 8) + 60 s kävely. 2–3 min veryttely ennen/jälkeen.", "duration_min": 90}, {"day": "Wed", "focus": "Rest", "blocks": [], "warmup": "", "cooldown": "", "duration_min": 0}, {"day": "Thu", "focus": "Full-body Strength B", "blocks": [{"alt": "Barbell Rack Pull (alle polven)", "rpe": 8.5, "name": "Conventional Deadlift", "reps": "3-4", "sets": 4, "notes": "Kova mutta siisti. Ei hiomista selällä—jos tekniikka hajoaa, pysy 4 toistossa.", "tempo": "2-1-1-0", "rest_sec": 180}, {"alt": "Double DB Front Squat", "rpe": 8, "name": "Front Squat", "reps": "4-5", "sets": 3, "notes": "Yläselkä ylpeänä, 1 s pohjapysäytys ok.", "tempo": "3-1-1-0", "rest_sec": 150}, {"alt": "DB Neutral‑grip Bench / Floor Press", "rpe": 8, "name": "Close‑grip Barbell Bench", "reps": "4-5", "sets": 4, "notes": "Rauhallinen lasku, terävä nosto.", "tempo": "2-1-1-0", "rest_sec": 120}, {"alt": "Underhand Barbell Inverted Row (raskaampi kulma)", "rpe": 8, "name": "Chin‑up (supinated)", "reps": "5-6 (raskaampi)", "sets": 3, "notes": "Lisäpaino fokus. 1 s pito ylhäällä.", "tempo": "2-1-1-1", "rest_sec": 150}, {"alt": "Hollow Body Hold 40–50 s", "rpe": 7, "name": "Side Plank + DB Reach", "reps": "40 s/puoli", "sets": 3, "notes": "Kylki tulessa, hengitys pehmeä.", "tempo": "", "rest_sec": 45}], "warmup": "4–5 min: kevyt jog + dynaamiset + ramp‑sarjat maastavetoon.", "cooldown": "3–4 min: takaketju + rintaranka, 2 min rauhoittava hengitys.", "conditioning": "", "duration_min": 88}, {"day": "Fri", "focus": "Power/Upper + Engine", "blocks": [{"alt": "Barbell Push Press", "rpe": 8, "name": "DB Push Press", "reps": "3-4", "sets": 4, "notes": "Sama räjähtävyys joka sarjassa. Ei grindia.", "tempo": "1-0-1-0", "rest_sec": 120}, {"alt": "Pull‑up (neutraali/pronated)", "rpe": 8, "name": "Barbell Bent‑over Row", "reps": "6-7", "sets": 4, "notes": "Vedä alavatsaan, 1 s pito ylhäällä.", "tempo": "2-1-1-0", "rest_sec": 150}, {"alt": "DB Floor Press 3x8-10", "rpe": 8, "name": "Feet‑elevated Push‑up (weighted)", "reps": "10-12", "sets": 3, "notes": "Säilytä koko liikerata ja linjaus.", "tempo": "2-1-1-0", "rest_sec": 90}, {"alt": "DB Walking Lunge", "rpe": 8, "name": "Barbell Reverse Lunge", "reps": "8/puoli", "sets": 3, "notes": "Työntö kantapäältä, lantio pysyy suorana.", "tempo": "2-1-1-0", "rest_sec": 90}, {"alt": "Bent‑over DB L‑Raise", "rpe": 7.5, "name": "DB Rear Delt Fly", "reps": "12-15", "sets": 3, "notes": "Lapaluut auki, niska rento.", "tempo": "2-1-2-1", "rest_sec": 60}], "warmup": "4–5 min: 2 min kevyt juoksu, olkapään aktivoinnit + ramp‑sarjat push pressiin.", "cooldown": "3–4 min: rinta/takaolkapää + 2 min nenähengitys.", "conditioning": "Treadmill: 12–15 min tasainen (RPE 6–7) tai 5–8% nousu reipas kävely.", "duration_min": 88}, {"day": "Sat", "focus": "Rest", "blocks": [], "warmup": "", "cooldown": "", "duration_min": 0}, {"day": "Sun", "focus": "Rest", "blocks": [], "warmup": "", "cooldown": "", "duration_min": 0}], "week": 3, "theme": "Intensify: hitusen kovemmat kuormat, hieman vähemmän toistoja pääliikkeissä.", "recovery": {"breathwork": "Ennen nukkumaanmenoa: 4–6 min pidentyvä uloshengitys tai box breathing 4‑4‑4‑4.", "mobility_min": 12, "sleep_target_h": 8}, "nutrition": {"notes": "Pidä treenipäivinä hiilaripainotus (pre 50–80 g, post 50–80 g). Lisää 300–500 kcal Muay Thai -sparriviikoille joissa volyymi korkeampi.", "daily_kcal_band": "2400–2800 kcal", "protein_g_per_kg": 2}, "progression_note": "Pienennä pääliikkeiden toistomääriä, nosta RPE ~8–8.5 ja pidä apuliikkeet hallittuna. Intervallit kovenevat hieman."}, {"days": [{"day": "Mon", "focus": "Full-body Strength A – PR window", "blocks": [{"alt": "Heavy DB Goblet Squat (3–5 toistoa)", "rpe": 8.5, "name": "Back Squat – top set", "reps": "3–5 (top)", "sets": 1, "notes": "Rakenna top set (3–5 toistoa) @RPE 8.5–9. Sitten 2x5 @ ~90% top‑setistä, RPE ~8.", "tempo": "2-1-1-0", "rest_sec": 240}, {"alt": "DB Goblet Squat", "rpe": 8, "name": "Back Squat – back‑off", "reps": "5", "sets": 2, "notes": "Tekniikka identtinen top setiin.", "tempo": "3-1-1-0", "rest_sec": 180}, {"alt": "DB Floor Press", "rpe": 8.5, "name": "Barbell Bench Press – top + back‑off", "reps": "1x3–5 (top) + 2x5 (back‑off)", "sets": 3, "notes": "Etsi päivän paras 3–5RM @8.5–9, sitten 2x5 @ ~90%.", "tempo": "2-1-1-0", "rest_sec": 180}, {"alt": "Barbell Inverted Row (raskaampi)", "rpe": 8, "name": "Pull‑up (weighted jos mahdollista)", "reps": "5-6", "sets": 3, "notes": "Tee viimeiseen settiin rep‑PR jos tuntuu hyvältä (AMRAP jättäen 1 toiston varastoon).", "tempo": "2-1-1-1", "rest_sec": 150}], "warmup": "5 min: yleisverryttely + dynaamiset + 3 ramp‑sarjaa kyykkyyn (5/3/2).", "cooldown": "3–4 min: lonkan ja rintarangan avaus + 2 min hengitys. Kevyt kylmäallas 2–3 min jos haluat.", "conditioning": "", "duration_min": 85}, {"day": "Tue", "focus": "Full-body Hypertrophy + Short Engine", "blocks": [{"alt": "Seated DB Shoulder Press", "rpe": 8.5, "name": "Barbell Overhead Press – top + back‑off", "reps": "1x3–4 (top) + 2x4 (back‑off)", "sets": 3, "notes": "Etsi päivän paras 3–4 toistoa ilman grindiä, sitten 2x4 ~90%.", "tempo": "2-1-1-0", "rest_sec": 150}, {"alt": "Barbell Split Squat", "rpe": 8, "name": "DB Bulgarian Split Squat", "reps": "8/puoli", "sets": 3, "notes": "Pysy tarkkana tasapainon kanssa—täysi liikerata.", "tempo": "3-1-1-0", "rest_sec": 90}, {"alt": "Barbell Bent‑over Row", "rpe": 8, "name": "One‑arm DB Row", "reps": "8–10/puoli", "sets": 3, "notes": "Pyri rep‑PR viimeiseen siistiin settiin.", "tempo": "2-1-1-1", "rest_sec": 120}, {"alt": "DB Hip Thrust", "rpe": 8, "name": "Barbell Hip Thrust", "reps": "8–10", "sets": 2, "notes": "Puristus yläasennossa 1–2 s.", "tempo": "2-1-1-1", "rest_sec": 120}], "warmup": "4–5 min: 2 min kevyt juoksu/kävely + dynaamiset + 2 ramp‑sarjaa OHP:hen.", "cooldown": "3–4 min: rinta/olkapää + lonkankoukistaja, 2 min hengitys.", "conditioning": "Treadmill: 6 kierrosta → 30 s kova (RPE 8) + 60 s kävely. Pidä se terävänä, ei uuvuttavana.", "duration_min": 80}, {"day": "Wed", "focus": "Rest", "blocks": [], "warmup": "", "cooldown": "", "duration_min": 0}, {"day": "Thu", "focus": "Full-body Strength B – PR window", "blocks": [{"alt": "Barbell Rack Pull (alle polven)", "rpe": 8.5, "name": "Conventional Deadlift – top + back‑off", "reps": "1x3–4 (top) + 2x3–4 (back‑off)", "sets": 3, "notes": "Päivän paras 3–4 @8.5–9, sitten 2 kevyempää sarjaa ~90%.", "tempo": "2-1-1-0", "rest_sec": 240}, {"alt": "Double DB Front Squat", "rpe": 8, "name": "Front Squat – back‑off strength", "reps": "4-5", "sets": 3, "notes": "Pysy teknisenä. Ei tarvetta maksimoida.", "tempo": "3-1-1-0", "rest_sec": 150}, {"alt": "DB Neutral‑grip Bench / Floor Press", "rpe": 8, "name": "Close‑grip Barbell Bench – crisp 5s", "reps": "5", "sets": 3, "notes": "Purista tangoa, työnnä lattiaa—lukitse kyynärpäät hallitusti.", "tempo": "2-1-1-0", "rest_sec": 120}, {"alt": "Underhand Barbell Inverted Row (AMRAP, jättäen 1)", "rpe": 8.5, "name": "Chin‑up (weighted) – rep PR mahdollinen", "reps": "AMRAP (jätä 1 varastoon)", "sets": 2, "notes": "Pidä liike puhtaana—lopeta kun muoto alkaa sulaa.", "tempo": "2-1-1-1", "rest_sec": 180}], "warmup": "5 min: kevyt jog, dynaamiset + 3 ramp‑sarjaa maastavetoon (5/3/2).", "cooldown": "3–4 min: takaketju + rintaranka, 2 min rauhoittava hengitys.", "conditioning": "", "duration_min": 85}, {"day": "Fri", "focus": "Power/Upper + Short Engine", "blocks": [{"alt": "Barbell Push Press", "rpe": 8, "name": "DB Push Press – sharp triples", "reps": "3", "sets": 4, "notes": "Kaikki toistot nopeita. Jos hidastuu, kevennä.", "tempo": "1-0-1-0", "rest_sec": 120}, {"alt": "Pull‑up (neutraali/pronated)", "rpe": 8.5, "name": "Barbell Bent‑over Row – heavy 5–6", "reps": "5-6", "sets": 3, "notes": "Tiukka keskikroppa, 1 s pito ylhäällä.", "tempo": "2-1-1-0", "rest_sec": 150}, {"alt": "Bent‑over DB L‑Raise", "rpe": 8, "name": "DB Rear Delt Fly – pump finisher", "reps": "15", "sets": 2, "notes": "Pieni liike, palaa hitaasti alas.", "tempo": "2-1-2-1", "rest_sec": 60}, {"alt": "DB Walking Lunge", "rpe": 8, "name": "Barbell Reverse Lunge – tidy 6–8/side", "reps": "6-8/puoli", "sets": 2, "notes": "Kontrolli tärkein, ei uuvutusta PR‑päivän alla.", "tempo": "2-1-1-0", "rest_sec": 90}], "warmup": "4–5 min: 2 min kevyt juoksu, olkapääaktivointi + ramp‑sarjat push pressiin.", "cooldown": "3–4 min: rinta/takaolkapää + 2 min hengitys. Kylmäaltaan dippi 2–3 min halutessasi.", "conditioning": "Treadmill: 10–12 min tempo (RPE 6–7) tai 5–8% nousu reipas kävely.", "duration_min": 80}, {"day": "Sat", "focus": "Rest", "blocks": [], "warmup": "", "cooldown": "", "duration_min": 0}, {"day": "Sun", "focus": "Rest", "blocks": [], "warmup": "", "cooldown": "", "duration_min": 0}], "week": 4, "theme": "Consolidation/Test: jahtaa 3–5RM tai toistojen PR:t, pidä apuvolyymi maltillisena.", "recovery": {"breathwork": "Aamulla 3 min nenähengitys, illalla 5 min pidentyvä uloshengitys. Kevyt kävely 10–15 min PR‑päivinä.", "mobility_min": 10, "sleep_target_h": 8.5}, "nutrition": {"notes": "PR‑viikko: pidä hiilarit korkealla edeltävänä iltana ja treenipäivänä (100–150 g 12 h sisään). Suola + nesteet rohkeasti. GF/LF pidetään tiukkana vatsan rauhan vuoksi.", "daily_kcal_band": "2400–2800 kcal", "protein_g_per_kg": 2}, "progression_note": "Ei deloadia (uni ~7.8 h, ei kovaa RPE‑dataa). Lämmitä huolella, tee pääliikkeissä päivän paras sarja @RPE 8.5–9 ja 1–2 kevyempää takaisin. Engine pidetään lyhyenä, jotta saat PR‑ikkunan auki."}], "coach_signature": "Pidetään liekki päällä ja pinotaan PR:ät—mennään!", "weekly_check_targets": {"workouts": 4, "hydration_l": 3.5, "sleep_avg_h": 8, "perfect_days": 3}}	Olen tulessa. 4 viikkoa, all‑around kehitys: voima + massa + moottori, samaan aikaan. Concurrent‑blokki, 4 täsmätreeniä/viikko, 90 min cap. Iso vipuvarsi: saat rutiinin lukkoon (viime kuussa 1 treeni kirjattu) ja pidät RPE:n kurissa. Muay Thai saa bensaa: vahvempi veto/työntö, tukilihaksisto ja kaksi napakkaa juoksukunto‑slottia viikossa.	openai/gpt-5	2026-05-03	2026-05-03 14:14:57.350049+00	2026-05-03 14:14:57.350049+00
\.


--
-- Data for Name: coach_reflections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coach_reflections (id, user_id, reflection_date, energy_1to5, rpe_1to10, sleep_quality_1to5, mood_1to5, win, friction, created_at) FROM stdin;
\.


--
-- Data for Name: coach_weekly_reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coach_weekly_reviews (id, user_id, week_starts_on, performance_score, driver_of_week, wins, frictions, next_week_focus, program_tweak, generated_with, created_at, seen_at) FROM stdin;
\.


--
-- Data for Name: content_moderations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.content_moderations (id, content_type, content_id, image_url, text_content, is_safe, categories, confidence, reason, action, model, created_at, severity, cache_hit, latency_ms) FROM stdin;
\.


--
-- Data for Name: daily_checkins; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.daily_checkins (id, user_id, sleep_hours, workout, extra_workout, cold_shower, healthy_food, protein_intake, meditation_morning, meditation_evening, hydration_liters, no_phone_morning, no_phone_evening, proof_photo_url, xp_earned, checked_in_at, created_at, reading, journal_entry) FROM stdin;
67f11af5-227a-44db-a4e9-77c22df85a6c	01a63c98-3dcd-4666-9be1-182d11c3e066	9.0	t	t	t	t	t	t	t	5.0	t	t	\N	255	2026-03-22 09:47:18.445175+00	2026-03-22 09:47:18.445175+00	f	\N
81440c59-df55-4e9f-8418-852c501d2e57	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	t	f	f	f	f	f	2.0	f	t	\N	120	2026-03-22 09:53:49.063698+00	2026-03-22 09:53:49.063698+00	f	\N
035c83d0-b08c-4d53-8f72-429d544e9fd4	63752d9b-c1ce-498f-9994-d38c462c3c6b	9.0	t	t	t	t	t	t	t	3.5	t	t	\N	255	2026-03-22 10:16:52.887546+00	2026-03-22 10:16:52.887546+00	f	\N
096175a9-a547-44ab-a33b-7140bb7bb450	9cbdb328-fbc4-4a00-b5f6-f093a5b77827	8.0	t	t	t	t	t	f	f	4.0	t	f	\N	205	2026-03-22 10:59:10.458749+00	2026-03-22 10:59:10.458749+00	f	\N
5ed8295c-f712-451c-bd49-9c63fcd9cb0f	a46ff5cb-c0fe-4ceb-9743-7a68e7a48f6d	8.0	t	t	t	t	t	t	t	3.5	t	t	\N	255	2026-03-22 14:01:09.955426+00	2026-03-22 14:01:09.955426+00	f	\N
eb186e20-6fb8-44a4-b7cc-a74b275e8b93	d95f5868-c4f7-4403-ad85-f2a35797f03b	9.0	t	t	t	t	t	t	t	5.0	t	t	\N	240	2026-03-22 16:41:22.221234+00	2026-03-22 16:41:22.221234+00	f	\N
d00946c8-1829-4e8d-8d3c-65676280bf88	779580c8-93a0-43d2-9022-49a57c0dadc5	8.0	t	t	t	t	t	t	t	4.0	t	t	\N	240	2026-03-22 17:11:43.471333+00	2026-03-22 17:11:43.471333+00	f	\N
3fedb36e-9496-4807-b0d4-87dbbb3f0835	63752d9b-c1ce-498f-9994-d38c462c3c6b	8.0	t	t	t	t	t	t	t	4.0	t	t	https://zjdljojkgrpgxurugixf.supabase.co/storage/v1/object/public/proof-photos/63752d9b-c1ce-498f-9994-d38c462c3c6b/1774261783172.HEIC	540	2026-03-23 10:29:45.286149+00	2026-03-23 10:29:45.286149+00	f	\N
a6296a8a-bd49-4030-997e-c3927f07ffd2	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	t	t	t	t	t	t	4.0	t	t	https://zjdljojkgrpgxurugixf.supabase.co/storage/v1/object/public/proof-photos/01a63c98-3dcd-4666-9be1-182d11c3e066/1774262265619.JPG	540	2026-03-23 10:37:47.436505+00	2026-03-23 10:37:47.436505+00	f	\N
18a910ca-0191-40a2-901c-070ef554206b	63752d9b-c1ce-498f-9994-d38c462c3c6b	8.0	t	f	t	t	t	t	f	3.0	f	f	\N	310	2026-03-24 14:43:42.255706+00	2026-03-24 14:43:42.255706+00	f	\N
7e96a653-fd03-49e6-9d85-e2f2339e846c	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	f	t	t	t	t	t	4.0	t	t	\N	495	2026-03-24 14:45:20.508566+00	2026-03-24 14:45:20.508566+00	f	\N
6bf3b219-f6c0-4f94-8b6f-2dc132a25064	d7b989be-006f-4e21-aa39-e21642f56d8a	8.0	f	f	f	t	t	f	f	1.0	f	f	\N	60	2026-03-24 16:52:00.665822+00	2026-03-24 16:52:00.665822+00	f	\N
14279cd4-0975-4df4-8063-68ed5f554de2	5a8e9c0b-545e-4b2b-8058-895831c9dec8	8.0	t	f	t	t	t	t	f	4.0	t	t	\N	260	2026-03-25 08:57:50.845685+00	2026-03-25 08:57:50.845685+00	f	\N
f1579d59-ca6e-47d9-8c6e-c3e00db77bd7	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	t	t	t	t	t	t	4.0	t	t	\N	540	2026-03-25 17:20:39.691355+00	2026-03-25 17:20:39.691355+00	f	\N
f5c4bae2-fd1c-4740-9d24-26df350f7811	63752d9b-c1ce-498f-9994-d38c462c3c6b	8.0	t	f	t	f	f	t	t	3.5	t	t	\N	405	2026-03-25 21:38:31.540641+00	2026-03-25 21:38:31.540641+00	f	\N
bf889250-6168-4396-a6e2-2bac68f1555c	bced39ae-ca8f-4120-a8eb-2b27e834e94b	8.0	t	t	t	t	t	t	t	5.0	t	t	\N	255	2026-03-26 13:41:22.773715+00	2026-03-26 13:41:22.773715+00	f	\N
b3e3303e-17fe-41c6-a60c-c1d4b541552c	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	f	t	t	t	t	t	3.5	t	t	\N	460	2026-03-26 20:15:33.322584+00	2026-03-26 20:15:33.322584+00	f	\N
6a31b4ac-8c4c-4128-b7e8-c3802ffe4e06	d7b989be-006f-4e21-aa39-e21642f56d8a	7.0	t	f	f	t	t	f	f	1.5	f	f	\N	95	2026-03-27 14:57:54.803209+00	2026-03-27 14:57:54.803209+00	f	\N
1cf2568d-16de-4eee-adbd-0f67d9f22ad1	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	f	f	t	t	f	t	t	3.5	t	t	\N	370	2026-03-27 20:18:22.726848+00	2026-03-27 20:18:22.726848+00	f	\N
d7af657c-c613-42ac-9cd1-6d31689006e6	63752d9b-c1ce-498f-9994-d38c462c3c6b	8.0	f	f	t	t	t	t	t	4.0	t	t	\N	415	2026-03-27 20:25:26.306838+00	2026-03-27 20:25:26.306838+00	f	\N
8c130230-76ec-48b0-a96c-a8eeaacb4fc3	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	f	f	t	f	f	t	f	3.0	f	f	\N	195	2026-03-28 22:05:53.714607+00	2026-03-28 22:05:53.714607+00	f	\N
e97e62ca-5476-4deb-98e6-62a551460d31	d7b989be-006f-4e21-aa39-e21642f56d8a	9.0	t	t	f	t	t	f	f	2.0	f	f	\N	225	2026-03-29 08:15:30.597901+00	2026-03-29 08:15:30.597901+00	f	\N
2d400d39-1859-4e7e-b3b4-8e40f0265906	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	t	t	t	t	t	t	4.0	f	t	\N	540	2026-03-30 06:57:54.341661+00	2026-03-30 06:57:54.341661+00	t	\N
e0ab7a5d-13d0-4806-a218-24381848ffd9	d7b989be-006f-4e21-aa39-e21642f56d8a	9.0	t	f	f	t	f	f	f	1.5	f	f	\N	185	2026-03-30 11:17:27.271639+00	2026-03-30 11:17:27.271639+00	t	\N
0803d330-7ef9-442d-87f3-186acae414a6	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	f	f	t	f	t	t	t	3.5	t	f	\N	340	2026-04-01 08:38:51.912287+00	2026-04-01 08:38:51.912287+00	t	\N
bffe80de-d294-4586-872a-837fb5439454	d7b989be-006f-4e21-aa39-e21642f56d8a	8.0	t	t	t	t	t	f	f	1.5	f	f	\N	310	2026-04-01 14:22:19.632674+00	2026-04-01 14:22:19.632674+00	t	\N
824c44fc-383c-47aa-af2c-08aa7afcce7b	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	f	t	t	t	f	t	3.0	f	t	\N	220	2026-04-02 19:01:54.2361+00	2026-04-02 19:01:54.2361+00	t	\N
5bf9ba72-eabe-42b9-b421-f9da87ea4158	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	f	t	t	t	f	f	3.0	f	f	\N	310	2026-04-04 14:30:11.158284+00	2026-04-04 14:30:11.158284+00	t	\N
fb08bf47-912b-48cc-8aca-83533d829d97	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	f	t	t	f	t	t	3.0	f	f	\N	360	2026-04-05 21:40:52.599776+00	2026-04-05 21:40:52.599776+00	t	\N
25c81741-5ed2-4a64-ae3f-08c64b7a7bc2	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	t	t	t	t	t	t	3.5	t	f	\N	485	2026-04-07 07:02:36.633473+00	2026-04-07 07:02:36.633473+00	t	\N
703043d2-1611-483f-8848-acb106190571	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	f	t	t	f	t	f	3.5	t	f	\N	350	2026-04-08 16:42:05.959+00	2026-04-08 16:42:06.142441+00	t	\N
ed614bf8-fd65-4310-b2fd-ca92ee1fd314	63752d9b-c1ce-498f-9994-d38c462c3c6b	8.0	f	t	t	t	t	t	t	5.0	t	t	\N	275	2026-04-08 16:42:57.063989+00	2026-04-08 16:42:57.063989+00	t	\N
ff400555-9e43-4a40-ae33-a184601ba5e8	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	f	f	t	t	t	f	f	3.0	t	f	\N	315	2026-04-10 07:41:16.764+00	2026-04-10 07:41:16.870458+00	t	\N
ec0d3a72-7968-46db-97e2-f2dcbbf971a4	01a63c98-3dcd-4666-9be1-182d11c3e066	7.0	t	f	t	t	t	t	t	3.0	f	f	\N	415	2026-04-12 07:12:11.339+00	2026-04-12 07:12:11.566934+00	t	\N
f22734d5-3954-4895-b4e0-4692f3fe0941	01a63c98-3dcd-4666-9be1-182d11c3e066	9.0	t	f	t	t	t	t	f	3.0	t	f	\N	430	2026-04-13 15:24:26.524+00	2026-04-13 15:24:26.86107+00	t	\N
c47085a1-ce2f-4289-8d56-79b8e4e3000a	01a63c98-3dcd-4666-9be1-182d11c3e066	6.0	t	f	t	t	f	f	f	3.0	t	f	\N	204	2026-04-15 10:08:18.892+00	2026-04-15 10:08:19.331157+00	t	\N
05822144-ba7e-4169-b1d4-6e9d3fffe78f	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	f	t	t	t	t	t	3.0	t	t	\N	530	2026-04-16 13:34:10.933+00	2026-04-16 13:34:11.04941+00	t	\N
6cd11655-b252-4390-92d1-cb825d1c7489	d7b989be-006f-4e21-aa39-e21642f56d8a	8.5	t	f	f	t	t	f	f	2.5	f	f	\N	110	2026-04-17 19:21:56.768+00	2026-04-17 19:21:57.165889+00	t	\N
6c4c4021-3bcb-4eda-8022-e7cf0dd20974	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	f	t	f	t	f	t	3.0	f	f	\N	325	2026-04-18 10:57:42.989+00	2026-04-18 10:57:43.420907+00	t	\N
95df0f07-2e9e-487e-90e2-04222f8b307b	01a63c98-3dcd-4666-9be1-182d11c3e066	8.5	t	f	t	t	t	f	t	3.5	f	t	\N	420	2026-04-19 16:04:20.31+00	2026-04-19 16:04:20.516282+00	t	\N
88232be0-eb0a-4f74-b708-9ac187ec0db7	d7b989be-006f-4e21-aa39-e21642f56d8a	7.0	f	f	t	f	f	f	f	1.5	f	f	\N	24	2026-04-19 16:32:22.059+00	2026-04-19 16:32:22.229325+00	f	\N
f4d8962b-8b3d-4b27-a20b-eac8140f8e81	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	f	t	t	t	t	t	3.0	t	f	\N	470	2026-04-21 08:24:02.528+00	2026-04-21 08:24:02.752121+00	t	\N
b72b7732-b7f3-48b4-8a7a-6d78a07bfed8	d7b989be-006f-4e21-aa39-e21642f56d8a	8.0	t	t	t	t	t	f	f	3.0	f	f	\N	200	2026-04-21 13:45:05.464+00	2026-04-21 13:45:05.645058+00	t	\N
bd7a16cd-3897-4ac1-924d-2b7f3a094017	01a63c98-3dcd-4666-9be1-182d11c3e066	7.0	t	t	t	t	t	t	t	2.5	f	t	\N	225	2026-04-22 11:43:51.166+00	2026-04-22 11:43:52.515438+00	t	\N
1528ec3b-d447-4a37-a436-99d61bdfd250	d7b989be-006f-4e21-aa39-e21642f56d8a	7.0	t	t	f	t	t	f	f	1.5	f	f	\N	103	2026-04-22 18:36:34.194+00	2026-04-22 18:36:34.440361+00	t	\N
c52af22e-2c1a-4574-848e-a3648c8a0c97	01a63c98-3dcd-4666-9be1-182d11c3e066	7.5	t	f	t	t	t	t	t	3.0	t	t	\N	283	2026-04-23 11:47:19.122+00	2026-04-23 11:47:19.965432+00	t	\N
cf7926b4-5bb3-41da-9831-b6c968f04c54	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	f	f	t	f	t	t	t	3.0	t	f	\N	215	2026-04-24 18:31:54.981+00	2026-04-24 18:31:55.358829+00	t	\N
b4e67828-6913-4f38-b053-036a4c90df77	01a63c98-3dcd-4666-9be1-182d11c3e066	7.5	t	f	t	f	t	t	t	3.0	t	f	\N	306	2026-04-26 16:13:35.015+00	2026-04-26 16:13:35.123807+00	t	logged
5b6d5bcb-192d-4028-843c-e575f8ec96be	d7b989be-006f-4e21-aa39-e21642f56d8a	8.5	t	t	f	f	f	f	f	2.0	f	f	\N	88	2026-04-27 13:30:24.041+00	2026-04-27 13:30:24.713378+00	f	\N
4889acde-2d20-4f9a-906f-372c329820cc	01a63c98-3dcd-4666-9be1-182d11c3e066	7.5	t	t	t	t	t	t	t	3.0	t	t	\N	369	2026-04-28 07:00:44.672+00	2026-04-28 07:00:45.16964+00	t	\N
05ae5ff0-8509-43c3-ba85-736961781eb8	63752d9b-c1ce-498f-9994-d38c462c3c6b	7.5	t	f	t	f	t	t	f	3.0	f	f	\N	163	2026-04-28 13:48:25.162+00	2026-04-28 13:48:25.800157+00	f	logged
4b3adea6-9e47-45a7-bd76-60b7c23dbab2	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	t	t	t	t	t	t	3.0	t	t	\N	350	2026-04-29 10:16:01.97+00	2026-04-29 10:16:02.148962+00	t	\N
4fbb3227-172d-4503-93a0-9768ce6651a6	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	f	t	f	t	t	f	3.0	t	f	\N	194	2026-05-02 13:04:24.778+00	2026-05-02 13:04:25.021334+00	f	\N
aa6fca8c-0707-4efd-b62a-397d5f888589	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	f	t	t	t	f	f	3.0	f	f	\N	200	2026-05-05 08:51:31.042+00	2026-05-05 08:51:32.051106+00	t	\N
393b1ba2-f523-4623-9bac-c49c522f2bd0	d7b989be-006f-4e21-aa39-e21642f56d8a	8.0	t	t	f	t	t	f	f	1.5	f	f	\N	144	2026-05-05 17:21:25.917+00	2026-05-05 17:21:26.341424+00	f	\N
26d49b8e-0e8c-4988-8850-45b0e00ec4a7	63752d9b-c1ce-498f-9994-d38c462c3c6b	8.0	f	f	t	f	t	f	f	2.0	f	f	\N	103	2026-05-06 10:07:45.535+00	2026-05-06 10:07:45.888297+00	f	\N
275b5e60-536f-4042-9a67-e9f14f56e14f	d7b989be-006f-4e21-aa39-e21642f56d8a	7.5	t	f	f	t	t	f	f	2.0	f	f	\N	138	2026-05-07 14:54:46.235+00	2026-05-07 14:54:46.816228+00	t	\N
3546577b-d37c-4dce-968a-cf7711ab15f0	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	t	t	t	t	f	t	3.0	f	f	\N	280	2026-05-07 15:10:28.41+00	2026-05-07 15:10:29.282456+00	t	\N
85559bda-c0d5-4135-8347-fdfcd3782bf0	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	f	t	t	f	t	t	3.0	f	f	\N	194	2026-05-10 09:09:47.175+00	2026-05-10 09:09:47.417194+00	f	\N
b5669132-7332-4e7d-ad27-e96b75d63b52	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	f	f	t	t	t	f	t	3.0	f	t	\N	236	2026-05-13 08:32:42.826+00	2026-05-13 08:32:43.186334+00	t	\N
5b8a103e-d3d9-498e-a96f-ae0c3217c96a	01a63c98-3dcd-4666-9be1-182d11c3e066	8.0	t	f	t	t	t	t	f	3.0	t	t	\N	304	2026-05-19 07:24:09.988+00	2026-05-19 07:24:10.235127+00	t	\N
\.


--
-- Data for Name: direct_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.direct_messages (id, sender_id, receiver_id, content, read, created_at) FROM stdin;
7cefa39d-97cb-4ff0-ab1b-836f55415b43	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	moi	t	2026-03-22 16:08:43.832985+00
7696f570-8878-4575-ae3f-ea77e177a553	63752d9b-c1ce-498f-9994-d38c462c3c6b	01a63c98-3dcd-4666-9be1-182d11c3e066	moi	t	2026-03-22 16:09:05.647494+00
95164baa-9b12-40fc-941d-53338eb067d7	63752d9b-c1ce-498f-9994-d38c462c3c6b	d7b989be-006f-4e21-aa39-e21642f56d8a	Morjens	f	2026-03-23 10:51:19.414721+00
187f3b78-9a6e-41a4-af0a-3c6b12b548c7	63752d9b-c1ce-498f-9994-d38c462c3c6b	d7b989be-006f-4e21-aa39-e21642f56d8a	Moi	f	2026-03-26 07:01:22.2385+00
f23bb71b-eba6-4976-acac-6ded5ba93209	bced39ae-ca8f-4120-a8eb-2b27e834e94b	01a63c98-3dcd-4666-9be1-182d11c3e066	Moioi	t	2026-03-25 20:11:25.731986+00
24472b23-d547-4540-bfaf-33133ed64557	63752d9b-c1ce-498f-9994-d38c462c3c6b	006339bd-b83a-443a-ade5-2c2efc6d8efd	moi	t	2026-03-22 16:09:17.534341+00
27f5bdce-f77a-4db6-a756-23002bead42b	01a63c98-3dcd-4666-9be1-182d11c3e066	bced39ae-ca8f-4120-a8eb-2b27e834e94b	Moi	f	2026-04-17 12:20:48.653725+00
644815fd-4f9c-47a4-ad5b-93deb49183d9	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	moi	t	2026-04-17 12:15:53.539655+00
ae9af71b-86db-4d54-959b-c0bef0052004	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	Moi	t	2026-04-17 12:20:05.602281+00
63d47356-f383-455a-abfc-4dd4eea9127e	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	Mojfodkebeijbb	t	2026-04-17 12:20:17.727656+00
647f0d29-035a-4a6c-8719-4eb7938c0ecb	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	MojfodkebeijbbB	t	2026-04-17 12:20:17.90888+00
67dabb67-7cbc-4653-9955-a9b2f0701299	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	MojfodkebeijbbBB	t	2026-04-17 12:20:18.101675+00
80d1192a-9d13-43cc-9b82-c4ab9219c517	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	MojfodkebeijbbBBB	t	2026-04-17 12:20:18.239065+00
07a6b140-e43e-4319-a5d9-1c97eb978cf3	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	H	t	2026-04-17 12:20:21.220955+00
029abcba-6100-4105-bdcd-0d471762b5fa	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	HH	t	2026-04-17 12:20:21.422508+00
ba3002a3-930f-4db4-8f50-c935a3c576d5	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	HHH	t	2026-04-17 12:20:21.571691+00
cc55ce8f-652b-422d-840d-4a18fc7d84c8	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	HHHH	t	2026-04-17 12:20:21.739301+00
04466f54-67d6-401d-8cc3-cd3846df5ea5	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	H	t	2026-04-17 12:20:22.064765+00
34ea008e-a565-4046-b1bc-0f28b27bb01f	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	H	t	2026-04-17 12:20:22.776161+00
e22583a5-61ff-46cf-9711-ac77f92d9c99	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	HV	t	2026-04-17 12:20:22.962529+00
b1f5cc4d-b9c3-4d5d-bd55-5c4e7448b2f2	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	HVH	t	2026-04-17 12:20:23.109818+00
e842b33c-3471-4487-9c40-9cb56a5920ed	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	HVHH	t	2026-04-17 12:20:23.280336+00
f6831000-7308-4bfb-971e-9b5da722d835	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	H	t	2026-04-17 12:20:23.450326+00
524cfc39-f96d-40d5-a302-ef7187127b88	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	H	t	2026-04-17 12:20:23.583479+00
74e2b39b-3d80-4490-b91a-8c6ab657e071	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	HH	t	2026-04-17 12:20:23.744128+00
\.


--
-- Data for Name: feed_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feed_comments (id, post_id, user_id, content, created_at, parent_id, updated_at) FROM stdin;
9d0be82c-2ab3-406c-8189-c2df39efe93a	98aa667c-e5e4-4f57-925f-1db51620a00e	01a63c98-3dcd-4666-9be1-182d11c3e066	lets GO!	2026-03-22 10:03:27.226746+00	\N	2026-04-21 14:24:24.272406+00
\.


--
-- Data for Name: feed_posts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feed_posts (id, user_id, content, image_url, likes_count, comments_count, reported, created_at, updated_at, video_url, kudos_count) FROM stdin;
b4fb5ba6-1dcf-42db-9c9a-4d551c951bda	01a63c98-3dcd-4666-9be1-182d11c3e066	\N	https://zjdljojkgrpgxurugixf.supabase.co/storage/v1/object/public/feed-images/01a63c98-3dcd-4666-9be1-182d11c3e066/1774642912622.jpg	1	0	f	2026-03-27 20:21:54.42548+00	2026-03-28 10:41:16.551747+00	\N	0
98aa667c-e5e4-4f57-925f-1db51620a00e	01a63c98-3dcd-4666-9be1-182d11c3e066	\N	https://zjdljojkgrpgxurugixf.supabase.co/storage/v1/object/public/feed-images/01a63c98-3dcd-4666-9be1-182d11c3e066/1774173791671.png	3	0	f	2026-03-22 10:03:14.017953+00	2026-03-28 10:41:18.331236+00	\N	1
\.


--
-- Data for Name: feed_reactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feed_reactions (id, post_id, user_id, reaction_type, created_at) FROM stdin;
0c2e8ee3-51fd-45d9-bb78-186e27bd9efd	98aa667c-e5e4-4f57-925f-1db51620a00e	63752d9b-c1ce-498f-9994-d38c462c3c6b	fire	2026-03-22 10:31:55.11139+00
efa741e5-f6a2-4f06-9af5-7ab3e0cf711b	98aa667c-e5e4-4f57-925f-1db51620a00e	9cbdb328-fbc4-4a00-b5f6-f093a5b77827	fire	2026-03-22 10:53:07.957721+00
e2dacedc-87cf-4b61-bfa8-d7e212256467	98aa667c-e5e4-4f57-925f-1db51620a00e	779580c8-93a0-43d2-9022-49a57c0dadc5	fire	2026-03-22 17:11:59.565503+00
29fc011d-2d3c-4216-97a0-c58340af184c	98aa667c-e5e4-4f57-925f-1db51620a00e	f57f89d5-f091-4c8f-a4cf-0702da7bb4c6	fire	2026-03-25 07:13:57.052208+00
a08aa5a8-3608-4d7f-bcef-ceaa46ca6955	b4fb5ba6-1dcf-42db-9c9a-4d551c951bda	d7b989be-006f-4e21-aa39-e21642f56d8a	fire	2026-03-28 10:41:16.551747+00
413e4782-6bac-4dad-9ac7-7e8c6ba7cd1c	98aa667c-e5e4-4f57-925f-1db51620a00e	d7b989be-006f-4e21-aa39-e21642f56d8a	fire	2026-03-28 10:41:18.331236+00
\.


--
-- Data for Name: friendships; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.friendships (id, requester_id, addressee_id, status, created_at, updated_at) FROM stdin;
114d591a-e5d4-46f7-9731-6121e143c8ae	01a63c98-3dcd-4666-9be1-182d11c3e066	63752d9b-c1ce-498f-9994-d38c462c3c6b	accepted	2026-03-22 16:33:46.865401+00	2026-03-22 16:33:46.865401+00
9fce10ff-b2ba-4757-a5ba-ee69e3ad9a22	63752d9b-c1ce-498f-9994-d38c462c3c6b	006339bd-b83a-443a-ade5-2c2efc6d8efd	pending	2026-03-22 17:30:09.225152+00	2026-03-22 17:30:09.225152+00
5d024e86-e3f4-47dd-aadb-d7dd43b4eae7	63752d9b-c1ce-498f-9994-d38c462c3c6b	d7b989be-006f-4e21-aa39-e21642f56d8a	accepted	2026-03-23 10:51:03.146697+00	2026-03-23 10:51:03.146697+00
996949ca-2297-497b-838d-62555fb25bd9	bced39ae-ca8f-4120-a8eb-2b27e834e94b	63752d9b-c1ce-498f-9994-d38c462c3c6b	declined	2026-03-25 20:09:58.047608+00	2026-03-25 20:09:58.047608+00
\.


--
-- Data for Name: kudos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.kudos (id, giver_id, post_id, receiver_id, created_at) FROM stdin;
053012ef-a78d-429c-af41-d5a2f84efa49	63752d9b-c1ce-498f-9994-d38c462c3c6b	98aa667c-e5e4-4f57-925f-1db51620a00e	01a63c98-3dcd-4666-9be1-182d11c3e066	2026-03-24 09:56:33.487883+00
\.


--
-- Data for Name: leaderboard_champions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leaderboard_champions (id, season_id, user_id, username_snapshot, season_points, reward_type, created_at) FROM stdin;
0170b054-849b-4370-81a1-e28a26345c93	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	01a63c98-3dcd-4666-9be1-182d11c3e066	willehard	540	season_champion	2026-04-01 06:29:36.715228+00
4074d142-d62a-413d-8a74-4c3aaaff8d39	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	01a63c98-3dcd-4666-9be1-182d11c3e066	willehard	6922	season_champion	2026-05-02 13:04:00.488163+00
\.


--
-- Data for Name: leaderboard_season_baselines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leaderboard_season_baselines (id, season_id, user_id, baseline_xp, created_at) FROM stdin;
b242f648-ccc8-401b-ba78-5cccc2558f5b	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	b82fdf4e-9e62-4c9d-9f9d-93d58b4a259f	0	2026-03-29 08:31:09.866554+00
87232c7b-7940-4fd2-9b8f-f0b8e78ed5cc	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	2d0d2152-1d78-4bff-bca0-8127e9c7b309	0	2026-03-29 08:31:09.866554+00
bf2a3e36-43fd-4a1c-94b8-7262a48243ff	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	e7d58531-5700-4188-8551-6ef815017aa5	0	2026-03-29 08:31:09.866554+00
05e7fe2c-0bbb-474e-af89-21fbe4518839	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	bced39ae-ca8f-4120-a8eb-2b27e834e94b	2705	2026-03-29 08:31:09.866554+00
5df8c344-8c39-4a36-b8c2-dfe45295c783	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	006339bd-b83a-443a-ade5-2c2efc6d8efd	0	2026-03-29 08:31:09.866554+00
1c7d5f36-f984-4409-833e-51c924646eda	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	8a731910-5b1f-4acc-8f27-9d6915054c42	0	2026-03-29 08:31:09.866554+00
ec439494-0ce4-4149-8ba0-a4d054097d0d	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	a46ff5cb-c0fe-4ceb-9743-7a68e7a48f6d	255	2026-03-29 08:31:09.866554+00
dad9e5cd-7d4d-4204-839e-9d8ab28eb1df	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	1ed4be4e-91af-4319-a190-930bad490db9	0	2026-03-29 08:31:09.866554+00
d4a45eec-fd78-49f2-bed4-e01cb7c86822	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	5a8e9c0b-545e-4b2b-8058-895831c9dec8	260	2026-03-29 08:31:09.866554+00
6f0999ab-1085-46b4-b3cb-de95d1bb88ee	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	63752d9b-c1ce-498f-9994-d38c462c3c6b	1940	2026-03-29 08:31:09.866554+00
1a186f7b-bf80-4d00-954b-065fbc000b7a	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	71c7e00c-fd0a-43e3-b97d-d1d809dc80a7	0	2026-03-29 08:31:09.866554+00
15c70013-113a-45d0-bedc-057687ab64d9	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	2e68a67b-a09b-4e40-bd21-58d1ee1f98c8	0	2026-03-29 08:31:09.866554+00
96f10b92-da1b-441e-b97f-28c7b533626b	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	d95f5868-c4f7-4403-ad85-f2a35797f03b	240	2026-03-29 08:31:09.866554+00
8f628bd9-4c8a-4d73-9e52-841f29bbeaee	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	f57f89d5-f091-4c8f-a4cf-0702da7bb4c6	0	2026-03-29 08:31:09.866554+00
1e34df7a-d43c-4d89-bd60-6612e310fb55	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	9cbdb328-fbc4-4a00-b5f6-f093a5b77827	205	2026-03-29 08:31:09.866554+00
c778cf9d-4b26-44ba-bfd8-99e0b5dd9dd2	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	779580c8-93a0-43d2-9022-49a57c0dadc5	240	2026-03-29 08:31:09.866554+00
67c4cc9a-4047-4dea-b659-8db77e2cbb27	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	9293ab9b-a704-4a57-a5da-d9f5f24f6195	0	2026-03-29 08:31:09.866554+00
fc0e0649-d1f4-46ce-8c78-4d493152c2bc	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	d7b989be-006f-4e21-aa39-e21642f56d8a	400	2026-03-29 08:31:09.866554+00
f1f21332-7d8f-457f-9514-16427325ef9d	7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	01a63c98-3dcd-4666-9be1-182d11c3e066	3010	2026-03-29 08:31:09.866554+00
8c0e94c1-7f0f-4818-a416-9c59fbf39db1	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	b82fdf4e-9e62-4c9d-9f9d-93d58b4a259f	0	2026-04-01 06:29:36.715228+00
590bcd44-f461-4d32-9ba8-8ce3bc40e930	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	2d0d2152-1d78-4bff-bca0-8127e9c7b309	0	2026-04-01 06:29:36.715228+00
df8ea77d-96c3-4464-8134-4e160e8b0bf5	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	01a63c98-3dcd-4666-9be1-182d11c3e066	3550	2026-04-01 06:29:36.715228+00
f46741d9-2ebb-4475-8cd7-6f64e9a24aaa	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	e7d58531-5700-4188-8551-6ef815017aa5	0	2026-04-01 06:29:36.715228+00
3e28981c-5eb1-4881-96ec-a855f89a88a5	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	bced39ae-ca8f-4120-a8eb-2b27e834e94b	2705	2026-04-01 06:29:36.715228+00
1725b90c-60ac-4a07-a010-902b50a8f6bc	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	006339bd-b83a-443a-ade5-2c2efc6d8efd	0	2026-04-01 06:29:36.715228+00
145c1aec-8dd2-44c0-9306-bd87a2ec199e	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	8a731910-5b1f-4acc-8f27-9d6915054c42	0	2026-04-01 06:29:36.715228+00
1e092430-946e-42d6-8a3c-7ed953f18211	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	a46ff5cb-c0fe-4ceb-9743-7a68e7a48f6d	255	2026-04-01 06:29:36.715228+00
a6304b00-6e90-4a91-8b77-32f2f5c27598	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	1ed4be4e-91af-4319-a190-930bad490db9	0	2026-04-01 06:29:36.715228+00
f8bb3e35-ba0f-4e61-8b78-a73a0cfc59e7	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	5a8e9c0b-545e-4b2b-8058-895831c9dec8	260	2026-04-01 06:29:36.715228+00
c23033c1-00ca-4119-95f3-ab5495922643	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	63752d9b-c1ce-498f-9994-d38c462c3c6b	1940	2026-04-01 06:29:36.715228+00
de963c65-aa8c-4787-bab9-11181831bb4b	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	71c7e00c-fd0a-43e3-b97d-d1d809dc80a7	0	2026-04-01 06:29:36.715228+00
b9d89e76-d2bc-43fe-968d-58e5211f9cb0	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	2e68a67b-a09b-4e40-bd21-58d1ee1f98c8	0	2026-04-01 06:29:36.715228+00
f490b394-3958-47e3-bec4-72b9b9e9bef5	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	d95f5868-c4f7-4403-ad85-f2a35797f03b	240	2026-04-01 06:29:36.715228+00
c0bde008-87bb-42b8-9762-85ab5af4781e	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	f57f89d5-f091-4c8f-a4cf-0702da7bb4c6	0	2026-04-01 06:29:36.715228+00
2e36cc47-cbe7-495d-b916-1d6ce6f65541	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	9cbdb328-fbc4-4a00-b5f6-f093a5b77827	205	2026-04-01 06:29:36.715228+00
4c9c0e3f-e6c0-4065-b832-5140f11e8060	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	779580c8-93a0-43d2-9022-49a57c0dadc5	240	2026-04-01 06:29:36.715228+00
b7c9525a-260e-4913-92fb-5afe7a6ada7d	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	9293ab9b-a704-4a57-a5da-d9f5f24f6195	0	2026-04-01 06:29:36.715228+00
3df48d1d-22a2-4d9b-a4bb-9ecf7e7850e9	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	d7b989be-006f-4e21-aa39-e21642f56d8a	585	2026-04-01 06:29:36.715228+00
4965559e-ad2f-49e8-bd56-811ba85ab935	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	c5ca7929-dfdf-40ff-953c-b13edda67a99	0	2026-04-01 10:58:37.430072+00
7db4a118-dd04-4d06-9c50-fb172a891bed	7c6d51e8-a791-4e9b-b230-afa240b5d5e9	bf11735f-f450-497e-a231-75c9c09c54d8	0	2026-04-02 16:43:13.098762+00
eb0df6f9-9722-4544-b04c-827962b64588	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	bced39ae-ca8f-4120-a8eb-2b27e834e94b	4850	2026-05-02 13:04:00.488163+00
375654d2-5da0-467d-8087-6d3c14278134	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	779580c8-93a0-43d2-9022-49a57c0dadc5	240	2026-05-02 13:04:00.488163+00
131a640e-8bb4-4d53-b3ca-b10dc5b52a2a	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	b82fdf4e-9e62-4c9d-9f9d-93d58b4a259f	0	2026-05-02 13:04:00.488163+00
0ba70742-2b26-4555-b090-faa95f381ff4	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	2d0d2152-1d78-4bff-bca0-8127e9c7b309	0	2026-05-02 13:04:00.488163+00
516e3073-ce87-42b9-b271-3384bc165f48	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	5a8e9c0b-545e-4b2b-8058-895831c9dec8	260	2026-05-02 13:04:00.488163+00
fe26b06b-6634-4470-ad1f-f4270e8657fd	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	d7b989be-006f-4e21-aa39-e21642f56d8a	1420	2026-05-02 13:04:00.488163+00
2fcc86b8-6e34-42d1-9979-de039d006bce	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	d95f5868-c4f7-4403-ad85-f2a35797f03b	240	2026-05-02 13:04:00.488163+00
d9428fc9-cfc7-496c-9d04-1aee3ef3a572	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	63752d9b-c1ce-498f-9994-d38c462c3c6b	2378	2026-05-02 13:04:00.488163+00
043997e7-f812-4aa1-9426-d7ac91db8b08	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	01a63c98-3dcd-4666-9be1-182d11c3e066	10472	2026-05-02 13:04:00.488163+00
418e073a-836a-460c-b20e-7a0861224173	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	9cbdb328-fbc4-4a00-b5f6-f093a5b77827	205	2026-05-02 13:04:00.488163+00
023070a7-c9c4-4cb6-96a7-7e04ca714460	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	e7d58531-5700-4188-8551-6ef815017aa5	0	2026-05-02 13:04:00.488163+00
1369c138-6902-401a-a386-34cc2750b6f2	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	9293ab9b-a704-4a57-a5da-d9f5f24f6195	0	2026-05-02 13:04:00.488163+00
464bf03f-ba22-4f3f-8d60-47e12f9e0f9d	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	006339bd-b83a-443a-ade5-2c2efc6d8efd	0	2026-05-02 13:04:00.488163+00
ae3a53bf-5f84-4f89-9f20-b54e2828b5a4	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	8a731910-5b1f-4acc-8f27-9d6915054c42	0	2026-05-02 13:04:00.488163+00
021cb453-ed55-4b8c-9a6a-26503853400f	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	a46ff5cb-c0fe-4ceb-9743-7a68e7a48f6d	255	2026-05-02 13:04:00.488163+00
02732eb0-90a9-44d4-8642-68d5ce5a1a6e	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	1ed4be4e-91af-4319-a190-930bad490db9	0	2026-05-02 13:04:00.488163+00
a81dbc6a-9c67-464e-9dcb-cc74f88a6f96	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	71c7e00c-fd0a-43e3-b97d-d1d809dc80a7	0	2026-05-02 13:04:00.488163+00
6cfa54d6-0304-4aa8-84e9-edf021e67bb5	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	2e68a67b-a09b-4e40-bd21-58d1ee1f98c8	0	2026-05-02 13:04:00.488163+00
39dd50dd-ad10-4a20-b00e-bc3d333594b8	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	f57f89d5-f091-4c8f-a4cf-0702da7bb4c6	0	2026-05-02 13:04:00.488163+00
585ec86b-1f5f-425c-bef3-8be418fdd82d	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	bf11735f-f450-497e-a231-75c9c09c54d8	0	2026-05-02 13:04:00.488163+00
d22b25f4-ff02-43e3-b123-cf32a3b59f59	7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	c5ca7929-dfdf-40ff-953c-b13edda67a99	0	2026-05-02 13:04:00.488163+00
\.


--
-- Data for Name: leaderboard_seasons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leaderboard_seasons (id, name, starts_at, ends_at, status, created_at) FROM stdin;
7dc6da00-ef1b-4c3d-9cfb-6aa3b04c611b	March     2026	2026-03-01 00:00:00+00	2026-04-01 00:00:00+00	completed	2026-03-29 08:31:09.866554+00
7c6d51e8-a791-4e9b-b230-afa240b5d5e9	April     2026	2026-04-01 00:00:00+00	2026-05-01 00:00:00+00	completed	2026-04-01 06:29:36.715228+00
7c2d5628-b19e-428e-aad1-8bbcd9bae5c4	May       2026	2026-05-01 00:00:00+00	2026-06-01 00:00:00+00	active	2026-05-02 13:04:00.488163+00
\.


--
-- Data for Name: legend_invites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.legend_invites (id, code, created_by, note, expires_at, used_by, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: moderation_cache; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.moderation_cache (image_hash, action, categories, confidence, severity, reason, created_at) FROM stdin;
\.


--
-- Data for Name: moderation_queue; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.moderation_queue (id, content_type, content_id, image_url, text_content, user_id, ai_action, ai_confidence, ai_categories, ai_reason, severity, status, reviewed_by, reviewed_at, created_at) FROM stdin;
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profiles (id, user_id, username, display_name, avatar_url, xp, level, streak, longest_streak, status_tier, is_elite, created_at, updated_at, referral_code, referred_by, referral_count, featured_badge_id, rank_score, trust_multiplier, rank_score_updated_at, trial_started_at, last_rank_snapshot, membership_credits_until, referral_milestones_hit, is_apex_subscriber, apex_subscription_started_at, apex_credits_until, legend_pinned, is_premium) FROM stdin;
071115d4-d541-48e9-90a2-ed5bc026d2f9	63752d9b-c1ce-498f-9994-d38c462c3c6b	moneymogger88_63752d	\N	\N	2481	5	1	6	recruit	t	2026-03-22 10:16:29.78428+00	2026-05-20 06:16:33.844665+00	moneymogger88_63752d	\N	0	\N	19.35	1.0	2026-05-06 10:07:46.652229+00	2026-04-17 08:43:41.169553+00	{"rank": 3, "score": 19.35, "timestamp": "2026-05-19T09:19:46.192Z"}	\N	[]	f	\N	\N	f	t
1db43420-43f2-4c7e-b186-b5eacc534469	bced39ae-ca8f-4120-a8eb-2b27e834e94b	demo_user	Demo Tester	\N	4850	12	7	23	recruit	f	2026-03-25 13:33:13.023393+00	2026-04-30 07:18:05.519186+00	demo_user-bced39	\N	0	\N	10.40	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
e951a9a1-d8ed-4a5f-b0f5-a487f507ef5b	d7b989be-006f-4e21-aa39-e21642f56d8a	relentlessrise	\N	\N	1692	4	2	5	legend	f	2026-03-23 07:48:26.03116+00	2026-05-10 04:45:15.359781+00	relentlessrise_d7b989	\N	0	\N	21.69	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	{"rank": 2, "score": 21.69, "timestamp": "2026-05-07T14:54:08.623Z"}	\N	[]	f	2026-04-22 11:35:02.500034+00	\N	t	f
c26f66d3-e845-4d5f-a699-48b15a3786a9	779580c8-93a0-43d2-9022-49a57c0dadc5	sisu	\N	\N	240	1	0	1	recruit	f	2026-03-22 17:11:18.288484+00	2026-04-30 07:18:05.519186+00	sisu-779580	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
0dd4ec2e-4d7d-4532-aefd-c0323eb1ab90	b82fdf4e-9e62-4c9d-9f9d-93d58b4a259f	mmm	\N	\N	0	1	0	0	recruit	f	2026-03-26 14:40:54.462569+00	2026-04-30 07:18:05.519186+00	mmm-b82fdf	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
ba4bb0a8-4d7b-4963-a9dd-c417e2111196	2d0d2152-1d78-4bff-bca0-8127e9c7b309	ppp	\N	\N	0	1	0	0	recruit	f	2026-03-26 14:48:25.052525+00	2026-04-30 07:18:05.519186+00	ppp-2d0d21	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
60548fb6-a940-4778-838e-7fdaf530606b	5a8e9c0b-545e-4b2b-8058-895831c9dec8	moi	\N	\N	260	1	0	1	recruit	f	2026-03-25 08:56:25.842234+00	2026-04-30 07:18:05.519186+00	moi-5a8e9c	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
0321b59b-aa64-4a20-918c-55bb0fdb893e	d95f5868-c4f7-4403-ad85-f2a35797f03b	wgroup	\N	\N	240	1	0	1	recruit	t	2026-03-22 16:40:14.501064+00	2026-04-30 07:26:48.291355+00	wgroup-d95f58	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	t
f4a7161a-43de-4f15-ae3b-578c3f6214f1	9cbdb328-fbc4-4a00-b5f6-f093a5b77827	kingmaxing	\N	\N	205	1	0	1	recruit	t	2026-03-22 10:43:34.840306+00	2026-04-30 07:26:48.291355+00	kingmaxing-9cbdb3	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	t
7fa1eaa1-33ac-43b7-b3b3-47a89c40efca	e7d58531-5700-4188-8551-6ef815017aa5	moimoi	\N	\N	0	1	0	0	recruit	f	2026-03-24 14:46:33.65614+00	2026-04-30 07:18:05.519186+00	moimoi-e7d585	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
9d53b9af-e44b-4464-a5da-a4eda1c9685d	9293ab9b-a704-4a57-a5da-d9f5f24f6195	aaaa	\N	\N	0	1	0	0	recruit	f	2026-03-26 15:51:54.983426+00	2026-04-30 07:18:05.519186+00	aaaa-9293ab	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
788fc27e-e325-4e8a-8871-ea9bb22110e6	006339bd-b83a-443a-ade5-2c2efc6d8efd	rosa11	\N	\N	0	1	0	0	recruit	f	2026-03-22 12:32:31.888966+00	2026-04-30 07:18:05.519186+00	rosa11-006339	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
b3b0c730-f082-46bb-bfa8-2c1f5443236e	8a731910-5b1f-4acc-8f27-9d6915054c42	mogger	\N	\N	0	1	0	0	recruit	f	2026-03-24 10:03:27.473192+00	2026-04-30 07:18:05.519186+00	mogger-8a7319	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
a57884e1-1fe0-44d0-9654-b0f40037cf03	a46ff5cb-c0fe-4ceb-9743-7a68e7a48f6d	elitesensei	\N	\N	255	1	0	1	recruit	f	2026-03-22 14:00:42.795668+00	2026-04-30 07:18:05.519186+00	elitesensei-a46ff5	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
fb835415-c649-4b2d-9552-4f32e10defc4	1ed4be4e-91af-4319-a190-930bad490db9	www	\N	\N	0	1	0	0	recruit	f	2026-03-26 13:44:17.992636+00	2026-04-30 07:18:05.519186+00	www-1ed4be	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
a22fd6df-9c8a-4137-adf3-d7764243d235	71c7e00c-fd0a-43e3-b97d-d1d809dc80a7	elite	\N	\N	0	1	0	0	recruit	f	2026-03-25 13:28:49.34643+00	2026-04-30 07:18:05.519186+00	elite-71c7e0	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
967e7280-0b7b-452d-a33c-4f2abd69e73d	2e68a67b-a09b-4e40-bd21-58d1ee1f98c8	mogmaxing	\N	\N	0	1	0	0	recruit	f	2026-03-25 07:10:46.343663+00	2026-04-30 07:18:05.519186+00	mogmaxing-2e68a6	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
0ace8f3f-4f95-4e99-81da-5fe6eda55c87	f57f89d5-f091-4c8f-a4cf-0702da7bb4c6	mogging	\N	\N	0	1	0	0	recruit	f	2026-03-25 07:13:38.302022+00	2026-04-30 07:18:05.519186+00	mogging-f57f89	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
951b01ba-7feb-47cf-84a0-ce1afa6f2bfb	bf11735f-f450-497e-a231-75c9c09c54d8	emister	\N	\N	0	1	0	0	recruit	f	2026-04-02 16:43:13.098762+00	2026-04-30 07:18:05.519186+00	emister_bf1173	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
a3a3424e-fd6d-4f0b-af95-2597915153c0	c5ca7929-dfdf-40ff-953c-b13edda67a99	thewtracker	\N	\N	0	1	0	0	recruit	f	2026-04-01 10:58:37.430072+00	2026-04-30 07:18:05.519186+00	thewtracker_c5ca79	\N	0	\N	0.00	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	\N	\N	[]	f	\N	\N	f	f
bc29e81b-1d79-423e-9e34-029b9849f1db	01a63c98-3dcd-4666-9be1-182d11c3e066	willehard_01a63c	\N	https://zjdljojkgrpgxurugixf.supabase.co/storage/v1/object/public/proof-photos/avatars/01a63c98-3dcd-4666-9be1-182d11c3e066-1774196392685.png	11880	24	1	29	legend	f	2026-03-22 09:46:52.375743+00	2026-05-19 08:52:48.698752+00	willehard_01a63c_01a	\N	0	1dbdbb60-7daf-47d6-a16a-bb30c2885573	78.67	1.0	2026-04-30 07:18:05.519186+00	2026-04-17 08:43:41.169553+00	{"rank": 0, "score": 78.67, "timestamp": "2026-05-19T07:09:09.801Z"}	\N	[]	t	2026-05-19 07:49:31.156+00	\N	t	t
\.


--
-- Data for Name: push_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.push_tokens (id, user_id, token, platform, created_at) FROM stdin;
\.


--
-- Data for Name: referrals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.referrals (id, referrer_id, referred_id, rewarded, created_at, converted, converted_at) FROM stdin;
\.


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reports (id, reporter_id, post_id, reason, resolved, created_at) FROM stdin;
\.


--
-- Data for Name: tribe_battles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tribe_battles (id, challenger_tribe_id, opponent_tribe_id, challenger_owner_id, opponent_owner_id, status, duration_days, started_at, ended_at, challenger_score, opponent_score, winner_tribe_id, created_at) FROM stdin;
\.


--
-- Data for Name: tribe_invites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tribe_invites (id, tribe_id, inviter_id, invitee_id, status, created_at, responded_at) FROM stdin;
9df0f160-7acf-472a-b799-f9196f1183b1	6879c140-b837-4bb8-a89a-f0d7da94239d	01a63c98-3dcd-4666-9be1-182d11c3e066	d7b989be-006f-4e21-aa39-e21642f56d8a	accepted	2026-04-22 10:08:53.648001+00	2026-04-23 14:50:51.462462+00
\.


--
-- Data for Name: tribe_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tribe_members (id, tribe_id, user_id, role, status, joined_at) FROM stdin;
58771fb8-79aa-4410-b4e5-8cf5bf780645	6879c140-b837-4bb8-a89a-f0d7da94239d	01a63c98-3dcd-4666-9be1-182d11c3e066	owner	active	2026-04-22 08:55:43.235497+00
4e0b80bc-30a1-44cf-a575-a9be34b5c939	6879c140-b837-4bb8-a89a-f0d7da94239d	d7b989be-006f-4e21-aa39-e21642f56d8a	member	active	2026-04-23 14:50:51.462462+00
\.


--
-- Data for Name: tribe_post_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tribe_post_comments (id, post_id, user_id, parent_id, content, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tribe_post_kudos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tribe_post_kudos (id, post_id, giver_id, receiver_id, created_at) FROM stdin;
\.


--
-- Data for Name: tribe_post_reactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tribe_post_reactions (id, post_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: tribe_post_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tribe_post_reports (id, post_id, reporter_id, reason, resolved, created_at) FROM stdin;
\.


--
-- Data for Name: tribe_posts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tribe_posts (id, tribe_id, user_id, content, image_url, likes_count, created_at, updated_at, video_url, comments_count, kudos_count, reported) FROM stdin;
47cca726-cba9-4db1-9032-4bafc9d3ff78	6879c140-b837-4bb8-a89a-f0d7da94239d	01a63c98-3dcd-4666-9be1-182d11c3e066	Camaan!!	\N	0	2026-04-22 10:09:06.388666+00	2026-04-22 10:09:06.388666+00	\N	0	0	f
\.


--
-- Data for Name: tribes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tribes (id, owner_id, name, slug, description, cover_url, visibility, member_count, created_at, updated_at, is_paused, paused_at, paused_reason) FROM stdin;
6879c140-b837-4bb8-a89a-f0d7da94239d	01a63c98-3dcd-4666-9be1-182d11c3e066	The Real W group	the-real-w-group-1b33f8	The Real W	\N	private	2	2026-04-22 08:55:43.235497+00	2026-04-23 14:50:51.462462+00	f	\N	\N
\.


--
-- Data for Name: user_badges; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_badges (id, user_id, badge_id, earned_at) FROM stdin;
1b37580d-c12b-4d05-a538-d2de11c6d792	01a63c98-3dcd-4666-9be1-182d11c3e066	f4b609e0-142a-40d6-8dd5-d63f5c653336	2026-03-29 12:40:47.588449+00
cec06c3f-ea21-435e-8343-0697e626bd8b	01a63c98-3dcd-4666-9be1-182d11c3e066	f061abfa-5b60-4a71-94cc-bbb43e2a4e60	2026-03-29 12:40:47.686221+00
6879552f-25b6-43bd-b5c9-1e2f99bdc016	01a63c98-3dcd-4666-9be1-182d11c3e066	a7d4f29c-1bde-472d-abb3-a6106715341e	2026-03-29 12:40:47.774459+00
e9f0bdfe-0ae1-4a07-960a-0a2dae62ea40	01a63c98-3dcd-4666-9be1-182d11c3e066	83dad162-e6e6-4b2c-8a0b-c7c58372d50c	2026-03-29 12:40:47.853897+00
060d36ba-a542-4c06-9513-3737ead07337	01a63c98-3dcd-4666-9be1-182d11c3e066	52c572d9-74ae-474d-b74b-e89b48b28495	2026-03-29 12:40:47.940706+00
43e252d3-9c86-48b8-bed7-bb74271fdf20	01a63c98-3dcd-4666-9be1-182d11c3e066	49af5c10-88bd-4bf0-bad7-20312970eebe	2026-03-29 12:40:48.01714+00
d2347036-7cb1-4c6b-9759-03c4785e1ac6	01a63c98-3dcd-4666-9be1-182d11c3e066	8f555bad-e87f-4106-9abd-8235190c01bc	2026-03-29 12:40:48.08887+00
5e494ff1-c614-4474-a2a4-a2c58a8567d3	01a63c98-3dcd-4666-9be1-182d11c3e066	51f7e82a-e5d5-46c2-aaf5-8db030216d3a	2026-03-29 12:40:48.176838+00
7b78fe70-2b74-4452-ab73-e53cf2a08218	01a63c98-3dcd-4666-9be1-182d11c3e066	3f6bcfa6-afb0-45f9-9026-0618da446a4c	2026-03-29 12:40:48.249553+00
3fd48b84-d8a5-4363-912d-614a0d198342	01a63c98-3dcd-4666-9be1-182d11c3e066	033b1566-e7a0-4526-9e4f-5db4929889e7	2026-03-29 12:40:48.330827+00
19c0c8b3-884d-431d-bfa1-0dfea8d177b6	01a63c98-3dcd-4666-9be1-182d11c3e066	a9bb9a0c-b0a7-41e5-b3b3-056bf8f5ef31	2026-03-29 12:40:48.405145+00
f140e524-75fc-4e4f-9ac8-858f6a1e426f	01a63c98-3dcd-4666-9be1-182d11c3e066	be470f6f-45ce-47e7-be9c-b8d65d37ca16	2026-03-29 12:40:48.479973+00
4d8b55c7-b11f-4813-8491-fbcd092c52c4	01a63c98-3dcd-4666-9be1-182d11c3e066	a00639a4-faa2-46d7-8488-4cc8385b311c	2026-03-29 12:40:48.579193+00
8b113abb-c013-4cb4-956d-3824797763f1	01a63c98-3dcd-4666-9be1-182d11c3e066	92be1955-081a-40f3-9204-d9b867cddf6e	2026-03-29 12:40:48.657068+00
2fbb05e4-cc3b-4ab2-ab4f-7326ba437aa3	01a63c98-3dcd-4666-9be1-182d11c3e066	258c8ff1-b548-474f-a84f-7b06b44b21ef	2026-03-29 12:40:48.745322+00
d1271e6b-1389-4bed-be01-d87af2839a1d	01a63c98-3dcd-4666-9be1-182d11c3e066	d8e39050-0560-442a-83b8-67c60fcd2bad	2026-03-29 12:40:48.828284+00
1a576c66-7e55-4f89-bbcb-77cc1dcfebbb	01a63c98-3dcd-4666-9be1-182d11c3e066	20b3ea38-8065-4bf4-b17e-a037a3bbcd9d	2026-03-29 12:40:48.903381+00
e212c121-00b0-4757-aafb-173d824cce74	63752d9b-c1ce-498f-9994-d38c462c3c6b	f4b609e0-142a-40d6-8dd5-d63f5c653336	2026-03-29 14:10:53.39908+00
4801e8cd-747d-4ff9-a3f2-cc3643181ed1	63752d9b-c1ce-498f-9994-d38c462c3c6b	f061abfa-5b60-4a71-94cc-bbb43e2a4e60	2026-03-29 14:10:53.486238+00
69dc39c0-48e6-48b9-9dc6-f58b3500a0b4	63752d9b-c1ce-498f-9994-d38c462c3c6b	83dad162-e6e6-4b2c-8a0b-c7c58372d50c	2026-03-29 14:10:53.568081+00
f91a11ea-5c93-4d6a-a895-6303e7246a81	63752d9b-c1ce-498f-9994-d38c462c3c6b	49af5c10-88bd-4bf0-bad7-20312970eebe	2026-03-29 14:10:53.652836+00
5fef4130-ce97-48df-9a08-466bbb77d9ab	63752d9b-c1ce-498f-9994-d38c462c3c6b	8f555bad-e87f-4106-9abd-8235190c01bc	2026-03-29 14:10:53.740036+00
b0b2663f-6df1-416b-a448-24e048585214	63752d9b-c1ce-498f-9994-d38c462c3c6b	51f7e82a-e5d5-46c2-aaf5-8db030216d3a	2026-03-29 14:10:53.830918+00
46a996ac-870b-4aef-9a58-7f4798a2b968	63752d9b-c1ce-498f-9994-d38c462c3c6b	3f6bcfa6-afb0-45f9-9026-0618da446a4c	2026-03-29 14:10:53.916965+00
5dc91671-9f04-46ff-a4df-cd74affda579	63752d9b-c1ce-498f-9994-d38c462c3c6b	033b1566-e7a0-4526-9e4f-5db4929889e7	2026-03-29 14:10:53.99969+00
2242b966-339a-4345-9d6f-9c81b07b7785	63752d9b-c1ce-498f-9994-d38c462c3c6b	a9bb9a0c-b0a7-41e5-b3b3-056bf8f5ef31	2026-03-29 14:10:54.085943+00
233d7c5c-3bb6-411f-82da-a4a6a0f20c6f	63752d9b-c1ce-498f-9994-d38c462c3c6b	a00639a4-faa2-46d7-8488-4cc8385b311c	2026-03-29 14:10:54.170191+00
bc9803da-0cdd-4635-b7fa-8c02001a57bd	63752d9b-c1ce-498f-9994-d38c462c3c6b	258c8ff1-b548-474f-a84f-7b06b44b21ef	2026-03-29 14:10:54.257904+00
5368a89a-0480-42a0-9ea9-dd674099466a	63752d9b-c1ce-498f-9994-d38c462c3c6b	d8e39050-0560-442a-83b8-67c60fcd2bad	2026-03-29 14:10:54.343439+00
8a551b90-52a8-4b35-b057-ba2a2c7ff5ec	d7b989be-006f-4e21-aa39-e21642f56d8a	f4b609e0-142a-40d6-8dd5-d63f5c653336	2026-03-29 14:50:33.007928+00
179574a0-61cd-4609-8045-860627d49326	d7b989be-006f-4e21-aa39-e21642f56d8a	49af5c10-88bd-4bf0-bad7-20312970eebe	2026-03-29 14:50:33.141055+00
cfb46031-9901-4a0f-a4f0-ed4bd0f2e49c	d7b989be-006f-4e21-aa39-e21642f56d8a	8f555bad-e87f-4106-9abd-8235190c01bc	2026-03-29 14:50:33.243055+00
cc067b56-6b39-4437-b894-72b26b993dbf	d7b989be-006f-4e21-aa39-e21642f56d8a	51f7e82a-e5d5-46c2-aaf5-8db030216d3a	2026-03-29 14:50:33.369078+00
42bb3fff-58c7-4e47-8976-3e5e9a4ced83	d7b989be-006f-4e21-aa39-e21642f56d8a	033b1566-e7a0-4526-9e4f-5db4929889e7	2026-03-29 14:50:33.497685+00
7397ae38-12ff-4af5-b797-dcdb8d63d309	d7b989be-006f-4e21-aa39-e21642f56d8a	d8e39050-0560-442a-83b8-67c60fcd2bad	2026-03-29 14:50:33.618759+00
2f3274b1-f099-44a1-a68d-a4929a4a3edd	01a63c98-3dcd-4666-9be1-182d11c3e066	1561eb73-ef9a-45ef-af1c-b8e994ad349c	2026-03-30 06:57:55.205584+00
036b051c-75a8-4eed-a8b5-2fa53fd6994e	01a63c98-3dcd-4666-9be1-182d11c3e066	43b1e06a-cbac-4456-8971-40b398be263c	2026-03-30 06:57:55.28929+00
2d4980f4-679c-4a7c-be75-679f2465759e	01a63c98-3dcd-4666-9be1-182d11c3e066	b19d0a33-69ba-4a29-9a67-ab2b7f0c7700	2026-03-30 06:57:55.372423+00
0300d641-0ce9-4bc1-a26a-7dd184cfc053	d7b989be-006f-4e21-aa39-e21642f56d8a	b19d0a33-69ba-4a29-9a67-ab2b7f0c7700	2026-03-30 11:17:28.44391+00
78b424a6-2e99-47d2-8630-65212f8fbc84	d7b989be-006f-4e21-aa39-e21642f56d8a	a00639a4-faa2-46d7-8488-4cc8385b311c	2026-03-30 11:17:28.537177+00
845f8461-4124-497d-bd1d-c2bbe8ddc30c	01a63c98-3dcd-4666-9be1-182d11c3e066	1dbdbb60-7daf-47d6-a16a-bb30c2885573	2026-04-01 06:29:36.715228+00
1c8b2b64-9203-4870-b3d3-77896ab130a0	01a63c98-3dcd-4666-9be1-182d11c3e066	6eaa25fc-4fd3-4eb6-8332-56b4cd727bc8	2026-04-01 08:38:52.614939+00
e4fb84ef-84e6-4664-a7b4-d58bf785e5a4	d7b989be-006f-4e21-aa39-e21642f56d8a	83dad162-e6e6-4b2c-8a0b-c7c58372d50c	2026-04-01 14:22:23.055556+00
e6c3fd68-9501-4e9f-a3fd-d91fd0d9609c	9293ab9b-a704-4a57-a5da-d9f5f24f6195	49af5c10-88bd-4bf0-bad7-20312970eebe	2026-04-02 06:57:17.605536+00
d992c882-d738-4af1-ac81-dac6ac9bbc3e	9cbdb328-fbc4-4a00-b5f6-f093a5b77827	f4b609e0-142a-40d6-8dd5-d63f5c653336	2026-04-02 10:39:38.239648+00
efc1b430-536f-4f72-8900-8a7479606ad9	9cbdb328-fbc4-4a00-b5f6-f093a5b77827	83dad162-e6e6-4b2c-8a0b-c7c58372d50c	2026-04-02 10:39:38.385487+00
a607d208-1099-484a-8dad-04b15927101e	9cbdb328-fbc4-4a00-b5f6-f093a5b77827	49af5c10-88bd-4bf0-bad7-20312970eebe	2026-04-02 10:39:38.478137+00
cccdecd9-0dba-4838-8e4a-4bddc9f72bfb	9cbdb328-fbc4-4a00-b5f6-f093a5b77827	51f7e82a-e5d5-46c2-aaf5-8db030216d3a	2026-04-02 10:39:38.569947+00
d167a463-9c15-4382-8c2e-0ab55ce9d6f6	9cbdb328-fbc4-4a00-b5f6-f093a5b77827	033b1566-e7a0-4526-9e4f-5db4929889e7	2026-04-02 10:39:38.661975+00
90a33ac2-126d-45de-9042-50fb1383ab09	9cbdb328-fbc4-4a00-b5f6-f093a5b77827	d8e39050-0560-442a-83b8-67c60fcd2bad	2026-04-02 10:39:38.749836+00
7b32b1f5-3255-4bb9-b048-6fedc49306b9	01a63c98-3dcd-4666-9be1-182d11c3e066	27dbb16c-ae96-4b41-8756-80b3108c6cf3	2026-04-02 19:01:55.478216+00
ab6f0463-3e49-4d92-bd5e-5372bfa30f32	01a63c98-3dcd-4666-9be1-182d11c3e066	61f9c6e7-e9d5-4ad9-8448-b14c43a6f911	2026-04-05 21:40:54.059764+00
b5d48223-d57b-41c0-8a6f-3c221473e636	01a63c98-3dcd-4666-9be1-182d11c3e066	d67f9825-7282-45d9-b7bf-9996eb132060	2026-04-07 07:02:37.93049+00
504311e0-275e-44ae-bffc-201bb46c0edf	01a63c98-3dcd-4666-9be1-182d11c3e066	5ec14eb4-6bbd-4e80-ab96-7e1f5e617692	2026-04-07 07:02:38.030445+00
abab11a9-205f-438e-8d5e-c601e9850056	63752d9b-c1ce-498f-9994-d38c462c3c6b	52c572d9-74ae-474d-b74b-e89b48b28495	2026-04-08 16:42:58.889337+00
b381b0b3-d5fb-4dd9-85a5-523e7a0d93fe	63752d9b-c1ce-498f-9994-d38c462c3c6b	b19d0a33-69ba-4a29-9a67-ab2b7f0c7700	2026-04-08 16:42:59.008705+00
80113e26-a291-40d2-87fa-6eaa119380b7	63752d9b-c1ce-498f-9994-d38c462c3c6b	be470f6f-45ce-47e7-be9c-b8d65d37ca16	2026-04-08 16:42:59.121764+00
6b31c8ff-ac49-455d-a636-4551e0b650a5	63752d9b-c1ce-498f-9994-d38c462c3c6b	92be1955-081a-40f3-9204-d9b867cddf6e	2026-04-08 16:42:59.22524+00
f639e88f-aff4-4156-9d10-d8b31c556015	01a63c98-3dcd-4666-9be1-182d11c3e066	5bcc9035-1d32-48ad-9228-9f49fe9fa9ed	2026-04-10 07:41:18.058292+00
78b8d6a4-0e7a-43fd-9756-d99892bbccee	01a63c98-3dcd-4666-9be1-182d11c3e066	478ef1bf-4aa6-465b-86ac-9f86a22b9d8d	2026-04-13 15:24:28.865985+00
d6c5ab48-2e76-4cab-883f-2cb4ae2de6c6	bced39ae-ca8f-4120-a8eb-2b27e834e94b	f4b609e0-142a-40d6-8dd5-d63f5c653336	2026-04-15 11:59:26.450057+00
4ae96e54-9d2d-4b39-bf24-3e652c75d06e	bced39ae-ca8f-4120-a8eb-2b27e834e94b	f061abfa-5b60-4a71-94cc-bbb43e2a4e60	2026-04-15 11:59:26.594914+00
647d99ae-b770-45cd-ba79-5476f29d720f	bced39ae-ca8f-4120-a8eb-2b27e834e94b	83dad162-e6e6-4b2c-8a0b-c7c58372d50c	2026-04-15 11:59:26.687028+00
f74fdb3e-3165-490d-9f14-e1c1d37913df	bced39ae-ca8f-4120-a8eb-2b27e834e94b	52c572d9-74ae-474d-b74b-e89b48b28495	2026-04-15 11:59:26.786616+00
ad895d6d-5376-4cc0-a61a-4672aa02ca56	bced39ae-ca8f-4120-a8eb-2b27e834e94b	8f555bad-e87f-4106-9abd-8235190c01bc	2026-04-15 11:59:26.923296+00
dea6a99f-1e29-4ea2-815f-201eb9d4acd4	bced39ae-ca8f-4120-a8eb-2b27e834e94b	5ec14eb4-6bbd-4e80-ab96-7e1f5e617692	2026-04-15 11:59:27.070504+00
dec5581e-0465-4ca3-9c79-2c2608c143ac	bced39ae-ca8f-4120-a8eb-2b27e834e94b	51f7e82a-e5d5-46c2-aaf5-8db030216d3a	2026-04-15 11:59:27.174685+00
19bcd9c1-2efd-431f-882f-9ed29106b002	bced39ae-ca8f-4120-a8eb-2b27e834e94b	033b1566-e7a0-4526-9e4f-5db4929889e7	2026-04-15 11:59:27.279698+00
eede9315-9b9f-4744-81d6-996a5614e681	bced39ae-ca8f-4120-a8eb-2b27e834e94b	a9bb9a0c-b0a7-41e5-b3b3-056bf8f5ef31	2026-04-15 11:59:27.423701+00
231cdecb-ce83-4431-b072-f5193f02ca69	bced39ae-ca8f-4120-a8eb-2b27e834e94b	a00639a4-faa2-46d7-8488-4cc8385b311c	2026-04-15 11:59:27.524575+00
54cd72e7-9054-4fa7-bf20-29ddc6a706a5	bced39ae-ca8f-4120-a8eb-2b27e834e94b	92be1955-081a-40f3-9204-d9b867cddf6e	2026-04-15 11:59:27.617319+00
4fb2090f-e14b-4ae0-9a8a-57924ac8d4d1	bced39ae-ca8f-4120-a8eb-2b27e834e94b	258c8ff1-b548-474f-a84f-7b06b44b21ef	2026-04-15 11:59:27.696085+00
3b88688e-d8d4-4d0f-ab6b-afe02962abce	bced39ae-ca8f-4120-a8eb-2b27e834e94b	61f9c6e7-e9d5-4ad9-8448-b14c43a6f911	2026-04-15 11:59:27.775885+00
bc49f60a-5ce9-49e6-aa37-001b1a58edbe	bced39ae-ca8f-4120-a8eb-2b27e834e94b	d8e39050-0560-442a-83b8-67c60fcd2bad	2026-04-15 11:59:27.860407+00
9c4f7c98-7e45-4988-858f-535e327376c2	bced39ae-ca8f-4120-a8eb-2b27e834e94b	20b3ea38-8065-4bf4-b17e-a037a3bbcd9d	2026-04-15 11:59:27.949219+00
b247f18e-6e91-4be4-9233-144e2d054151	01a63c98-3dcd-4666-9be1-182d11c3e066	d24aaeb8-e9cd-4936-a54b-d4056ae59711	2026-04-16 13:34:12.131216+00
52bd90a3-e5be-446a-8bc8-7880e0a63bbe	01a63c98-3dcd-4666-9be1-182d11c3e066	6e4a3ea1-45d3-419b-80bd-b634ab296a6d	2026-04-16 13:34:12.236618+00
8498e2d8-6d49-41db-bfe8-7d01287e9ac2	01a63c98-3dcd-4666-9be1-182d11c3e066	0cffdd33-83e3-44a5-8faf-66ef3b7407fd	2026-04-16 13:34:12.335789+00
14ff2a4e-8ad8-46cf-9732-6b45d61f6fb4	d7b989be-006f-4e21-aa39-e21642f56d8a	f061abfa-5b60-4a71-94cc-bbb43e2a4e60	2026-04-17 19:21:58.982761+00
0dc8f8ab-8906-4418-9cfd-15f01c6ee6b5	d7b989be-006f-4e21-aa39-e21642f56d8a	258c8ff1-b548-474f-a84f-7b06b44b21ef	2026-04-17 19:21:59.10745+00
26f555f2-805c-4f67-ae10-bd9d2efdfa33	01a63c98-3dcd-4666-9be1-182d11c3e066	feec0d82-2d55-4b37-9eda-7878894a631d	2026-04-19 16:04:21.987346+00
7c8cf91a-f0bb-440b-afb6-90b8bf14e949	01a63c98-3dcd-4666-9be1-182d11c3e066	30694b57-33b4-41d0-8638-c5dae4f2ffbf	2026-04-22 11:43:58.301502+00
3d44232a-d572-4837-9d4f-2dddbbeb69c4	01a63c98-3dcd-4666-9be1-182d11c3e066	5fd0173b-2ab6-473e-b247-964a82303376	2026-04-23 09:39:45.683909+00
282b378a-2ff7-4e1d-888f-7a45f36b4c8d	01a63c98-3dcd-4666-9be1-182d11c3e066	b5b6020b-3b13-4a90-9bb1-c2652d21fc80	2026-04-23 09:39:45.921414+00
4fd17cda-21c1-410d-9a0a-efc2b9a71ae1	01a63c98-3dcd-4666-9be1-182d11c3e066	71c00995-a87b-4a86-8278-37f783f24f77	2026-04-23 09:39:46.123415+00
dd624ff2-66d7-46b6-bcf7-2306efa85af0	01a63c98-3dcd-4666-9be1-182d11c3e066	9c21b446-7292-46ab-b3a9-3c873463afa5	2026-04-23 09:39:46.314943+00
357ce07c-e049-4f23-930d-636b8bd6705e	01a63c98-3dcd-4666-9be1-182d11c3e066	280d4d98-3d2a-4d78-9c55-fbc07baa8af4	2026-04-23 11:47:23.271488+00
f39e86c0-7ae6-4354-bf49-f387e0244b24	d7b989be-006f-4e21-aa39-e21642f56d8a	b5b6020b-3b13-4a90-9bb1-c2652d21fc80	2026-04-23 13:47:35.591322+00
ea76b355-9421-46ca-af67-089469c78c32	d7b989be-006f-4e21-aa39-e21642f56d8a	71c00995-a87b-4a86-8278-37f783f24f77	2026-04-23 13:47:35.745035+00
e4846ae2-02ef-43fa-9790-942102272e56	d7b989be-006f-4e21-aa39-e21642f56d8a	9c21b446-7292-46ab-b3a9-3c873463afa5	2026-04-23 13:47:35.893623+00
f927c355-5e65-4c50-920c-f44ab3f7e979	01a63c98-3dcd-4666-9be1-182d11c3e066	2d547cde-9384-4065-a1ca-9402a1d3d6b0	2026-04-24 18:31:57.641436+00
f00d1c10-78f8-4610-90c0-a7b988ee9a87	d7b989be-006f-4e21-aa39-e21642f56d8a	6eaa25fc-4fd3-4eb6-8332-56b4cd727bc8	2026-04-27 13:30:32.52491+00
d396a9d9-6504-4d65-9669-0255e3dd859c	d7b989be-006f-4e21-aa39-e21642f56d8a	43b1e06a-cbac-4456-8971-40b398be263c	2026-04-27 13:30:34.155222+00
cb222b4a-ec80-4ebc-886b-8eaf714d5d15	01a63c98-3dcd-4666-9be1-182d11c3e066	2633b76b-f8ee-489e-88f5-242a406c9eb8	2026-04-28 07:00:47.534643+00
399c9672-79ad-414f-88db-ced37d4ce169	01a63c98-3dcd-4666-9be1-182d11c3e066	bc7dda3f-7bed-4b7d-afa4-9f28f73d89e2	2026-05-05 08:51:37.238563+00
3d662a13-a21f-4f4e-a19d-cd2c99dce161	d7b989be-006f-4e21-aa39-e21642f56d8a	d6b20e7e-0440-48de-b5ab-fa78c2f589e0	2026-05-07 14:54:50.211653+00
00301f41-4b05-44df-aa78-76638d3f37c2	01a63c98-3dcd-4666-9be1-182d11c3e066	9d4284f0-5229-46d5-b265-036fd762df60	2026-05-07 15:10:32.771459+00
b50dc17d-5f4d-466b-bb79-72767a04abbc	01a63c98-3dcd-4666-9be1-182d11c3e066	3fc68d08-50f9-4b93-a804-8cc12ac4346d	2026-05-19 07:24:14.379469+00
\.


--
-- Data for Name: user_habit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_habit_logs (id, habit_id, user_id, logged_on, xp_awarded, created_at) FROM stdin;
\.


--
-- Data for Name: user_habits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_habits (id, user_id, protocol_id, added_at, archived_at, current_streak, best_streak, level, last_logged_on, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (id, user_id, role) FROM stdin;
a594764c-8c0f-46a9-95b3-d9c6c3124b53	01a63c98-3dcd-4666-9be1-182d11c3e066	admin
\.


--
-- Data for Name: vault_articles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vault_articles (id, category_id, slug, title, subtitle, summary, evidence_tier, read_time_min, protocol, benefits, risks, body_md, references_json, display_order, published_at, created_at, updated_at, lesson_number, why_it_matters, try_today, key_takeaways, quiz, course_role) FROM stdin;
1536340d-7936-4816-8390-50971d8f406b	recipes	protein-1-6-2-2-g-kg	Protein: 1.6–2.2 g/kg/day	The non-negotiable for muscle, recovery, and aging well	1.6 to 2.2 grams of protein per kilogram of body weight, split across three to four meals of 30–45 g, is the highest-leverage nutrition lever you have. Below 1.6 you are leaving muscle, satiety, and recovery on the table.	strong	6	{"duration": "daily", "frequency": "split across 3–4 meals, ~0.4 g/kg per meal", "intensity": "1.6–2.2 g/kg body weight", "prerequisites": "healthy kidney function"}	{"Maximises muscle protein synthesis","Preserves lean mass during fat loss","Stronger satiety than carbs/fat (lowers spontaneous calorie intake)","Better recovery between training sessions","Slows age-related sarcopenia"}	{"People with stage 3+ chronic kidney disease should consult a clinician","Protein cost can be a barrier — eggs, dairy, legumes are cheap anchors","Past ~2.2 g/kg shows diminishing returns"}	## The dose\n\nA 2018 meta-analysis of 49 trials (Morton et al., *British Journal of Sports Medicine*) showed protein intake above **1.6 g/kg/day** maximises resistance-training-induced gains in lean mass and strength. Above ~2.2 g/kg the curve flattens.\n\nFor a 75 kg adult that's **120–165 g/day**, ideally split into **3–4 meals of 30–45 g** to repeatedly trigger muscle protein synthesis (the ~0.4 g/kg per meal threshold from Schoenfeld & Aragon).\n\n## Why it works\n\n- **MPS pulses**: Each protein-rich meal raises muscle protein synthesis for 3–5 hours. Spreading intake captures more of these pulses than two huge meals.\n- **Leucine threshold**: ~2.5–3 g leucine per meal flips the anabolic switch. Whey, eggs, dairy, fish and lean meat clear it easily; most plant sources need a larger serving.\n- **Satiety**: Calorie-for-calorie, protein is the most filling macronutrient (Weigle et al., *Am J Clin Nutr* 2005) — people eating high-protein diets spontaneously eat ~400 fewer kcal/day.\n\n## How to apply it\n\n1. **Anchor each meal with a fist-sized portion** of meat, fish, dairy, eggs, tofu or legumes.\n2. **Hit ~30 g at breakfast** — most people front-load carbs and back-load protein, missing the morning MPS window.\n3. **Use whey or Greek yogurt** as a fast top-up if a meal falls short.\n4. **Track for 1 week**, then stop. Once you know what 30 g looks like on your plate, the count is automatic.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/28698222/", "year": 2018, "title": "Systematic review of protein supplementation", "author": "Morton et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/29497353/", "year": 2018, "title": "How much protein per meal", "author": "Schoenfeld & Aragon"}, {"url": "https://pubmed.ncbi.nlm.nih.gov/16002798/", "year": 2005, "title": "High-protein satiety", "author": "Weigle et al."}]	2	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2	Of every nutrition variable studied, daily protein intake has the largest effect size on body composition, recovery, and long-term function. It is the one number worth tracking. Most people under-eat protein by 30–50 g/day and wonder why progress stalls.	{"Multiply your bodyweight in kg by 1.6 and 2.2. That is your daily target range in grams.","Plan tomorrow's meals so each one delivers 30–45 g (palm-sized serving of meat, fish, dairy, or 2 scoops whey).","Track for 3 days. Most people are shocked how far below the floor they sit."}	{"Range: 1.6–2.2 g/kg/day. Below 1.6 = under-dosed.","Distribution matters: 3–4 meals × 30–45 g triggers more muscle protein synthesis than 2 huge meals.","Protein is the most filling macronutrient. High-protein eaters spontaneously eat ~400 fewer kcal/day."}	[{"q": "What is the evidence-based daily protein floor for an active 80 kg adult?", "choices": ["64 g", "128 g", "240 g"], "correct": 1, "explain": "80 kg × 1.6 g/kg = 128 g. The old 0.8 g RDA (64 g) is a minimum to avoid deficiency, not optimize performance."}, {"q": "Why split protein across the day instead of one big meal?", "choices": ["It tastes better", "Muscle protein synthesis maxes out around 0.4 g/kg per dose", "It saves money"], "correct": 1, "explain": "Each meal triggers a separate MPS response. 3–5 evenly spaced doses outperform the same total in 1–2 meals."}]	protocol
023f10db-a8f5-4c67-af05-f6ff0aab2240	mind	foundations-mind-and-emotion	Foundations: Emotion is a skill, not a personality	Three time-scales. Three tools. One operator.	Emotional regulation is a trained skill, not a fixed trait. The next four lessons give you precision tools for three distinct moments: acute spikes (seconds), daily baseline (minutes), and structural patterns (weeks).	strong	4	{"duration": "4 min read", "frequency": "Read once, return as needed", "intensity": "Conceptual", "prerequisites": "None"}	{"Reframes emotion as trainable, not fixed","Maps each tool to the right moment","Removes the \\"I am just an anxious person\\" trap"}	{"Not a substitute for therapy in cases of clinical depression, PTSD, or anxiety disorders"}	## Three time-scales\n\nEmotional skill operates at three different time-scales — and you need a tool for each:\n\n| Time-scale | Tool | Lesson |\n|---|---|---|\n| Acute (seconds) | Box breathing, physiological sigh | 2 & 3 |\n| Daily (10 min) | Mindfulness practice | 4 |\n| Structural (weeks) | Cognitive reframing (CBT) | 5 |\n\n## Why all three\n\nUsing only acute tools = you are constantly putting out fires. Using only daily practice = you have a calmer baseline but still get hijacked by acute spikes. Using only structural reframing = your thoughts are more accurate but your body still races. **You need all three.**\n\n## What we deliberately skip\n\n- Specific therapy modalities (ACT, IFS, EMDR) — work with a therapist for those\n- Long meditation retreats — useful but not foundational\n- Psychedelics — emerging evidence but outside the scope of an introductory course\n\n## The single biggest mistake\n\nWaiting until you feel bad to "try" any of this. These are skills. They get installed during easy moments so they are available during hard ones. Practice them when you don't need them.	[{"year": 2012, "title": "The efficacy of cognitive behavioral therapy: a review of meta-analyses", "author": "Hofmann, S."}, {"year": 2014, "title": "Meditation programs for psychological stress and well-being", "author": "Goyal, M."}]	1	2026-05-02 17:52:11.401192+00	2026-05-02 17:52:11.401192+00	2026-05-02 17:52:11.401192+00	1	Most people grab the wrong tool at the wrong moment — meditating during a panic spike, or breathing through a years-old pattern. The three-time-scale model fixes that. Match the tool to the moment and every technique that follows compounds.	{"Pick ONE recurring moment this week where emotion derails you (a meeting, a commute, a conversation).","Tag its time-scale: acute spike, daily background, or structural pattern.","Note it. You will return to this map at the end of the course."}	{"Emotion is trainable. Treat it like strength: progressive, repeatable, measurable.","One time-scale, one tool. Acute → breath. Daily → mindfulness. Structural → reframing.","Train the skill in calm moments so it shows up in hard ones."}	[{"q": "Which tool is best for an ACUTE emotional spike (under 60 sec)?", "choices": ["Mindfulness", "Cognitive reframing", "Physiological sigh / box breathing"], "correct": 2, "explain": "Acute spikes need acute tools — breath techniques work in seconds. Reframing and mindfulness need more time and a calmer baseline."}, {"q": "Why do you need tools at multiple time-scales?", "choices": ["You do not", "Each scale addresses different aspects — acute fires, daily baseline, structural patterns", "Only acute tools work"], "correct": 1, "explain": "Acute tools handle spikes; daily practice raises baseline calm; structural reframing changes the underlying thought patterns. They complement each other."}]	foundations
53bc1523-354c-432f-bb66-c31b6e43af51	mind	box-breathing	Box breathing for acute stress	4-4-4-4 — the operator's reset	Four counts in, four hold, four out, four hold. Five minutes pulls the parasympathetic system online, drops heart rate and blood pressure, and clears decision fog. Effects begin inside 60 seconds.	strong	3	{"duration": "5 min (or 1 min minimum)", "frequency": "on demand for stress, anxiety, before high-pressure moments", "intensity": "4-4-4-4 cadence, nose breathing", "prerequisites": "none"}	{"Acute drop in heart rate and blood pressure","Lower self-reported anxiety within 5 min","Improved focus and decision quality after","Free, silent, deployable anywhere"}	{"Pregnancy, severe respiratory conditions: shorten holds","Don't do while driving (deep relaxation can affect alertness)","Light-headedness on first attempts is normal — slow down"}	## The pattern\n\n```\n   inhale 4s\n      ┌──────┐\n      │      │\nhold  │      │ hold\n4s    │      │ 4s\n      │      │\n      └──────┘\n   exhale 4s\n```\n\nNose-breathe through the inhale and exhale. Hold gently — no straining.\n\n## Why it works\n\nBox breathing exploits two physiological levers:\n\n1. **Vagal activation via long, slow exhalation** — exhaling longer than (or equal to) the inhale shifts the autonomic balance toward parasympathetic dominance (Russo et al., *Breathe* 2017).\n2. **CO₂ tolerance** — the holds slightly raise blood CO₂, which over time recalibrates the respiratory chemoreceptors and reduces baseline anxiety reactivity.\n\nThis is the same pattern taught at US Navy SEAL BUD/S to manage performance anxiety in the water.\n\n## Where to use it\n\n- **Before a presentation, hard conversation, or high-stakes call** (5 min).\n- **In traffic / when angry** (1–2 min).\n- **As a 5-min wind-down before sleep** (lengthen exhale to 6 s).\n- **Between intense training sets** when your HR is racing and you need to focus.\n\n## A 5-minute starter session\n\n1. Sit upright, eyes soft or closed.\n2. Exhale fully to start.\n3. Inhale through nose for 4 s.\n4. Hold for 4 s — gentle, no clenching.\n5. Exhale through nose for 4 s.\n6. Hold for 4 s.\n7. Repeat for 5 minutes (~18–20 cycles).\n\nIf 4-4-4-4 feels rushed, drop to 3-3-3-3. If too easy, build to 5-5-5-5 or 6-6-6-6.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/29209423/", "year": 2017, "title": "The physiological effects of slow breathing", "author": "Russo et al."}, {"year": 2013, "title": "The Way of the SEAL", "author": "Divine"}]	2	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2	You cannot think your way out of an acute stress spike — adrenaline is faster than reason. Box breathing forces a physiological reset through the vagus nerve. The Navy SEALs use it before breaching a door. You can use it before sending the email.	{"Choose one high-pressure moment today — a meeting, a hard call, a difficult conversation.","Run 4 rounds 60 seconds before: inhale 4, hold 4, exhale 4, hold 4. Through the nose.","Rate your tension 1–10 before and after. Most people drop 2–3 points."}	{"The pattern is symmetry: 4-4-4-4. Equal counts are the active ingredient.","Acute dose: 4–8 rounds. Anything longer is a bonus, not a requirement.","This is physiology, not belief. It works whether you trust it or not."}	[{"q": "What is the box breathing pattern?", "choices": ["6-2-6-2", "4-4-4-4", "8-0-8-0"], "correct": 1, "explain": "Equal-length inhale, hold, exhale, hold. The symmetry is the point — it engages voluntary parasympathetic control."}, {"q": "When is box breathing MOST useful?", "choices": ["Long-term meditation", "Acute stress, before a high-pressure moment", "Falling asleep"], "correct": 1, "explain": "For sleep, the physiological sigh or 4-7-8 work better. Box breathing is the acute-stress tool."}]	protocol
f1535aff-1739-405c-b7b3-a9d7e7393f34	mind	physiological-sigh	The physiological sigh	Stanford's 60-second off-switch	Two short nasal inhales, one long mouth exhale. Repeated for one to three minutes, this is the single most effective breath pattern measured for acute stress reduction (Balban, Cell Reports Medicine 2023).	strong	3	{"duration": "1–5 min", "frequency": "on demand for acute stress, anxiety spikes", "intensity": "double nasal inhale + extended mouth exhale, repeated", "prerequisites": "none"}	{"Largest measured drop in self-reported anxiety vs other breath patterns (Balban 2023)","Fast acting (effects in <60 s)","Improves mood for hours after a 5-min daily practice"}	{"Light-headedness if done lying down too vigorously","Less effective if rushed — the long exhale is the active ingredient"}	## How to do it\n\n1. **Inhale through your nose** to about 70 % full.\n2. **Top up with a second short nasal inhale** (a quick "sip" on top of the first breath).\n3. **Exhale slowly through pursed lips** until the lungs are fully empty (target: 8–10 s).\n4. Repeat for 1–5 minutes.\n\n## Why two inhales\n\nThe second inhale **re-inflates collapsed alveoli** in the lungs, allowing more efficient CO₂ offload on the long exhale. CO₂ offload is the strongest acute lever for shifting from sympathetic ("fight or flight") to parasympathetic ("rest and digest") tone.\n\nThe sigh is something humans (and dogs, cats, mice) do spontaneously every few minutes — typically when stress, sleep onset or relaxation is needed. It's pre-wired.\n\n## The Stanford trial\n\nBalban et al. (*Cell Reports Medicine*, 2023) randomised 108 healthy adults to:\n\n- **Cyclic sighing** (the protocol above)\n- **Box breathing**\n- **Cyclic hyperventilation** (Wim Hof-style)\n- **Mindfulness meditation**\n\nAll for **5 min/day for 28 days.**\n\nResult: **cyclic sighing produced the largest reduction in self-reported anxiety and the largest improvement in positive mood.** Mindfulness was effective but slower.\n\n## When to use it\n\n- **Acute stress spike** — 60 s often enough.\n- **Pre-sleep wind-down** — 2–3 min in bed.\n- **Between meetings as a reset** — far more reliable than scrolling.\n- **Before a difficult conversation** — restores calm without sedation.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/36630953/", "year": 2023, "title": "Brief structured respiration practices enhance mood and reduce physiological arousal", "author": "Balban et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/20382180/", "year": 2010, "title": "Sighs as resetters of physiological state", "author": "Vlemincx et al."}]	3	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	3	In a head-to-head Stanford trial, the physiological sigh outperformed box breathing, cyclic hyperventilation, AND mindfulness for daily mood improvement. It is the fastest known voluntary tool to slow your heart in real time.	{"Right now: inhale through your nose, then a second smaller sip to top off your lungs.","Slow, complete exhale through the mouth — twice as long as the inhale.","Three rounds. Notice the shift. Use it any time stress spikes today."}	{"Pattern: double nasal inhale → long mouth exhale. The exhale is the active ingredient.","Effects in under 60 seconds. No equipment, no privacy required.","Beat box breathing AND meditation in the Stanford trial for acute mood."}	[{"q": "How is the physiological sigh performed?", "choices": ["One slow inhale, hold", "Double inhale through nose, long exhale through mouth", "Mouth inhale, nose exhale"], "correct": 1, "explain": "The double inhale re-inflates collapsed alveoli; the long exhale offloads CO₂ and triggers vagal slow-down."}, {"q": "In the Stanford 2023 trial, the physiological sigh outperformed…", "choices": ["Nothing", "Cyclic hyperventilation, box breathing AND meditation for acute mood", "Only placebo"], "correct": 1, "explain": "5 min/day of physiological sighs produced larger acute mood and arousal improvements than the other arms."}]	protocol
bc15bbfb-1556-4b0e-8c6a-4ef12b554ac9	mind	mindfulness-mbsr	Mindfulness: 10 minutes a day	10 minutes a day. 8 weeks. Measurable rewiring.	Ten minutes of formal mindfulness daily for eight weeks produces structural brain changes and reduces anxiety with effect sizes comparable to first-line SSRIs for mild-to-moderate cases (Hoge, JAMA Psychiatry 2023).	strong	5	{"duration": "10 min/day to start (target: 20 min)", "frequency": "daily, ideally same time", "intensity": "breath-anchored awareness; return attention without judgment when it wanders", "prerequisites": "none — but trauma history may benefit from a guided/clinical program"}	{"Reduced anxiety and depression scores comparable to SSRIs in mild-moderate cases (Hoge 2023)","Improved attention control and working memory","Lower stress reactivity (cortisol) over weeks","Compounding benefit — 8 weeks shows structural brain change"}	{"Trauma sufferers may experience flooding — a trauma-informed teacher or program is safer","Boredom and resistance in week 1–2 are normal","Apps help, but a teacher-led MBSR course outperforms apps for severe cases"}	## The minimum dose\n\nKabat-Zinn's **Mindfulness-Based Stress Reduction (MBSR)** program — the most-studied secular mindfulness curriculum — is 8 weeks of daily 30–45 min practice. But:\n\n- A 2014 JAMA meta-analysis (Goyal et al.) found **moderate evidence for ~8 weeks of even briefer practice** improving anxiety, depression and pain.\n- Hoge et al. (*JAMA Psychiatry* 2023) directly compared **8 weeks of MBSR to escitalopram (Lexapro)** for anxiety disorders. **Outcomes were equivalent.**\n\nIn practice: **10 min/day, every day, for 8 weeks** is the realistic starter dose for a busy adult.\n\n## The practice (basic breath anchor)\n\n1. Sit upright. Eyes closed or soft gaze down.\n2. Bring attention to the breath — at the nostrils, chest, or belly.\n3. Notice each inhale and exhale, without trying to change them.\n4. **When attention wanders** (and it will, dozens of times) — notice "thinking", and gently return to the breath. *That return is the rep.* Each one is the equivalent of a bicep curl for your prefrontal cortex.\n5. Continue for 10 min. End by taking one deeper breath.\n\n## What it actually does (long-term)\n\n- **Attention**: Stronger top-down control, less mind-wandering (Mrazek et al., 2013).\n- **Emotional regulation**: Lower amygdala reactivity to negative stimuli (Goldin et al., 2010).\n- **Stress hormones**: Reduced cortisol response to acute stressors (Pascoe et al., 2017 meta-analysis).\n- **Brain structure**: After 8 weeks, increased grey matter density in hippocampus, decreased in amygdala (Hölzel et al., 2011).\n\n## How to actually do it for 8 weeks\n\n- **Same time, same chair** — habit stack with morning coffee or pre-bed.\n- **Use a guided app** (Waking Up, Insight Timer, 10 % Happier) if a teacher isn't accessible.\n- **Skip-day rule**: never skip two days in a row.\n- **Don't evaluate sessions** — most "bad" sessions are doing the work.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/36350593/", "year": 2023, "title": "MBSR vs escitalopram for anxiety disorders", "author": "Hoge et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/24395196/", "year": 2014, "title": "Meditation programs for psychological stress", "author": "Goyal et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/21071182/", "year": 2011, "title": "Mindfulness practice leads to increases in regional brain grey matter", "author": "Hölzel et al."}]	4	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	4	Mindfulness is not mystical — it is attention training. The MBSR protocol has 30+ years of clinical data. Ten minutes a day is the minimum effective dose. Less and you're journaling; more and you're scaling something that already works.	{"Sit upright for 10 minutes. Phone in airplane mode, timer on.","Anchor on the breath. When attention wanders — and it will — return without judgment. That return IS the rep.","Use Waking Up, Headspace or Insight Timer if you need a guide. Same hour each day if possible."}	{"Dose: 10 min/day. Below this you will not see structural change.","The rep is the return, not the focus. Wandering is the setup, not the failure.","Compounds invisibly for 4–6 weeks, then becomes obvious. Trust the timeline."}	[{"q": "What is the actual rep you're training in mindfulness?", "choices": ["Staying perfectly focused", "Noticing your mind has wandered and bringing attention back", "Sitting still for the full time"], "correct": 1, "explain": "Each return is a rep of attentional control. Wandering is not failure — it is the setup for the next rep."}, {"q": "What is the standard MBSR dose that produces measurable change?", "choices": ["1 hour, weekly", "~10 min/day for 8 weeks", "No fixed dose"], "correct": 1, "explain": "MBSR research consistently shows ~10 min/day over 8 weeks shifts stress reactivity, sleep markers and pain perception."}]	protocol
e4931ec6-0b23-4782-bc61-d5fce1913cb7	mind	cognitive-reframing	Cognitive reframing (CBT)	Catch the thought. Test the evidence. Rewrite the line.	Cognitive reframing — the core skill of CBT — is the most evidence-backed intervention in all of psychology. Catch an automatic thought, name the distortion, weigh the evidence, write a balanced reframe. Daily practice rewires response patterns.	strong	6	{"duration": "5–10 min when triggered", "frequency": "on demand, daily during high-stress periods", "intensity": "3-column journal: situation → automatic thought → reframe", "prerequisites": "none — but severe depression/PTSD: pair with a therapist"}	{"Reduces depression/anxiety symptoms across hundreds of trials","Effects equal or exceed SSRIs for many conditions, with longer-lasting benefit","Builds metacognitive awareness — you stop *being* your thoughts","Free, learnable from books and apps"}	{"Severe depression: do this with a therapist, not alone","Reframing isn't \\"positive thinking\\" — it requires honest evidence","Skip when emotionally flooded; come back when calmer"}	## The premise\n\nDeveloped by Aaron Beck in the 1960s and refined by David Burns, **Cognitive Behavioural Therapy (CBT)** rests on one observation: *thoughts cause feelings, not events*. Two people in the same situation will feel very different things based on what they tell themselves about it.\n\nMost emotional suffering follows a small number of **cognitive distortions**: catastrophising, all-or-nothing thinking, mind-reading, personalising, "should" statements, etc.\n\n## The 3-column tool\n\n| Situation | Automatic thought | Reframe |\n|---|---|---|\n| Sent a message, no reply in 4 h | "She's pissed at me" *(mind-reading, catastrophising)* | "She's probably busy. Last time this happened she replied that evening. I'll wait until tonight." |\n| Missed a workout | "I'm back to square one" *(all-or-nothing)* | "One missed session inside 20 last month is noise, not a trend. I'll lift tomorrow." |\n| Got critical feedback at work | "My boss thinks I'm bad at my job" *(jumping to conclusions)* | "He pointed out one specific thing. He praised two others. The criticism is actionable." |\n\n## The protocol\n\n1. **Catch the feeling first** (anger, anxiety, shame).\n2. **Write the situation** — facts only, no interpretation.\n3. **Write the automatic thought** verbatim, even if it's ugly.\n4. **Name the distortion** (catastrophising, etc.).\n5. **Write the reframe** — what would you tell a smart friend in this situation? Use *evidence*, not affirmations.\n\nDo this **5–10 times when triggered**, daily during stressful periods. After ~4 weeks, the catch-and-reframe starts happening in real time.\n\n## The evidence base\n\n- Hofmann et al. (*Cogn Ther Res*, 2012) meta-analysed **269 CBT trials**: large effect sizes for anxiety disorders, depression, OCD, PTSD, eating disorders.\n- DeRubeis et al. (2005): CBT was **as effective as antidepressants** at 16 weeks, with **lower relapse** at follow-up.\n- Cuijpers et al. (2023): the effects hold up across cultures, age groups, and severity levels.\n\n**Best free resource**: David Burns' *Feeling Good* (book) — the entire CBT toolkit in lay language.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/23459093/", "year": 2012, "title": "The efficacy of CBT: a review of meta-analyses", "author": "Hofmann et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/36350593/", "year": 2023, "title": "MBSR vs escitalopram", "author": "Hoge et al."}, {"year": 1980, "title": "Feeling Good", "author": "Burns"}]	5	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	5	Events do not cause feelings. Interpretations do. The same missed call can read as "they hate me" or "they're busy." One tanks your day; the other doesn't. Reframing is the difference between being a passenger to your thoughts and being the operator.	{"Catch one upsetting moment today. Write the trigger in a single sentence.","Write the automatic thought it produced (\\"I'm failing\\", \\"they don't respect me\\").","List two pieces of evidence FOR and two AGAINST. Write one balanced reframe."}	{"Trigger → thought → feeling. The thought is the lever, not the trigger.","Reframing is a skill, not a personality. Reps build it.","CBT is the most-validated psychological intervention ever measured. Use it."}	[{"q": "In CBT, what comes between an event and your emotional reaction?", "choices": ["Nothing", "An automatic thought / interpretation", "Your hormones"], "correct": 1, "explain": "The event triggers a thought, which triggers the emotion. Reframing intervenes at the thought layer — the only one you can directly edit."}, {"q": "Which is a core reframing question?", "choices": ["Why do bad things happen to me?", "What's the evidence for and against this thought?", "Who can I blame?"], "correct": 1, "explain": "Examining evidence breaks the loop of automatic catastrophic thinking and produces more balanced, accurate appraisals."}]	protocol
fe57afe2-d125-4189-a0c4-abd3e903ad6c	nervous-system	foundations-nervous-system	Foundations: Mapping your autonomic states	Three states. Two modes. One operator.	Your nervous system runs in three states: ventral vagal (calm-engaged), sympathetic (fight-or-flight), and dorsal vagal (shutdown). Knowing which state you are in tells you which tool to reach for. This lesson is the map.	strong	4	{"duration": "4 min read", "frequency": "Read once, return as needed", "intensity": "Conceptual", "prerequisites": "None"}	{"Gives you a vocabulary for what you are feeling","Maps every tool in this course to the right state","Cuts through \\"stress vs. calm\\" oversimplification"}	{"Polyvagal theory has critics in academic neuroscience — treat it as a useful clinical model, not settled physics"}	## The three states\n\nPorges' polyvagal model describes three autonomic states, each with a clear bodily signature:\n\n| State | Body cue | When you are in it |\n|---|---|---|\n| **Safe / social** (ventral vagal) | Warm, open, easy breath | Relaxed conversation, flow |\n| **Fight / flight** (sympathetic) | Tight, alert, fast breath | Stress spike, urgency |\n| **Shutdown** (dorsal vagal) | Heavy, numb, dissociated | Burnout, overwhelm, depression |\n\nMost wellness advice acts as if there are only two states (stressed vs. calm). The shutdown state — heavy, exhausted, "checked out" — needs DIFFERENT tools than fight-or-flight.\n\n## The toolkit (next 4 lessons)\n\n| Tool | Best for |\n|---|---|\n| **NSDR / Yoga Nidra** | Recovery from depletion (shutdown → safe) |\n| **Coherent breathing (5.5 bpm)** | Building baseline regulation |\n| **Cold face dive reflex** | Aborting acute panic (fight-or-flight → safe) |\n| **Polyvagal awareness** | Knowing which tool to use |\n\n## What we deliberately skip\n\n- Long discussions of vagus nerve anatomy\n- Trendy "vagus nerve stimulation" devices — most are speculative\n- Trauma-specific protocols — work with a trauma-informed therapist\n\n## The single biggest mistake\n\nUsing the wrong tool for your state. If you are in shutdown, breathing exercises can deepen the freeze. If you are in fight-or-flight, NSDR can leave you wired underneath. Awareness comes first.	[{"year": 2011, "title": "The Polyvagal Theory", "author": "Porges, S."}, {"year": 2018, "title": "The Polyvagal Theory in Therapy", "author": "Dana, D."}]	1	2026-05-02 17:52:11.401192+00	2026-05-02 17:52:11.401192+00	2026-05-02 17:52:11.401192+00	1	You cannot regulate what you cannot name. Most people cycle between sympathetic activation and shutdown all day without noticing. The state map turns vague "stress" into a precise read — and gives every tool in this course a clear use case.	{"Set 3 phone alarms today. At each one, name your state: ventral, sympathetic, or dorsal.","Notice the trigger that put you there.","Notice what naturally pulls you back to ventral (a person, a place, a movement)."}	{"Three states: ventral (online), sympathetic (revved), dorsal (offline).","Naming the state is the first regulation skill. Awareness is the lever.","You move between states constantly. The goal is faster recovery, not permanent calm."}	[{"q": "How many autonomic states does the polyvagal model describe?", "choices": ["Two: stressed and calm", "Three: safe/social, fight-or-flight, shutdown", "Five"], "correct": 1, "explain": "The third state — shutdown — is what makes polyvagal practical. Burnout, dissociation and depression live there, and they need different tools than fight-or-flight."}, {"q": "Why does the wrong tool sometimes make things worse?", "choices": ["Tools never make things worse", "Using a calming tool in shutdown can deepen the freeze; activating tools in fight-or-flight can spike further", "Only psychiatric meds matter"], "correct": 1, "explain": "Tools have a directional effect. State-awareness is the meta-skill that tells you which direction to push."}]	foundations
f3f0c92c-1b24-4f20-8ba4-abefbd052a7f	nervous-system	polyvagal-fundamentals	Polyvagal theory: the basics	Why "calm down" doesn't work — and what does	Polyvagal theory (Porges) explains why willpower can't override a stressed nervous system. The vagus nerve runs on co-regulation and physiological safety cues — not commands. This lesson translates the theory into actionable signals.	promising	6	{"duration": "reading + 5–10 min daily practice", "frequency": "daily; on-demand when dysregulated", "intensity": "identify state → apply matching tool (humming, gargling, slow exhale, cold face)", "prerequisites": "none — trauma history: do with trauma-informed practitioner"}	{"Language to identify nervous system state in real time","Tool selection matches the state (no more \\"calm down\\" advice that fails)","Improves co-regulation in relationships","Highly compatible with therapy work"}	{"Polyvagal theory's neuroanatomy is debated in some specialist circles — the *practical tools* still work","Trauma-informed framing is essential when working with PTSD","Not a replacement for clinical care"}	## The three states\n\nPolyvagal theory (Porges, 1995, 2011) maps the autonomic nervous system into three hierarchical states:\n\n| State | Feels like | Bodily signals |\n|---|---|---|\n| **Ventral vagal (safety)** | Connected, curious, present, playful | Steady HR, eye contact easy, voice prosody |\n| **Sympathetic (mobilised)** | Anxious, angry, racing, "wired" | Fast HR, shallow breath, narrow vision |\n| **Dorsal vagal (shutdown)** | Numb, disconnected, foggy, "checked out" | Low HR, low energy, dissociation |\n\nThe states are **hierarchical**: from shutdown you must pass through sympathetic activation to reach safety. Trying to "calm down" from full mobilisation by going limp doesn't work — your body needs to discharge first.\n\n## Why this matters in practice\n\nMost stress advice ("just relax", "take a deep breath") assumes you're already in ventral vagal and just need a top-up. If you're in sympathetic mobilisation, telling yourself to relax often *increases* arousal. The polyvagal frame gives you state-matched tools.\n\n## The toolkit by state\n\n**If sympathetic (anxious, angry, racing):**\n- Long exhalation breathing (5-5-5-5 or extended exhale 4-in / 8-out)\n- Cold water on the face — activates the mammalian dive reflex (see separate article)\n- Slow voo / humming — vagus nerve runs through the throat\n- Movement to discharge: walk, shake, push against a wall\n\n**If dorsal vagal (numb, frozen):**\n- Don't try to "relax" — gently mobilise first\n- Brief light movement: walking, easy bouncing\n- Cold splash + quick movement\n- Then transition to ventral tools\n\n**To stay in ventral (the goal):**\n- Co-regulation with safe people (eye contact, slow conversation)\n- Singing, humming, playing music\n- Gentle Zone 2 movement\n- Time outdoors\n\n## A daily 5-min ventral practice\n\n1. **Long exhale breathing** — 2 min (4 in / 8 out).\n2. **Humming "voo"** on each exhale — 1 min.\n3. **Soft eye gaze** at something pleasant or person's face — 2 min.\n\nDo this daily for 4 weeks. The body learns the route.	[{"year": 2011, "title": "The Polyvagal Theory", "author": "Porges"}, {"year": 2018, "title": "The Polyvagal Theory in Therapy", "author": "Dana"}, {"url": "https://pubmed.ncbi.nlm.nih.gov/30356789/", "year": 2018, "title": "Breath of Life: respiratory vagal stimulation", "author": "Gerritsen & Band"}]	2	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2	Telling a sympathetic-activated person to "relax" is like telling a sprinting heart to slow on command. Polyvagal theory tells you which inputs the nervous system actually responds to: breath, posture, gaze, voice tone, social safety. Use the inputs that work.	{"Soften your jaw, drop your shoulders, lengthen your exhale. Hold for 60 seconds.","Make eye contact with someone you trust today. Notice the regulation that follows.","Identify ONE place or person that reliably puts you back into ventral. Visit them this week."}	{"The vagus nerve responds to physiological inputs, not verbal commands.","Co-regulation is the fastest path back: voice, eye contact, slow breath.","Safety cues > willpower. Engineer your environment, don't fight it."}	[{"q": "How many primary autonomic states does polyvagal theory describe?", "choices": ["Two: stress and calm", "Three: safe/social, fight-or-flight, shutdown", "Five"], "correct": 1, "explain": "The three-state model is what makes polyvagal practical — including shutdown explains exhaustion and emotional numbing the old two-state model missed."}, {"q": "Vagal tone is the body's…", "choices": ["Stress accelerator", "Parasympathetic brake", "Hormonal panel"], "correct": 1, "explain": "The vagus nerve is the main parasympathetic highway — better tone = faster, smoother return to baseline after stress."}]	protocol
1c69fef4-61bb-4427-ac46-f41dc68c1afd	nervous-system	nsdr-yoga-nidra	NSDR / Yoga Nidra	A 10-minute deposit against sleep debt	Non-Sleep Deep Rest (NSDR) and Yoga Nidra are guided protocols that drop you into a state physiologically similar to deep sleep — without sleeping. Ten to twenty minutes restores dopamine, sharpens focus, and partially repays sleep debt.	promising	4	{"duration": "10–20 min", "frequency": "daily or 3–4×/week; particularly after a poor night's sleep", "intensity": "lying down, eyes closed, follow guided audio", "prerequisites": "a quiet room and a guided track"}	{"Restores energy after a poor night's sleep","~65 % increase in striatal dopamine in one PET study (Kjaer 2002)","Lowers cortisol and blood pressure acutely","Improves attention and learning consolidation"}	{"Some people fall fully asleep — fine, but set an alarm if needed","Lying flat is uncomfortable for some — bend knees or use a bolster","Trauma-sensitive: choose a teacher with appropriate training"}	## What it is\n\nNSDR (a term popularised by Andrew Huberman) is the secular umbrella for **Yoga Nidra-style guided body scans** that walk you through systematic relaxation while staying in a hypnagogic, semi-aware state.\n\nA typical 15-minute session:\n\n1. **Lie flat**, eyes closed.\n2. **Body scan** — attention moves slowly from feet to head, releasing tension at each region.\n3. **Breath awareness** — long, slow nasal breathing.\n4. **Visualisation or rest** — depending on the tradition.\n5. **Gentle re-orientation** — small movements, then sit up.\n\n## Why it works\n\n**Kjaer et al. (2002)** scanned brains of experienced meditators during Yoga Nidra and observed a **~65 % increase in dopamine release** in the striatum — comparable to taking a low-dose stimulant. Dopamine in this region governs motivation and willingness to act.\n\n**Datta et al. (2017, 2021)**: 8 weeks of Yoga Nidra in students reduced anxiety and improved sleep quality vs control.\n\n**Mechanistically**: NSDR shifts you into a **theta-dominant brain state** (similar to early sleep stages) without falling asleep. This state appears to consolidate motor and declarative learning, restore attention, and lower sympathetic tone.\n\n## When to use it\n\n- **After a bad night's sleep** — 20 min around midday is the closest thing to a "make-up deposit" we have.\n- **Mid-afternoon dip** — alternative to caffeine after 14:00.\n- **Pre-creative work** — clears mental clutter before deep focus.\n- **Wind-down before bed** — though it can be too activating for some.\n\n## How to actually start\n\n- Search "NSDR" or "Yoga Nidra" on YouTube/Spotify (free Huberman, Liam Gillen, Ally Boothroyd tracks).\n- **Lie flat or recline.** Knees bent if back hurts.\n- **No headphones is fine** — speakers work.\n- **Don't try to "do it right"**. Even falling asleep some sessions is fine.\n- **Start with 10 min.** Build to 20 if it serves you.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/11958969/", "year": 2002, "title": "Increased dopamine tone during meditation-induced change of consciousness", "author": "Kjaer et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/34390388/", "year": 2021, "title": "Yoga Nidra and sleep quality", "author": "Datta et al."}, {"year": 2022, "title": "NSDR Toolkit", "author": "Huberman Lab podcast"}]	3	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	3	You will not always sleep enough. NSDR is the closest thing to a make-good. Stanford's Andrew Huberman uses it daily. The protocol is free, requires no skill, and produces measurable cognitive recovery — especially after a poor night.	{"Search YouTube for \\"NSDR Huberman 10 minute\\" or \\"Yoga Nidra 20 minute\\".","Lie flat on your back, eyes closed, headphones in. Follow the audio.","Best windows: post-lunch dip (13:00–15:00) or after a poor night's sleep."}	{"NSDR is sleep's little brother — restorative, but not a full replacement.","10–20 min restores dopamine and rebuilds focus mid-day.","Use it as a tool, not a habit. Real sleep is still the foundation."}	[{"q": "What did the seminal Yoga Nidra study (Kjaer et al. 2002) measure?", "choices": ["A 65% rise in endogenous dopamine", "Increased cortisol", "Lower body temperature only"], "correct": 0, "explain": "Kjaer et al. measured a 65% increase in striatal dopamine release during NSDR — comparable to no other behavioural intervention."}, {"q": "NSDR is BEST used when…", "choices": ["You're already well-rested and energetic", "You're fatigued, sleep-deprived, or post-training", "Right before bed"], "correct": 1, "explain": "NSDR is a recovery tool — it shines when there is a recovery debt to repay, especially in the post-lunch dip or after hard training."}]	protocol
45b0ecae-45b2-4757-b232-61e609acfd4f	nervous-system	coherent-breathing-5-5	Coherent breathing at ~5.5 bpm	The resonance frequency that maxes HRV	Breathing at roughly 5.5 breaths per minute (about 5.5 seconds in, 5.5 seconds out) hits the cardiovascular resonance frequency — the cadence at which heart rate variability is maximised. Daily practice trains long-term vagal tone.	promising	4	{"duration": "5–20 min", "frequency": "daily", "intensity": "5.5 s in / 5.5 s out, gentle nasal breathing", "prerequisites": "none"}	{"Acute increase in HRV (often 2–3× baseline)","Lower blood pressure with 8+ weeks of regular practice","Improved emotional regulation and focus","Useful for performance anxiety and panic"}	{"Light-headedness if forced — keep it gentle","Pregnancy: shorten holds, no breath retention","Asthma sufferers: ensure exhale is unforced"}	## The resonance frequency\n\nThe cardiovascular system has a natural **resonance frequency** — usually around **5.5–6.5 breaths per minute** in adults. Breathing at this rate causes blood pressure and heart rate oscillations to **synchronise constructively**, producing a maximal increase in heart-rate variability (HRV).\n\nHigher HRV → better autonomic flexibility → better stress tolerance, recovery, and emotional regulation. Athletes, special-forces operators and clinicians have all converged on this frequency as a powerful baseline practice.\n\n## The pattern\n\n```\nInhale 5.5 s\n│   │   │   │   │\n└───┴───┴───┴───┘\n        ↓\nExhale 5.5 s\n│   │   │   │   │\n└───┴───┴───┴───┘\n```\n\nNose-breathe both in and out. No holds. The breath should be smooth, soft, and quiet — if anyone could hear it, slow down.\n\n## What it does (acutely)\n\n- **Doubles or triples HRV within minutes** of starting (Lehrer & Gevirtz, 2014).\n- **Activates the baroreflex** — the system that regulates blood pressure.\n- **Shifts autonomic balance** sharply toward parasympathetic.\n\n## What it does (long-term)\n\n8+ weeks of 20 min/day:\n- **Reduced systolic BP** by 4–5 mmHg in hypertensive subjects (Joseph et al., 2005).\n- **Improved depression and anxiety scores** in clinical populations (Goessl et al., 2017 meta-analysis).\n- **Sustained baseline HRV improvement** even outside of practice.\n\n## How to do it\n\n- **Easiest entry**: download a "coherent breathing" or "resonance breathing" app (e.g. Breathwrk, Othership, or just a metronome at 5.5 bpm).\n- **Posture**: sit upright, spine relaxed, shoulders soft.\n- **Start at 5 min/day** for week one.\n- **Build to 10–20 min/day** by week 4.\n- **Best times**: morning before work, mid-afternoon dip, or wind-down before bed.\n\nIf 5.5 s feels too slow, start with 4-4 and lengthen by 0.5 s per week until you reach 5.5 or 6 s.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/25101026/", "year": 2014, "title": "Heart rate variability biofeedback: how and why does it work?", "author": "Lehrer & Gevirtz"}, {"url": "https://pubmed.ncbi.nlm.nih.gov/15630092/", "year": 2005, "title": "Slow breathing and hypertension", "author": "Joseph et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/28478782/", "year": 2017, "title": "HRV biofeedback for stress and anxiety", "author": "Goessl et al."}]	4	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	4	High HRV is the single best non-invasive marker of nervous-system fitness. Coherent breathing is the most efficient way to train it: no app, no device, no skill. Five minutes daily compounds into a measurably more resilient autonomic baseline.	{"Set a 5-minute timer. Breathe in for 5.5 seconds, out for 5.5 seconds. Through the nose.","Use a metronome app or \\"Breathwrk\\" / \\"Othership\\" to keep cadence honest.","Same time each day — ideally morning or pre-sleep — to compound the adaptation."}	{"Target cadence: ~5.5 breaths per minute. The exact number that maxes HRV.","Daily 5 minutes raises baseline HRV in 4–8 weeks.","Trains the nervous system the way Zone 2 trains the heart: low intensity, high consistency."}	[{"q": "What is the approximate resonance frequency breath rate for most adults?", "choices": ["12 bpm", "~5.5 bpm", "20 bpm"], "correct": 1, "explain": "~5.5 bpm (≈11 sec per cycle) maximizes heart rate variability and engages the baroreflex most strongly."}, {"q": "How long does it typically take to see baseline HRV gains from coherent breathing?", "choices": ["A single session", "4–8 weeks at 5 min/day", "Years"], "correct": 1, "explain": "Lehrer et al. and Steffen et al. show measurable HRV baseline shifts in 4–8 weeks of consistent daily practice."}]	protocol
44854a25-d308-45e1-b0e5-a802dbc7167f	nervous-system	cold-face-dive-reflex	Cold face: the mammalian dive reflex	30 seconds to kill a panic spike	Submerging the face in cold water (or holding a cold pack to the cheekbones and forehead) triggers the mammalian dive reflex — an automatic vagal response that drops heart rate by 10–25% within seconds. The fastest known anti-panic tool.	strong	3	{"duration": "30–60 s", "frequency": "on-demand for acute panic, anger, dissociation", "intensity": "face submerged in ~10 °C water OR ice pack on forehead/cheeks while breath-holding", "prerequisites": "healthy heart — known arrhythmia: clear with cardiologist"}	{"Immediate parasympathetic activation (HR drops 10–25 % in seconds)","Used in DBT (TIPP skill) to abort panic, dissociation, and rage","Free, deployable anywhere with a sink","Effects last ~30 minutes after a single application"}	{"Known cardiac arrhythmia: do not use without medical clearance","Cold sensitivity disorders: shorten exposure","Avoid if extremely cold and shivering — opposite goal"}	## The reflex\n\nThe **mammalian dive reflex** is hard-wired in all air-breathing vertebrates. When the **face is exposed to cold water** (especially the forehead, eyes, and cheeks) **while breath-holding**, the body triggers:\n\n- **Bradycardia** — heart rate drops 10–25 % within seconds.\n- **Peripheral vasoconstriction** — blood shunts to vital organs.\n- **Strong parasympathetic dominance** — sympathetic "panic" signal is overridden.\n\nIt evolved to help mammals conserve oxygen during dives. The same reflex doubles as the most reliable acute parasympathetic activator known.\n\n## How to use it\n\n**Method 1: Sink dunk**\n1. Fill a sink with cold water (~10 °C, add ice if needed).\n2. Hold breath, lean forward, **submerge face from forehead to chin for 30 s**.\n3. Repeat 1–2× if needed.\n\n**Method 2: Ice pack** (for use anywhere)\n1. Hold a flexible ice pack (or cold wet cloth) **firmly across forehead, eyes and cheeks**.\n2. Hold breath while applying.\n3. **30–60 s.** Repeat 1–2× if needed.\n\n## Where it's used clinically\n\nThe **TIPP skill** in Marsha Linehan's **Dialectical Behaviour Therapy** uses cold face exposure as the **first line for severe emotional dysregulation, panic, and dissociation**. It works in seconds, when nothing else does.\n\nIt's also used by emergency physicians to **terminate supraventricular tachycardia (SVT)** in healthy patients before pharmacological intervention.\n\n## When to reach for it\n\n- **Panic attack onset** — abort within 60 s.\n- **Dissociation/freeze** — pulls you back into your body.\n- **Rage spike** — buys 30 minutes of clear thinking.\n- **Cannot fall asleep due to anxious arousal** — apply once, then attempt sleep.\n\n## What it's NOT\n\n- A cold plunge protocol — totally different mechanism (and goal).\n- A daily practice — best reserved for acute use, where the contrast is the medicine.\n- Safe for everyone — anyone with diagnosed arrhythmia or cardiac conditions should clear it with their clinician first.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/15705636/", "year": 2005, "title": "The human diving response", "author": "Foster & Sheel"}, {"year": 2014, "title": "DBT Skills Training Manual", "author": "Linehan"}, {"url": "https://pubmed.ncbi.nlm.nih.gov/11710698/", "year": 2001, "title": "Effect of immersion, submersion and apnea on the diving response", "author": "Schipke & Pelzer"}]	5	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	5	In a panic spike or rage moment, the body needs an override that bypasses thinking. The dive reflex is hard-wired: cold receptors on the face trigger immediate parasympathetic dominance. Used clinically in DBT for emotional crises. It works in 30 seconds.	{"Fill a bowl with cold water (under 15°C / 60°F). Add ice if you have it.","Hold your breath, dunk your face for 15–30 seconds. Or press a cold pack to forehead + cheekbones.","Repeat 1–2 times. Notice the heart rate drop and emotional reset."}	{"Cold + face + breath-hold = mammalian dive reflex. Hard-wired, automatic.","Use for acute panic, rage, or overwhelming emotion. Not for chronic stress.","The DBT \\"TIP\\" skill — clinically validated for crisis tolerance."}	[{"q": "Why does cold water on the face slow your heart rate so quickly?", "choices": ["It distracts you", "It triggers the mammalian dive reflex via the trigeminal nerve", "It releases adrenaline"], "correct": 1, "explain": "Cold water on the trigeminal-innervated forehead/cheeks triggers a vagal cascade — bradycardia plus peripheral vasoconstriction in seconds."}, {"q": "What is this technique BEST used for?", "choices": ["Daily meditation", "Acute panic, anxiety spiral, or sleeplessness from stress", "Building muscle"], "correct": 1, "explain": "It is an acute-state break-glass tool — extremely fast onset for nervous-system override, not a daily wellness habit."}]	protocol
28735731-b918-4c0a-9bca-97106135c68b	recipes	foundations-performance-nutrition	Foundations: How to think about food	Pattern over perfection	Performance nutrition rests on four pillars: hit a protein floor, fuel carbs around training, eat a Mediterranean base, and use caffeine as a tool. Get those right and 90% of the result follows. The next four lessons are the protocols.	strong	4	{"duration": "4 min read", "frequency": "Read once, return as needed", "intensity": "Conceptual", "prerequisites": "None"}	{"A clear mental model for every food decision","Stops you from chasing fad diets","Sets you up to apply the next 4 lessons"}	{"Not a substitute for medical or registered-dietitian advice for clinical conditions"}	## The four pillars\n\nWe will not teach you a "diet". Diets are short-term identities; PATTERNS are long-term operating systems. Across the next four lessons, you will master four levers:\n\n1. **Protein dose** (how much, how often)\n2. **Workout fueling** (what to eat before, during, after training)\n3. **Mediterranean pattern** (the default base for the other 80% of your meals)\n4. **Caffeine** (the most-studied legal performance tool on Earth)\n\n## Why this order matters\n\nProtein first, because under-eating it is the single most common nutrition mistake in active adults. Workout fueling second, because training is your highest-leverage activity. Mediterranean third, because it is the chassis everything else sits on. Caffeine last, because it is the cherry on top — useful, but not foundational.\n\n## What we ignore\n\n- Specific calorie targets (depends on your goal — track weight + adjust)\n- Supplements beyond protein and caffeine (most have weaker evidence than diet basics)\n- Trendy frameworks (carnivore, fruitarian, IF as religion) — none beat the Mediterranean pattern in head-to-head outcome data\n\nRead this once. Then move to Lesson 2.	[{"year": 2023, "title": "Outlive: The Science and Art of Longevity", "author": "Attia, P."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/25315456/", "year": 2014, "title": "Dietary protein for athletes — review", "author": "Phillips, S."}]	1	2026-05-02 17:52:11.401192+00	2026-05-02 17:52:11.401192+00	2026-05-02 17:52:11.401192+00	1	Without a mental model, you'll treat nutrition as a checklist and quit in three weeks. The four pillars are the spine. They're ordered intentionally: protein first because it has the largest signal, caffeine last because it's a multiplier, not a foundation.	{"Read this lesson today. Commit to one new lesson per day for the next four days.","Audit your last 24 hours against the four pillars. Which one is weakest?","That weakest pillar is where the next lesson will give you the biggest return."}	{"Patterns beat diets. Identity beats discipline.","Order matters: protein → workout fueling → Mediterranean base → caffeine.","You're training a system, not following a recipe."}	[{"q": "What is the difference between a diet and a pattern?", "choices": ["No difference", "A diet is short-term and identity-based; a pattern is a long-term operating system", "Diets are healthier"], "correct": 1, "explain": "Patterns survive holidays, vacations, busy weeks. Diets do not. The Mediterranean evidence is so strong precisely because it is a pattern."}, {"q": "Which pillar is the FIRST priority for active adults?", "choices": ["Caffeine", "Protein dose", "Avoiding seed oils"], "correct": 1, "explain": "Under-eating protein is the most common, highest-cost nutrition mistake in active adults — addressing it has the largest single impact."}]	foundations
1ddf730a-afe1-4215-89b0-0c13ea911a8d	recipes	workout-fueling-stack	Pre / intra / post-workout fueling	Carbs around training — when, how much, why	Carbs are the highest-octane fuel you have for hard training. Pre, during, and post-workout windows have specific roles: top off glycogen, sustain output, refill stores. Get these three windows right and your training quality jumps.	strong	5	{"duration": "around training", "frequency": "every training session", "intensity": "pre 1–2 g/kg carbs · intra 30–60 g/h · post 0.3 g/kg protein + 1 g/kg carbs", "prerequisites": "none"}	{"Higher work output and rep quality","Faster glycogen replenishment","Better next-day session readiness","Reduced muscle protein breakdown"}	{"Fasted training is fine for sessions <60 min","Avoid high-fibre/high-fat right before training (GI distress)","Diabetics should adjust intra-workout carbs with their clinician"}	## The framework\n\nResearch from the International Society of Sports Nutrition (Kerksick et al., 2017) consolidates decades of work:\n\n- **Pre (90–180 min before)**: 1–2 g/kg of mostly carbs with ~20–40 g protein. For a 75 kg lifter that's ~75–150 g carbs (oats + banana + Greek yogurt nails it).\n- **Intra (only if >75 min or two-a-day)**: 30–60 g carbs/hour, mixed source (glucose + fructose) to bypass single-transporter saturation.\n- **Post (within 2 h)**: ~0.3 g/kg protein (≈25 g for a 75 kg adult) + 1 g/kg carbs. Whey + rice cakes, milk + cereal, or just a normal meal — the 30-minute "anabolic window" myth is dead (Aragon & Schoenfeld, *JISSN* 2013).\n\n## What actually moves the needle\n\n1. **Carbs pre-training raise rep performance** by 3–7 % across resistance and endurance (Lambert & Flynn, 2002).\n2. **Hydration > timing**: a 2 % body-weight fluid loss tanks performance more than any timing trick.\n3. **Total daily intake matters most** — if you're hitting protein and carb targets across the day, "missing" a perfect post-workout shake costs you nothing.\n\n## Practical defaults\n\n- Lifting fasted in AM? Coffee + 20 g whey + dextrose works.\n- Hitting the gym after work? A real lunch 3–4 h before is enough; add 30 g carbs 30 min before if energy is low.\n- Endurance >90 min? Bring 60 g carbs/hour as gels or sports drink.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/28919842/", "year": 2017, "title": "ISSN: nutrient timing", "author": "Kerksick et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/23360586/", "year": 2013, "title": "Nutrient timing revisited", "author": "Aragon & Schoenfeld"}]	3	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	3	Most people either fear carbs or eat them randomly. Both leak performance. Strategic carb timing around training extends working capacity, lifts intensity, and accelerates recovery — without changing total daily intake.	{"Pre (60–90 min before): 30–60 g easy carbs (oats, fruit, rice, toast).","Intra (sessions >75 min): 30–60 g/hour from a sports drink, gel, or fruit.","Post (within 60 min): 1–1.2 g carbs/kg + 20–40 g protein. Eat a real meal."}	{"Pre = top off. Intra = sustain. Post = refill. Each window has a job.","Total daily carbs scale to training volume. Hard days more, rest days less.","Carbs are not optional for hard training — they are the working fuel."}	[{"q": "For a 60-minute strength session, intra-workout carbs are…", "choices": ["Essential", "Optional — only critical past ~75 min", "Banned"], "correct": 1, "explain": "Glycogen handles 60–75 min easily. Intra-workout carbs become meaningful for longer or back-to-back sessions."}, {"q": "How wide is the post-workout protein window?", "choices": ["30 minutes — strict", "Roughly 2 hours", "24 hours"], "correct": 1, "explain": "Recent research (Schoenfeld, Aragon) shows the window is ~2 h, not the 30-min myth. Total daily protein matters more than precise timing."}]	protocol
e5b5ac62-75ea-4db3-a71a-8f2efff76746	recipes	mediterranean-pattern	Mediterranean eating pattern	The most-evidenced longevity diet on the planet	Olive oil, fish, vegetables, legumes, nuts, whole grains, moderate dairy, minimal red and processed meat. The Mediterranean pattern has 60+ years of data behind it for cardiovascular health, cognitive aging, and all-cause mortality.	strong	5	{"duration": "lifestyle", "frequency": "daily pattern, not a diet phase", "intensity": "≥5 servings vegetables/fruit · 2–3 servings fish/wk · ~4 tbsp extra-virgin olive oil/day · 30 g nuts/day · minimal ultra-processed food", "prerequisites": "none"}	{"~30 % lower major cardiovascular events (PREDIMED)","Lower all-cause mortality and dementia risk","Improved insulin sensitivity and lipid profile","Compatible with most cuisines and budgets"}	{"Olive oil is calorie-dense — measure if fat loss is the goal","Higher cost in some regions; tinned fish, beans and frozen veg fix this","Fish allergy sufferers should sub plant omega-3 sources"}	## What it actually is\n\nThe Mediterranean pattern isn't a "diet" — it's a way of eating documented across coastal Greece, Italy, Spain and parts of North Africa. The defining traits:\n\n- **Plants are the base**: vegetables, fruit, legumes, whole grains, nuts.\n- **Fat comes from olive oil** (≈40 % of calories), not butter or seed oils.\n- **Fish 2–3×/week**, poultry and dairy in moderation, red meat rarely.\n- **Wine with meals (optional)**, never on its own.\n- **Almost no ultra-processed food.**\n\n## The evidence\n\n**PREDIMED** (Estruch et al., *NEJM* 2018, re-analysis): 7,447 high-cardiovascular-risk adults randomised to Mediterranean + extra olive oil, Mediterranean + nuts, or low-fat. Both Mediterranean arms cut **major CV events by ~30 %** over 5 years vs the low-fat control.\n\n**Lyon Diet Heart Study** (de Lorgeril, 1999): 70 % reduction in cardiac events in post-MI patients.\n\n**Cohort meta-analyses** (Sofi et al., *BMJ* 2008): each 2-point increase on the Mediterranean Adherence Score → 8 % lower all-cause mortality, 10 % lower CV mortality, 13 % lower neurodegenerative disease.\n\n## How to start\n\n1. Make **vegetables the largest item on the plate** at lunch and dinner.\n2. Default fat to **extra-virgin olive oil**.\n3. Eat **fish twice a week** (tinned sardines and salmon count).\n4. Snack on **nuts and fruit**, not packaged snacks.\n5. Cap red meat at ~1×/week.	[{"url": "https://www.nejm.org/doi/full/10.1056/NEJMoa1800389", "year": 2018, "title": "PREDIMED", "author": "Estruch et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/9989963/", "year": 1999, "title": "Lyon Diet Heart Study", "author": "de Lorgeril et al."}, {"url": "https://www.bmj.com/content/337/bmj.a1344", "year": 2008, "title": "Mediterranean diet and health", "author": "Sofi et al."}]	4	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	4	No single diet has more long-term outcome data. The PREDIMED trial alone showed a 30% drop in major cardiovascular events. It is not a "cleanse" or a phase — it is a default operating pattern that compounds over decades.	{"Add one fish meal this week (sardines, salmon, mackerel, anchovies).","Cook in extra-virgin olive oil instead of butter or seed oils today.","Make half your dinner plate vegetables. Add a handful of nuts as a snack."}	{"Pattern: plants + olive oil + fish + nuts. Red meat is a guest, not the host.","30% reduction in cardiovascular events vs control (PREDIMED, NEJM 2018).","Easy to sustain because it is genuinely enjoyable food, not deprivation."}	[{"q": "What is the cornerstone fat of a Mediterranean pattern?", "choices": ["Butter", "Extra virgin olive oil", "Coconut oil"], "correct": 1, "explain": "Olive oil — especially extra virgin — provides monounsaturated fats and polyphenols. PREDIMED used ~4 tbsp/day."}, {"q": "Mediterranean eating is best described as…", "choices": ["A strict 1500-cal diet", "A flexible food pattern, not a calorie protocol", "A keto variant"], "correct": 1, "explain": "It defines food choices and proportions, not calorie targets. That is why it adapts to nearly any goal."}]	protocol
b244767e-e0e3-46bc-ace9-0f64b631070a	recipes	caffeine-timing	Caffeine: dose, timing, half-life	3–6 mg/kg, 45–60 min pre-effort, last dose by 14:00	Caffeine is the most studied legal performance drug on earth. Dose 3–6 mg per kg body weight, take it 45–60 minutes before effort, and stop intake by 14:00 to protect deep sleep. Used right, it is a multiplier. Used wrong, it wrecks the night.	strong	4	{"duration": "acute", "frequency": "45–60 min pre-training; cut all caffeine ≥8 h before bed", "intensity": "3–6 mg/kg body weight (≈200–400 mg adult)", "prerequisites": "adult, no arrhythmia, not pregnant"}	{"~3 % improvement in endurance and strength performance (meta-analysis)","Lower perceived exertion","Sharper focus and reaction time","Cheap, well-tolerated, shelf-stable"}	{"Half-life is 5–7 h — caffeine at 16:00 still blocks adenosine at 23:00","Tolerance builds in ~2 weeks; cycle off 1 week per quarter","Pregnant: cap at 200 mg/day","Anxiety, GERD, hypertension: tread carefully"}	## Performance dose\n\nA 2020 umbrella review (Grgic et al., *Br J Sports Med*) confirmed **3–6 mg/kg of caffeine** improves both endurance and strength performance by **2–7 %**, taken **45–60 minutes before** the effort.\n\nFor a 75 kg adult: **225–450 mg** (a strong coffee = ~120 mg, a pre-workout scoop usually 200–300 mg).\n\n## Why timing matters more than people think\n\nCaffeine's **half-life is 5–7 hours** in most adults — slower in CYP1A2 "slow metabolisers", pregnancy, and on oral contraceptives. That means:\n\n- 200 mg at 14:00 → 100 mg still in your system at 21:00.\n- Walker (2017) and others have shown 200 mg of caffeine within 6 h of bedtime cuts deep sleep by 20 %, even when subjects fall asleep "fine".\n\nRule of thumb: **last caffeine ≥ 8–10 h before target bedtime.** For most people, that's a hard cutoff at **noon or 14:00**.\n\n## Cycling and tolerance\n\n- Tolerance to the *performance* effects builds within ~2 weeks of daily use.\n- A **1-week wash-out per quarter** (or simply skipping caffeine on rest days) preserves the ergogenic edge for hard sessions and competitions.\n\n## When to skip it\n\n- Within 90 min of high-intensity training in the evening.\n- If you're anxious going into a big presentation — sometimes caffeine amplifies nerves more than focus.\n- If you have arrhythmia, untreated hypertension, or are pregnant — talk to a clinician first.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/31613303/", "year": 2020, "title": "Caffeine and exercise performance umbrella review", "author": "Grgic et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/24235903/", "year": 2013, "title": "Caffeine effects on sleep at 0/3/6 hours pre-bed", "author": "Drake et al."}]	5	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	5	Caffeine has a 5–7 hour half-life. The 16:00 coffee is still at half-strength when you go to bed. That is why you "sleep fine" but feel wrecked the next day — your deep sleep was suppressed by yesterday's coffee.	{"Calculate your dose: bodyweight in kg × 3–6 mg. (75 kg = 225–450 mg.)","Time it 45–60 min before training or your hardest cognitive block.","Set a hard cut-off: no caffeine after 14:00. Test for two weeks. Watch your sleep score."}	{"Dose: 3–6 mg/kg. Timing: 45–60 min before effort. Cut-off: 14:00.","Half-life is 5–7 hours. Late coffee = suppressed deep sleep, even if you \\"sleep fine\\".","It is a tool, not a crutch. Cycle off occasionally to keep sensitivity."}	[{"q": "A 70 kg athlete's evidence-based pre-workout caffeine dose is roughly…", "choices": ["50 mg", "210–420 mg", "1000 mg"], "correct": 1, "explain": "3–6 mg/kg × 70 kg = 210–420 mg. That is roughly 2–4 espresso shots."}, {"q": "If your bedtime is 11 PM, when is the latest you should drink coffee?", "choices": ["8 PM", "Around 1–3 PM", "No limit"], "correct": 1, "explain": "With a ~5 h half-life, coffee at 1–3 PM still leaves significant caffeine on board at bedtime — and that fragments sleep architecture."}]	protocol
566961ee-ea21-4706-b43e-c2669fc134cf	recovery	foundations-recovery-and-sleep	Foundations: Sleep is the dose, light is the timer	Three levers, one outcome	Recovery rests on three levers: total sleep duration (the dose), morning light (the timing signal), and protected sleep windows (caffeine cut-off, dark room, cool temp). Get these three and 80% of recovery follows automatically.	strong	4	{"duration": "4 min read", "frequency": "Read once, return as needed", "intensity": "Conceptual", "prerequisites": "None"}	{"Reframes recovery as a system, not a list","Tells you which lever to pull first","Sets up the next 4 protocols in priority order"}	{"If you suspect a clinical sleep disorder (apnea, severe insomnia), see a sleep specialist"}	## The hierarchy\n\nThere is no point optimizing your cold plunge if you sleep 5 hours. Recovery has a clear hierarchy:\n\n1. **Sleep duration** (7–9 h) — the dose\n2. **Sleep timing & circadian anchoring** (morning light) — the timer\n3. **Sleep architecture protectors** (caffeine cut-off) — the variables you control\n4. **Stress / mood adjuncts** (cold exposure) — the cherry, NOT the foundation\n\nThe next 4 lessons walk down this list in order.\n\n## Why morning light is in here\n\nBecause your sleep that night is set 14–16 hours earlier — when light first hits your eyes in the morning. The single highest-leverage thing you can do for tonight's sleep is what you do tomorrow morning at 7 AM.\n\n## What we deliberately skip\n\n- Sleep tracker rabbit holes (Oura, Whoop) — useful, not essential\n- Magnesium / melatonin / supplements — supportive at best, not foundational\n- Mattress / pillow optimization — once it is adequate, returns drop fast\n\n## The single biggest mistake\n\nTreating recovery as a list of "biohacks" rather than a hierarchy. Cold plunges and red lights are interesting; they are not what fixes a 6-hour sleep average.	[{"year": 2017, "title": "Why We Sleep", "author": "Walker, M."}, {"year": 2021, "title": "Huberman Lab Podcast — Sleep series", "author": "Huberman, A."}]	1	2026-05-02 17:52:11.401192+00	2026-05-02 17:52:11.401192+00	2026-05-02 17:52:11.401192+00	1	Most people optimise the wrong layer — supplements, gadgets, hacks — while their fundamentals leak. Sleep duration is the dose, light is the timer that decides when that dose lands. Everything else is decoration on top of these two.	{"Pick a fixed wake time. Same time every day, including weekends, for the next 7 days.","Get outside within 30 minutes of waking for 5–10 minutes. No sunglasses.","Set a caffeine cut-off alarm at 14:00. Defend it."}	{"Sleep is the dose. Light is the timer. Both must be right.","Three levers beat ten supplements. Master the basics first.","Consistency of timing matters more than total quantity, week to week."}	[{"q": "What is the TOP of the recovery hierarchy?", "choices": ["Cold plunge", "Sleep duration (7–9 h)", "Massage"], "correct": 1, "explain": "Sleep duration dominates everything else. No other recovery tool compensates for chronic sleep restriction."}, {"q": "When is the highest-leverage moment for tonight's sleep?", "choices": ["10 PM tonight", "Tomorrow morning, when light first hits your eyes", "After dinner"], "correct": 1, "explain": "Your circadian rhythm is set 14–16 hours before sleep, by morning light exposure. That is when the timer is set."}]	foundations
74394cb5-4134-41a3-93c3-f93e7ac8f2f3	recovery	sleep-7-9-hours	Sleep: 7–9 hours, every night	The closest thing to a master health lever	Seven to nine hours nightly, with a consistent schedule, is the single most powerful intervention for cognition, mood, hormones, recovery, and lifespan. No supplement, training plan, or diet rivals it. The dose-response is steep below 7 hours.	strong	6	{"duration": "7–9 h nightly", "frequency": "every night, including weekends", "intensity": "consistent ±30 min bedtime/wake-time", "prerequisites": "none"}	{"Memory consolidation and learning","Glucose tolerance and insulin sensitivity","Testosterone, growth hormone, leptin/ghrelin balance","Immune function (vaccine response 2× higher in 7+ h sleepers)","Lower 10-year cardiovascular and Alzheimer risk"}	{"Sleep is highly individual — measure your own response, not the average","Shift workers face structural challenges; this protocol assumes a normal schedule","Severe insomnia warrants CBT-I, not willpower"}	## The dose\n\nThe American Academy of Sleep Medicine and Sleep Research Society jointly recommend **≥7 h per night for adults** (Watson et al., *Sleep* 2015). The upper end (~9 h) is also fine — only consistently >10 h or <6 h is associated with worse outcomes.\n\n**Consistency matters as much as duration.** Going to bed at the same time ±30 min anchors your circadian rhythm; "social jet lag" on weekends has been linked to metabolic syndrome (Wittmann et al., 2006).\n\n## Why short sleep is a tax on everything\n\n- **Cognition**: Van Dongen et al. (2003) showed 6 h/night for 14 days caused performance decrements equivalent to a blood alcohol of 0.08 % — and subjects had no idea.\n- **Glucose**: One week of 5 h sleep cuts insulin sensitivity by ~25 % in healthy young adults (Buxton et al., 2010).\n- **Hormones**: 1 week of 5 h sleep drops testosterone by 10–15 % (Leproult & Van Cauter, 2011).\n- **Immunity**: People sleeping <7 h are nearly **3× more likely to catch a cold** than 8 h sleepers (Prather et al., 2015).\n\n## The 7-rule sleep stack\n\n1. **Anchor wake time** — same time daily, even weekends.\n2. **Morning light** — 10 min outside within 60 min of waking.\n3. **Caffeine cut-off** — 8–10 h before bed.\n4. **Last big meal** 2–3 h before bed.\n5. **Cool, dark, quiet** — 17–19 °C, blackout, ear plugs if needed.\n6. **Wind-down ritual** — same 30-min sequence so your brain learns the cue.\n7. **Phone out of the bedroom** — yes, really.\n\nIf you only do one thing: **fix wake time.** Bedtime follows.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/26039963/", "year": 2015, "title": "Joint AASM/SRS sleep duration recommendations", "author": "Watson et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/12683469/", "year": 2003, "title": "Cumulative cost of additional wakefulness", "author": "Van Dongen et al."}, {"year": 2017, "title": "Why We Sleep", "author": "Walker"}]	2	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2	Sleeping 6 hours instead of 8 produces a cognitive deficit equivalent to a 0.10% blood alcohol level after 10 days — and you don't notice it. Sleep debt is invisible to the sleep-deprived. The data is unambiguous: protect the window or pay the tax everywhere else.	{"Pick a target wake time. Count back 8 hours — that is your in-bed time.","Defend that bedtime tonight as if it were a meeting with someone important.","Track for 7 nights. Anything under 7 hours is a tax on tomorrow."}	{"Target: 7–9 hours, every night. The floor is 7, not the ceiling 9.","Consistency of timing > total hours, week to week. Same wake time = the lever.","Sleep debt does not \\"catch up\\" on weekends. The damage is already done."}	[{"q": "What % of adults are genetic short sleepers who truly need <7 h?", "choices": ["About 30%", "Less than 1%", "About 50%"], "correct": 1, "explain": "True short sleepers (DEC2 mutation carriers) are <1% of the population. Almost everyone who claims to need 5 h is sleep-deprived."}, {"q": "Sleeping in on weekends fully repays a week of 6-hour nights. True or false?", "choices": ["True", "False — chronic loss leaves residual cognitive and metabolic deficits", "Only with naps"], "correct": 1, "explain": "Walker's research shows weekend recovery is partial at best. Consistent nightly dose beats compensation."}]	protocol
176f9f40-c1f9-4ec9-abff-344a4cf05de9	recovery	morning-light-anchor	Morning light: 10 minutes outside	The single biggest circadian lever	5 to 10 minutes of bright outdoor light within 30 minutes of waking anchors your circadian clock, sets cortisol to peak in the morning (where it belongs), and pulls melatonin earlier in the evening — making sleep onset easier 14 hours later.	strong	4	{"duration": "10 min on bright/sunny days · 20 min on overcast · 30 min if heavy cloud", "frequency": "daily, every day, year round", "intensity": "outdoor light only — windows block ~50 % of the relevant wavelengths", "prerequisites": "none"}	{"Anchors circadian rhythm — better sleep onset that evening","Sharp alertness boost via morning cortisol pulse","Reduces depression scores in seasonal and non-seasonal mood issues","Improves daytime focus and energy"}	{"Never look directly at the sun","In high-UV regions, get the light early before peak UV","Sunglasses defeat the protocol — clear glasses or contacts are fine"}	## Why morning light\n\nIntrinsically photosensitive retinal ganglion cells (ipRGCs) — discovered by Berson et al. in 2002 — sit in your retina and signal directly to the suprachiasmatic nucleus, your master circadian clock. They're tuned to **bright, blue-rich light**, which means:\n\n- **Outdoor light at 7:00 AM**: 10,000–100,000 lux\n- **Bright office light**: 300–500 lux\n- **Through a window**: ~50 % of the outdoor signal\n\nThe ipRGCs need **photons through the eye, not the skin**. Sunglasses block them; closed eyes block them. Just being outside, eyes open, naturally looking around, is enough.\n\n## What it does (immediately)\n\n- **Boosts morning cortisol pulse** — the healthy kind, sharpens alertness and mood for hours.\n- **Sets the timer for melatonin** to rise ~14–16 h later, so sleep comes more easily that night.\n- **Suppresses lingering melatonin** that's still circulating from the night.\n\n## What it does (long term)\n\nA 2022 UK Biobank analysis (Burns et al., *J Affect Disord*) on 86,000 adults: those getting more daylight averaged **lower depression scores, better self-reported sleep, and higher daytime energy**. The effect was dose-responsive.\n\n## The minimum effective dose\n\n- **Sunny day**: 5–10 min.\n- **Cloudy/overcast**: 15–20 min.\n- **Heavy cloud / pre-dawn / winter**: 30 min, or use a 10,000-lux SAD lamp at desk distance for 20–30 min.\n\nMake it the first thing after waking — paired with coffee, a dog walk, or a 5-min walk to get a real breakfast. The compounding sleep and mood benefits over months and years are massive.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/11834834/", "year": 2002, "title": "Phototransduction by retinal ganglion cells", "author": "Berson et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/36116595/", "year": 2022, "title": "Time spent in daylight and mental health", "author": "Burns et al."}, {"year": 2022, "title": "Sleep Toolkit", "author": "Huberman Lab podcast"}]	3	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	3	Indoor light is 100x dimmer than overcast outdoor light, even if it doesn't look it. Without a strong morning light signal, your body clock drifts. Morning light is free, takes 10 minutes, and produces a measurable shift in sleep, mood, and energy within a week.	{"Tomorrow morning, get outside within 30 minutes of waking.","Stay 5–10 minutes (cloudy day) or 2–5 minutes (clear sky). No sunglasses, eyes open but not staring at the sun.","Pair it with a coffee or a walk. Make it automatic, not a chore."}	{"Window: first 30 minutes after waking. Dose: 5–10 minutes outdoors.","Indoor light won't do it. Lux matters. Get outside.","Pulls evening melatonin earlier — easier sleep onset that night."}	[{"q": "Why doesn't getting bright indoor light count as morning circadian anchoring?", "choices": ["It does count", "Indoor light is 10–100× dimmer than outdoor — usually below threshold", "Walls block UV"], "correct": 1, "explain": "A bright office is ~500 lux. Outdoor cloudy: 10,000 lux. Outdoor sunny: 50,000+ lux. The dose difference is huge."}, {"q": "How long should you aim for on a sunny morning?", "choices": ["1 minute", "5–10 minutes", "2 hours"], "correct": 1, "explain": "5–10 min is typically enough on a sunny day for the SCN (circadian master clock) to register a strong signal."}]	protocol
210fcb3f-ab90-414e-911c-41c63237b994	recovery	caffeine-cutoff	The caffeine sleep cut-off	Why your 16:00 coffee is wrecking deep sleep	Caffeine has a 5–7 hour half-life. A 200 mg coffee at 16:00 leaves 100 mg in your system at 22:00 — enough to suppress deep sleep by 20–30%, even if you fall asleep "fine". The fix is a hard 14:00 cut-off.	strong	4	{"duration": "daily", "frequency": "hard cut-off ≥8–10 h before target bedtime", "intensity": "all caffeine sources (coffee, tea, pre-workout, dark chocolate, some sodas)", "prerequisites": "none"}	{"~20 % more deep sleep within 1 week","Easier sleep onset","Better next-morning alertness without caffeine dependency","Restored caffeine sensitivity over time"}	{"Headaches/fatigue for 2–4 days as adenosine system recalibrates","Slow CYP1A2 metabolisers may need an even earlier cut-off","Decaf still has ~5–10 mg caffeine — fine, but counts"}	## The chemistry\n\nCaffeine works by **blocking adenosine receptors** — adenosine is the molecule that builds up across the day creating "sleep pressure". Block it, and tiredness disappears. Stop blocking it, and the accumulated pressure crashes back.\n\n**Half-life**: 5–7 hours in most adults. That means:\n\n| Time | 200 mg consumed at 09:00 | 200 mg consumed at 16:00 |\n|---|---|---|\n| Bedtime 23:00 | ~25 mg active | ~100 mg active |\n\n100 mg at bedtime is **enough to measurably degrade deep sleep**, even when you fall asleep on time. Drake et al. (2013) showed 400 mg taken 0, 3 or 6 hours pre-bed all reduced sleep duration and quality vs placebo, with the 6-h dose having a clearly measurable effect.\n\n## The dose-response on sleep\n\nA classic Walker & Stickgold finding: people consuming caffeine within 6 h of bed lose **~20 % of their slow-wave sleep** — without realising it. Slow-wave sleep is when your brain clears beta-amyloid (relevant to long-term Alzheimer risk) and your body releases growth hormone.\n\n## The protocol\n\n- **Bedtime 23:00 → last caffeine 14:00.**\n- **Bedtime 22:00 → last caffeine 13:00.**\n- Includes pre-workout, green tea, matcha, dark chocolate, and most "natural energy" drinks.\n\nIf you can't make it through the afternoon, the issue is usually **sleep debt or post-lunch glucose dip**, not "needing" coffee. A 10-min walk or a small protein snack handles both.\n\n## Two-week test\n\nCut caffeine after 14:00 for 14 days. Most people report:\n- Falling asleep faster within ~5 days\n- Deeper sleep / fewer night wake-ups within ~7 days\n- Higher *natural* morning energy within 10–14 days	[{"url": "https://pubmed.ncbi.nlm.nih.gov/24235903/", "year": 2013, "title": "Caffeine effects on sleep at 0/3/6 hours pre-bed", "author": "Drake et al."}, {"year": 2017, "title": "Why We Sleep", "author": "Walker"}, {"url": "https://pubmed.ncbi.nlm.nih.gov/27612937/", "year": 2017, "title": "Coffee, caffeine and sleep", "author": "Clark & Landolt"}]	4	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	4	You can fall asleep on caffeine — and still get poor sleep. Adenosine receptor blockade reduces slow-wave sleep without changing sleep onset. The damage is invisible until you cut the late coffee for two weeks and remember what real recovery feels like.	{"Set a hard caffeine cut-off at 14:00 starting today.","Replace afternoon coffee with: water, herbal tea, a 5-minute walk, or a 10-minute NSDR.","Run the experiment for 14 days. If your sleep doesn't measurably improve, go back. (It will.)"}	{"Half-life: 5–7 hours. A 16:00 coffee is still half-active at bedtime.","Caffeine suppresses deep sleep by 20–30% even when sleep onset feels normal.","Cut-off: 14:00. Non-negotiable for serious recovery."}	[{"q": "You feel like late coffee doesn't affect your sleep. Most likely…", "choices": ["You're right", "Subjective sleep feels fine but deep sleep is measurably suppressed", "Caffeine doesn't cross the blood-brain barrier"], "correct": 1, "explain": "Studies (Drake et al. 2013) show late caffeine cuts ~30 min of deep sleep even when total sleep time is unchanged. You don't notice — your brain does."}, {"q": "For an 11 PM bedtime, the ideal latest caffeine time is around…", "choices": ["8 PM", "1–3 PM", "Any time"], "correct": 1, "explain": "With a ~5 h half-life, 1–3 PM gives caffeine time to clear before bedtime."}]	protocol
631db97c-32c2-4e53-a3e0-fa65531758de	recovery	cold-exposure	Cold exposure: dose, timing, who	2–3 minutes ≤15°C — and never near strength sessions	Deliberate cold exposure (2–3 minutes at 15°C or below, 2–4 times per week) drives a sustained dopamine and norepinephrine release, sharpens focus, and improves resilience. Critical caveat: cold within 6 hours of strength training blunts hypertrophy.	promising	5	{"duration": "2–3 min total per session", "frequency": "2–4× per week, ≥6 h after strength training, never within 4 h of bed", "intensity": "≤15 °C water immersion or cold shower", "prerequisites": "healthy cardiovascular system; not pregnant; no Raynaud's"}	{"Sharp dopamine spike (~250 % over baseline) — durable mood boost","Increased alertness via norepinephrine release","Possible improvements in insulin sensitivity and brown fat activity","Builds the discipline of doing hard things on demand"}	{"Blunts hypertrophy and strength when used within ~6 h of resistance training","Avoid in late evening — too activating for sleep","Cardiovascular conditions, pregnancy, Raynaud's: clear with clinician","Never alone in open water"}	## What the dose actually is\n\nThe most-cited number — popularised by Søberg et al. (2021) — is **~11 minutes per week of total cold exposure**, broken into 2–4 sessions.\n\nA practical structure:\n\n- **3 × 3 min sessions per week**, or\n- **4 × ~2.5 min sessions per week**.\n\nWater (or shower) temperature: **uncomfortably cold** — generally ≤15 °C (≤59 °F). The body can't cheat at this temperature; you're cold whether you breathe through it or not.\n\n## The dopamine effect\n\nŠrámek et al. (2000) measured a **~250 % rise in dopamine** in subjects after cold immersion (14 °C, 1 h). Unlike the dopamine crash you get from short-acting stimulants, the cold-induced rise stays elevated for hours.\n\nThis maps onto the lived experience: a few minutes of cold reliably produces hours of clean alertness and mood lift, with no rebound crash.\n\n## When NOT to use it\n\n**Within 6 hours after strength or hypertrophy training.** Multiple trials (e.g. Roberts et al., 2015; Fyfe et al., 2019) show post-lift cold immersion **blunts long-term strength and muscle growth gains by ~10–25 %** by suppressing the inflammatory signal that drives adaptation.\n\nIf strength is a primary goal: do cold on rest days or before training, not after.\n\n## Practical protocol\n\n1. **End your morning shower with 60–180 s cold.** Build week by week.\n2. **Box-breathe through the gasp reflex** (4-4-4-4) for the first 30 seconds.\n3. **Stop when finished — no need to "tough it out" longer than 3 min.** Diminishing returns and increasing risk past that point for non-acclimatised users.\n4. **Re-warm passively** (towel, dry clothes, movement). Avoid jumping straight into a hot shower if possible — the rebound vasodilation is part of the adaptation.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/34555340/", "year": 2021, "title": "Cold exposure and brown fat / metabolism", "author": "Søberg et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/10751106/", "year": 2000, "title": "Human physiological responses to immersion in cold water", "author": "Šrámek et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/26174323/", "year": 2015, "title": "Post-exercise cold water immersion attenuates training adaptations", "author": "Roberts et al."}]	5	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	5	The cold dopamine response is real and durable — up to 250% baseline for hours. But the same anti-inflammatory effect that helps mood also blocks the inflammatory signal that drives muscle growth. Timing is everything.	{"Start with a 30-second cold finish on your shower. Cool, not Arctic.","Build to 2–3 minutes at the coldest setting over 1–2 weeks.","Schedule cold AWAY from strength training (>6 hours, ideally morning if you lift evening)."}	{"Dose: 2–3 minutes ≤15°C, 2–4×/week. Total: 11+ minutes/week.","Mood and focus benefits are real and well-replicated.","NEVER within 6 hours of strength training. It blocks hypertrophy."}	[{"q": "When is the WORST time to take a cold plunge?", "choices": ["Morning", "Within 4–6 h after a hypertrophy strength session", "Before bed"], "correct": 1, "explain": "Cold immediately post-lifting blunts the inflammatory cascade that drives muscle growth (Roberts et al. 2015)."}, {"q": "Total weekly dose for the documented mood/resilience benefits is roughly…", "choices": ["1 hour daily", "~11 minutes total per week", "30 minutes per session"], "correct": 1, "explain": "Søberg et al. and others converge on ~11 min/week as the threshold dose. More is not better."}]	protocol
aedc464f-1be4-4203-8fb4-98d44c6cf798	training	foundations-strength-conditioning	Foundations: How adaptation actually works	Stress · recover · adapt	Every training adaptation follows the same loop: applied stress → recovery → super-compensation. Get the dose right and you grow stronger. Get it wrong — too much, too little, no recovery — and you stagnate or break. This is the operating system.	strong	4	{"duration": "4 min read", "frequency": "Read once, return as needed", "intensity": "Conceptual", "prerequisites": "None"}	{"A unified mental model for every form of training","Stops you from program-hopping every 3 weeks","Explains WHY the next 4 protocols work"}	{"Not a replacement for individual coaching if you have specific injuries or competitive goals"}	## The adaptation loop\n\nAll training works through one cycle:\n\n1. **Stress** — you do something slightly harder than your body is used to.\n2. **Recovery** — you sleep, eat, and rest enough to repair.\n3. **Adaptation** — your body rebuilds slightly stronger / fitter / more capable.\n\nMiss any step and you get nothing. Most people fail at #2.\n\n## The four levers\n\nThis course covers the four highest-leverage levers across the strength + cardio spectrum:\n\n1. **Progressive overload** — the principle behind every strength gain in history.\n2. **Zone 2 cardio** — the boring base that builds your aerobic engine.\n3. **VO₂max intervals (4×4)** — the most time-efficient ceiling-raiser.\n4. **Deload weeks** — the planned recovery that protects everything else.\n\n## What we deliberately skip\n\n- Specific exercise selection (squat vs. leg press, etc.)\n- Splits (push/pull/legs vs. upper/lower) — they all work if overload is real\n- Trendy modalities (DUP, blood-flow restriction, instability training) — useful but not foundational\n\n## The single biggest mistake\n\nProgram-hopping. The body adapts to the program you actually FINISH, not the one you started. Pick a structure, hold it for 8–12 weeks with progressive overload, then deload, then evaluate.	[{"year": 2020, "title": "Science and Development of Muscle Hypertrophy", "author": "Schoenfeld, B."}, {"year": 2021, "title": "Guidelines for Exercise Testing and Prescription, 11th ed.", "author": "ACSM"}]	1	2026-05-02 17:52:11.401192+00	2026-05-02 17:52:11.401192+00	2026-05-02 17:52:11.401192+00	1	Training programs change. The principle does not. Once you understand the stress-recovery-adapt cycle, every protocol that follows makes sense: progressive overload (controlled stress), Zone 2 (sustainable stress), VO₂max (peak stress), deloads (recovery). All four lessons run on this engine.	{"Audit your last 7 days. Where did you apply stress? Where did you recover?","Identify ONE area where you are doing too much (constant intensity, no rest) or too little (no progressive overload, comfort zone).","That gap is where the next four lessons will give you the biggest return."}	{"Adaptation = stress + recovery. Skip either side and there is no growth.","More is not better. Right dose, right recovery, right repeated is better.","Every protocol in this course is an instance of this one principle."}	[{"q": "Where does adaptation actually happen?", "choices": ["During the workout", "During recovery", "During warm-up"], "correct": 1, "explain": "The session is the stimulus; the rebuild happens during sleep, food, and rest. Skip recovery, lose the adaptation."}, {"q": "What is the single most common reason people do not see results?", "choices": ["Wrong exercises", "Program-hopping before adaptation completes", "Bad genetics"], "correct": 1, "explain": "The body adapts to programs that get FINISHED. Most people abandon an effective program at week 5 because they are bored — and start over with no overload."}]	foundations
8204edde-ea6d-4526-b26d-a0e1d3afec2f	training	progressive-overload	Progressive overload	The one mechanism that drives every adaptation	Progressive overload — gradually increasing training stress through weight, reps, sets, density, or technical difficulty — is the single mechanism behind every long-term gain. Without it you maintain. With it you grow, indefinitely.	strong	5	{"duration": "every training week", "frequency": "weekly micro-progression, monthly macro review", "intensity": "+2.5–5 % load when top of rep range achieved with clean technique", "prerequisites": "sound technique on the lifts being progressed"}	{"Predictable, measurable strength gains","Builds the discipline of tracking","Avoids the \\"treadmill of effort without progress\\" trap","Compounds across years"}	{"Pushing weight before technique is dialled = injury","Joints adapt slower than muscles — increase volume gradually","Without deloads, progression eventually stalls"}	## The principle\n\nProgressive overload, formalised by Selye's **General Adaptation Syndrome** and refined in modern S&C literature, is the requirement that **training stress must rise over time** for adaptation to continue. Once a stimulus is mastered, the body stops adapting to it.\n\n## The four levers\n\nIn order of priority for a healthy lifter:\n\n1. **Load** — add 2.5–5 % when you hit the top of your rep range with crisp technique on every set.\n2. **Reps** — add a rep per set before adding weight (e.g. 5×5 → 5×6 → bump load).\n3. **Sets / volume** — once weekly hard sets per muscle exceed 8–12 (Schoenfeld's minimum effective dose), more sets drive more growth up to ~20.\n4. **Tempo / range / density** — slower eccentrics, deeper ROM, shorter rest. Useful when load can't go up (joint cranky, deload, travel).\n\n## How to actually program it\n\n- **Pick 2–4 main lifts** per movement pattern (squat, hinge, press, pull).\n- **Log every working set**: weight × reps × RIR (reps in reserve).\n- **Use double progression**: e.g. 4×6–8. When all sets hit 8 reps, add 2.5 kg, drop back to 6, climb again.\n- **Run a deload every 4th week** (-40 % volume) when you feel grindy or sleep tanks.\n\n## Common failure modes\n\n- Adding weight before reps are clean → form breaks, then injuries.\n- Random workouts each session ("instinctive training") → no signal, no progression.\n- Ego-loading the bar → CNS fatigue without hypertrophy stimulus.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/27433992/", "year": 2017, "title": "Dose-response of resistance training volume", "author": "Schoenfeld et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/15426442/", "year": 1950, "title": "General Adaptation Syndrome", "author": "Selye"}]	2	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2	Most people train hard but stay the same year after year. The reason is almost always the same: no progression model. Progressive overload is the mathematical requirement for adaptation. The body only changes when forced to.	{"Pick ONE compound lift (squat, deadlift, press, row). Record today's weight × reps.","Next session, add either 1 rep, 2.5 kg, or one set. Pick one variable.","Track in a notebook or app. The log is the program."}	{"Progress one variable at a time: weight, reps, sets, density, or quality.","If you're not tracking, you're not progressing. Memory lies.","Slow and ruthless beats fast and sloppy. 1% per week = 67% per year."}	[{"q": "Which is NOT a valid form of progressive overload?", "choices": ["Adding 1 rep at the same weight", "Slowing the eccentric phase", "Training to failure every set, every session"], "correct": 2, "explain": "Failure every set leads to junk volume and recovery debt. Overload is methodical — small, trackable increments."}, {"q": "What is the single most important habit for sustained progression?", "choices": ["A new program every 4 weeks", "Tracking your sessions", "Pre-workout supplements"], "correct": 1, "explain": "You can't progressively overload what you don't measure. A simple notebook beats the fanciest program with no log."}]	protocol
986d2fea-597b-4b3f-aac9-8bd3d1c2d123	training	zone-2-cardio	Zone 2 cardio: the longevity engine	180 min/week at conversational pace	Zone 2 — the highest intensity at which you can still hold a conversation — builds mitochondrial density, fat oxidation, and aerobic base. Three hours a week, accumulated, is the most evidence-backed longevity training stimulus we have.	strong	6	{"duration": "30–60 min per session", "frequency": "3–4 sessions/week, 150–180 min total", "intensity": "60–70 % HR max · talk test: full sentences possible · ~RPE 5/10", "prerequisites": "no acute cardiac symptoms"}	{"Increases mitochondrial number & density (Attia)","Improves fat oxidation and metabolic flexibility","Lowers resting HR and blood pressure","Major reduction in all-cause mortality (Mandsager et al.)","Zero CNS cost — stacks with strength training"}	{"Most people train Zone 2 too hard — use HR or talk test, not feel","Time-cost is real (3–4 h/wk minimum)","New cardio? Build slowly to avoid overuse injury"}	## What Zone 2 actually means\n\nIíaki San Millán's lab (training top Tour de France riders) defines Zone 2 as the **highest intensity at which lactate stays at or below ~2 mmol/L** — i.e. mitochondria are clearing lactate as fast as they produce it.\n\nWithout a lab, two proxies work well:\n\n- **Heart rate**: 60–70 % of HR max (rough max = 208 − 0.7 × age).\n- **Talk test**: you can speak in full sentences, but a song would be a stretch.\n\nMost people sandbag this — they go too hard and end up in Zone 3 (no man's land), or too easy (Zone 1, no real adaptation).\n\n## Why it's the longevity engine\n\nMandsager et al. (*JAMA Network Open* 2018) followed 122,007 patients undergoing exercise stress testing. Each step up in fitness category linked to **dramatic mortality reductions** — being in the elite category was associated with **~5× lower all-cause mortality** vs the low-fitness group, comparable to or larger than the effect of stopping smoking.\n\nAttia argues VO₂max is "the single most important biomarker for lifespan" — and Zone 2 is the substrate that builds it.\n\n## The protocol\n\n- **3–4 sessions per week**, 30–60 min each.\n- **Total 150–180 min/week** is the sweet spot for a busy non-athlete.\n- **Modes that work**: brisk uphill walking, easy cycling (indoor or out), rowing, swimming, jogging if joints are happy.\n- **Stack with strength** — Zone 2 has minimal CNS impact.\n\n## Common mistakes\n\n1. Training "endurance" at HR 80 % thinking it's Zone 2 → it's threshold work, much more taxing.\n2. Doing 1 long session a week instead of 3–4 — the adaptation needs frequency.\n3. Skipping it because it feels too easy. The point is exactly that it feels easy.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/30334239/", "year": 2018, "title": "Cardiorespiratory fitness and long-term mortality", "author": "Mandsager et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/29127602/", "year": 2018, "title": "Assessment of metabolic flexibility by means of measuring blood lactate", "author": "San Millán & Brooks"}, {"year": 2023, "title": "Outlive", "author": "Attia"}]	3	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	3	Mitochondrial dysfunction underlies most chronic disease and aging. Zone 2 is the only training zone that drives mitochondrial biogenesis at scale. Iñigo San Millán (Tour de France physiologist) calls it "the floor of human performance and the ceiling of healthspan".	{"Find a Zone 2 effort: nose-breathing or holding a full conversation, slightly uncomfortable but sustainable.","Commit to 3 × 60-minute sessions this week (or 4 × 45-minute). Walking incline, rowing, cycling, or jogging.","If you can't talk in full sentences, you're too high. Slow down."}	{"Target: 180 minutes per week minimum. Sustained, not chopped up.","Test: full-sentence conversation = right zone. Gasping = too hard.","The longevity training stimulus. Boring, slow, and the most important thing in the program."}	[{"q": "You're in Zone 2 if…", "choices": ["You're sweating heavily and gasping", "You can hold a full conversation but not sing", "You feel nothing at all"], "correct": 1, "explain": "The talk test is the simplest and most reliable Zone 2 marker without a lab test."}, {"q": "What is the weekly target for general health and longevity?", "choices": ["30 min", "~180 min", "10 hours"], "correct": 1, "explain": "Roughly 180 min/week is the dose backed by Attia, Seiler, and ACSM guidelines for aerobic base building."}]	protocol
ccf8aaab-fbed-47ad-b946-b2f4f0baea08	training	vo2max-4x4	VO₂max: the Norwegian 4×4	One brutal session per week, decades of payoff	Four minutes hard, three minutes easy, repeated four times — the Norwegian 4×4 protocol — is the most efficient stimulus for raising VO₂max. One weekly session adds years to your healthspan and removes the single biggest predictor of all-cause mortality.	strong	5	{"duration": "~30 min total session", "frequency": "1–2× per week, never on consecutive days", "intensity": "4 × 4 min @ 90–95 % HR max · 3 min active recovery between", "prerequisites": "established Zone 2 base of 4–6 weeks; no acute cardiac symptoms"}	{"Largest documented VO₂max gains in trial literature (~10 % in 8 weeks)","VO₂max is one of the strongest predictors of all-cause mortality","Improves stroke volume and mitochondrial efficiency"}	{"High CNS and cardiovascular cost — never two days in a row","Not for absolute beginners — build a Zone 2 base first","Stop immediately for chest pain, dizziness, or arrhythmia symptoms","Untreated hypertension or known cardiac disease: clear with cardiologist"}	## The protocol (Helgerud et al., 2007)\n\n1. **Warm-up** 10 min easy (Zone 1–2).\n2. **4 × 4 min** at 90–95 % HR max — *hard*, you're breathing fast and can only speak single words.\n3. **3 min active recovery** between intervals at ~70 % HR max.\n4. **Cool-down** 5 min easy.\n\nTotal session: ~30 min. Run, bike, ski-erg, row — anything that lets you push large muscle groups.\n\n## Why this dose, this format\n\nHelgerud's landmark trial compared 4 training methods for VO₂max:\n\n- Long slow distance\n- Lactate threshold work\n- 15/15 short intervals\n- **4×4 long intervals** ← winner\n\nThe 4×4 group gained **~10 % in VO₂max over 8 weeks**, double the slow-distance group, with the same total energy expenditure.\n\nVO₂max correlates with **all-cause mortality more strongly than smoking, hypertension or diabetes** (Mandsager 2018) — improving it is one of the highest-leverage things a healthy adult can do.\n\n## How to integrate it\n\n- **Build a Zone 2 base for 4–6 weeks** before adding 4×4. Without it, the intervals feel impossible and recovery suffers.\n- **1×/week** if you also lift heavy 3×/week. **2×/week** if you're cardio-focused.\n- **Place it on a non-leg-heavy lifting day**, ideally with 24+ h before/after the next hard session.\n- **Track**: split times, average HR, RPE. You should see splits hold or improve as fitness builds.\n\n## When to back off\n\nIf morning HR is elevated 5+ bpm for 3 days, or sleep tanks, swap the 4×4 for an easy Zone 2 session. The interval work is potent — and potency cuts both ways.	[{"url": "https://pubmed.ncbi.nlm.nih.gov/17414804/", "year": 2007, "title": "Aerobic high-intensity intervals improve VO2max more than moderate training", "author": "Helgerud et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/30334239/", "year": 2018, "title": "Cardiorespiratory fitness and long-term mortality", "author": "Mandsager et al."}]	4	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	4	VO₂max is the strongest non-modifiable predictor of all-cause mortality we have measured. Doubling it cuts mortality risk roughly in half. The Norwegian 4×4 takes 28 minutes and produces gains in 6–8 weeks. The price-to-payoff ratio is unmatched.	{"Pick a tool: bike, rower, hill, or treadmill. Warm up 10 minutes.","Run 4 rounds: 4 minutes near-max effort (RPE 9/10), 3 minutes easy. Total: 28 min + warm-up/cool-down.","Do this once per week. Do not add a second session — it cannibalises Zone 2 recovery."}	{"Protocol: 4 × (4 min hard / 3 min easy). Once per week. That's the whole thing.","VO₂max is the #1 modifiable predictor of all-cause mortality.","Brutal but brief. The return on 28 minutes is decades."}	[{"q": "What is the work:rest ratio of the Norwegian 4×4?", "choices": ["1:1", "4 min hard : 3 min easy", "30 sec : 4 min"], "correct": 1, "explain": "4 minutes at 90–95% max effort, 3 minutes active recovery, repeated four times. Total ~28 min including warm-up and cool-down."}, {"q": "Why limit 4×4 sessions to 1–2× per week?", "choices": ["Equipment cost", "Recovery cost — it is near-maximal effort", "It's ineffective more often"], "correct": 1, "explain": "Each session is near-VO₂max. More frequent sessions accumulate fatigue faster than they build adaptation."}]	protocol
affbbe99-699d-430d-89b2-20b27fb48c4e	training	deload-periodization	Deload weeks: the missing piece	Every 4th week should be lighter — here's why	Planned deload weeks — reducing volume by 40–60% every 4–6 weeks — let accumulated fatigue dissipate so adaptation can fully express. Skip them and you stall, get hurt, or burn out. They feel like rest. They are actually how progress lands.	promising	4	{"duration": "1 week", "frequency": "every 4th week, or when 3+ accumulating fatigue markers appear", "intensity": "reduce volume ~40 % (sets), keep load 75–85 % of working weights", "prerequisites": "hard training block of 3+ weeks"}	{"Restores joint and connective tissue resilience","Returns CNS to baseline (sleep, mood, focus rebound)","Often produces a small PR upon return","Reduces overuse injury risk"}	{"Skipping deloads doesn't make you tougher — it accumulates","Going too light defeats the purpose: keep load near working weight","New lifters can usually push 6 weeks before needing one"}	## The principle\n\nProgress is **stress + recovery**, not just stress. Israetel and others have argued (and the strength literature shows) that planned **recovery weeks let the slowest-adapting tissues catch up**:\n\n- Muscle adapts in days.\n- CNS recovers in days, but accumulates fatigue across weeks.\n- **Tendons and joint capsules adapt in months.**\n\nIf you train hard for 12 weeks straight, your muscles are ready for more — but your knees, elbows and central drive often aren't.\n\n## The protocol\n\n- **Cut sets by ~40 %** (e.g. 12 working sets/muscle/week → 7).\n- **Keep load 75–85 %** of your usual working weight — heavy enough to feel "real", light enough to recover.\n- **Drop intensity techniques**: no failure work, no AMRAP sets, no drop sets.\n- **Run for one week**, then jump back into the next training block.\n\n## How to time it\n\nTwo viable patterns:\n\n1. **Fixed**: every 4th week is a deload. Predictable, easy to plan around travel.\n2. **Auto-regulated**: deload when ≥3 of these stack up:\n   - Sleep degraded for 3+ nights\n   - Resting HR up 5+ bpm\n   - Mood/motivation drop\n   - Joint pain in lifts that were fine 2 weeks ago\n   - Bar speed decreasing at the same load\n\n## What deloads are NOT\n\n- A week off the gym (you lose the movement pattern groove).\n- A week of "different" workouts (random circuits = same total stress).\n- A diet break (separate variable — manage independently).	[{"year": 2021, "title": "Scientific Principles of Hypertrophy Training", "author": "Israetel et al."}, {"url": "https://pubmed.ncbi.nlm.nih.gov/32568822/", "year": 2020, "title": "Recovery from heavy resistance exercise", "author": "Bell et al."}]	5	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	2026-05-02 17:16:28.052944+00	5	Fitness gains happen during recovery, not training. Without scheduled deloads, fatigue silently masks fitness — you feel weaker, sleep worse, plateau. A planned 4–6 day reduction lets the bill come due. Every elite program builds them in. Most amateur programs don't.	{"Look at your training calendar. When is your next deload week scheduled?","If \\"never\\" — schedule one. Pick week 4, 5, or 6. Cut volume by 40–60% (sets, distance, or sessions).","Keep intensity. Cut volume. Use the extra recovery for sleep, walks, and mobility."}	{"Cadence: deload every 4–6 weeks. Cut volume 40–60%, keep intensity.","Adaptation expresses during recovery, not training. Deloads are when gains land.","Skipping deloads is the most common reason high-intent trainers stagnate."}	[{"q": "What does a deload week look like in practice?", "choices": ["No training at all", "Same exercises, ~60% volume and ~80% intensity", "Random new movements"], "correct": 1, "explain": "Maintain movement patterns and skill, but slash total work. Total rest can detrain you; smart deload restores you."}, {"q": "How often should a trained lifter deload?", "choices": ["Never", "Every 4–6 weeks", "Every 6 months"], "correct": 1, "explain": "4–6 weeks of progressive overload typically accumulates enough fatigue that a deload boosts the next training block."}]	protocol
\.


--
-- Data for Name: vault_lesson_progress; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vault_lesson_progress (id, user_id, article_id, completed_at, quiz_score) FROM stdin;
cd5de7e8-e4f2-45f5-bac2-a3b2fa2484a4	63752d9b-c1ce-498f-9994-d38c462c3c6b	566961ee-ea21-4706-b43e-c2669fc134cf	2026-05-03 13:29:12.552+00	2
386a188b-7aec-485e-8214-fde997b7652a	63752d9b-c1ce-498f-9994-d38c462c3c6b	bc15bbfb-1556-4b0e-8c6a-4ef12b554ac9	2026-05-04 05:37:29.588+00	2
c7d1adf1-49fc-475a-b2c3-d463f47da9ef	63752d9b-c1ce-498f-9994-d38c462c3c6b	74394cb5-4134-41a3-93c3-f93e7ac8f2f3	2026-05-06 09:03:36.275+00	2
\.


--
-- Data for Name: weekly_briefings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.weekly_briefings (id, user_id, week_start, week_end, headline, summary_md, key_insights, next_week_protocol, stats_snapshot, generated_at, viewed_at) FROM stdin;
363eff3c-2f40-4c14-ba2a-773b95b9920b	01a63c98-3dcd-4666-9be1-182d11c3e066	2026-04-13	2026-04-19	Consistent output despite a sleep-driven mid-week dip.	Willehard, you’ve maintained your Elite tier trajectory with a solid 22-day streak, but the data shows a clear vulnerability. Your performance is currently tethered directly to your sleep duration. The Wednesday dip to 204 XP serves as a warning: when sleep falls below 7 hours, your output halving is almost guaranteed.\n\nDespite the mid-week slump, your discipline on core habits—workouts and cold showers—remained at 71% consistency. This is what keeps you at Level 17, but to push higher, you need to eliminate these recovery gaps. Thursday's recovery to 530 XP proves that an 8-hour baseline is your "power zone."\n\nNext week is about stability. You’ve mastered the hydration and the cold exposure. Now, you must protect your sleep as fiercely as you protect your workout schedule. If you keep the floor at 7.5 hours, the XP will follow naturally.	[{"icon": "warning", "title": "The Sleep-Performance Link", "detail": "On April 15, sleep dropped to 6h, causing a 52% drop in XP performance compared to the following day."}, {"icon": "pattern", "title": "Core Habit Resilience", "detail": "You maintained 5/7 workouts and cold showers, securing 1,909 XP and keeping your 22-day streak alive."}, {"icon": "win", "title": "Hydration Benchmarking", "detail": "Hydration is rock solid at 3.1L average, peaking at 3.5L on Sunday, supporting your Elite tier status."}]	[{"why": "6h sleep on Wednesday killed XP by over 300 points.", "action": "Hard 7.5h sleep floor."}, {"why": "Maintaining a 5/7 workout frequency at Level 17 requires better recovery.", "action": "Add 5 mins of mobility work pre-workout."}, {"why": "You only hit 1/7 this week; need higher execution density.", "action": "Log two 'Perfect Days' next week."}]	{"best_day": {"xp": 530, "date": "2026-04-16"}, "total_xp": 1909, "workouts": 5, "avg_sleep": 7.9, "worst_day": {"xp": 204, "date": "2026-04-15"}, "cold_showers": 5, "perfect_days": 1, "avg_hydration": 3.1, "completion_pct": 71, "days_checked_in": 5}	2026-04-19 18:10:59.7178+00	2026-04-20 07:43:24.846+00
7f01bccb-5ba9-4011-a306-fbfa5c940134	01a63c98-3dcd-4666-9be1-182d11c3e066	2026-04-20	2026-04-26	Momentum holds despite a mid-week dip; recovery is becoming your edge.	Willehard, you are maintaining a solid 27-day streak, pushing deep into Legend tier territory. This week proved that your foundation is built on recovery: whenever you hit the 8-hour sleep mark alongside 3L of hydration, your XP output peaks significantly (470 XP on Tuesday). \n\nThe data reveals a slight friction point on Fridays. On April 24th, despite good sleep, the lack of a workout led to your lowest performance of the week (215 XP). This suggests that while your discipline is high, your energy is reactive rather than proactive toward the end of the work week.\n\nYou are 247 XP away from crossing the 10k total XP milestone. Your cold shower consistency (5/7) is currently your most stable discipline. For next week, the mission is to stabilize Friday and bridge the gap to consistent 8-hour sleep cycles to maintain that 27-day momentum.	[{"icon": "win", "title": "The 8h/3L Optimization Pivot", "detail": "On April 21st, 8h sleep and 3L hydration powered a 470 XP peak, your highest output of the week."}, {"icon": "trend", "title": "Friday Performance Volatility", "detail": "XP dropped by 54% between Tuesday and Friday, correlating with missing your Friday workout session."}, {"icon": "pattern", "title": "Unbroken Cold Exposure Habit", "detail": "5/5 cold shower success rate on log days shows your discipline in discomfort remains unbreakable."}]	[{"why": "Sub-3L days correlate with 40% lower XP efficiency.", "action": "Lock in 3.0L hydration regardless of workout status."}, {"why": "Friday was your lowest activity day; movement resets the slide.", "action": "Schedule a 20-min Friday mobility flow by 10 AM."}, {"why": "The 7.5h sleep average is good, but 8h yields 25% more XP.", "action": "Cap Sunday evening screen time at 9 PM."}]	{"best_day": {"xp": 470, "date": "2026-04-21"}, "total_xp": 1499, "workouts": 4, "avg_sleep": 7.6, "worst_day": {"xp": 215, "date": "2026-04-24"}, "cold_showers": 5, "perfect_days": 1, "avg_hydration": 2.9, "completion_pct": 71, "days_checked_in": 5}	2026-04-26 19:00:09.526068+00	\N
ceaa7caf-4c72-4f39-b99b-e5b4f4bbdfb9	01a63c98-3dcd-4666-9be1-182d11c3e066	2026-04-27	2026-05-03	Legend status at risk: Mid-week drop-off stalled momentum.	You are coasting on your Legend status, willehard. While your sleep (7.8h) and hydration (3L) are solid, your check-in rate of 43% is unacceptable for a Level 22 athlete. You started the week strong with 369 XP but disappeared mid-week, only resurfacing for a low-intensity Saturday.\n\nThe data shows a clear pattern: when you track, you perform. The workouts and cold showers are happening, but the 4-day silence suggests a lack of discipline in the routine's "administrative" side. Without tracking, your 29d streak is history, and your progression will stall.\n\nNext week is about visibility. Your physiological markers are ready for higher output, but the mental overhead of tracking must become non-negotiable. Don't let the weekend performance (194 XP) become your new baseline. Reclaim the 350+ XP range immediately.	[{"icon": "warning", "title": "Execution Decay", "detail": "Daily XP fell from 369 on Tuesday to 194 on Saturday. A 47% drop in execution despite consistent sleep and hydration levels."}, {"icon": "pattern", "title": "Consistency Gap", "detail": "You only tracked 43% of the week. Three missing days create a data blackout that threatens your Level 22 standing."}, {"icon": "win", "title": "Foundation Intact", "detail": "When you log, you hit the basics. Sleep (7.8h) and Hydration (3L) are locked in, providing the baseline needed to ramp up volume."}]	[{"why": "To fix the tracking gap that lost you 4 days this week.", "action": "Log data before 10 AM daily"}, {"why": "To reverse the XP drop-off seen after your peak on 04-28.", "action": "Add 1 extra set to your main lift on Day 2"}, {"why": "To bridge the gap between your active days and recovery.", "action": "Cold shower + 10 min mobility on Mon/Wed/Fri"}]	{"best_day": {"xp": 369, "date": "2026-04-28"}, "total_xp": 913, "workouts": 3, "avg_sleep": 7.8, "worst_day": {"xp": 194, "date": "2026-05-02"}, "cold_showers": 3, "perfect_days": 2, "avg_hydration": 3, "completion_pct": 43, "days_checked_in": 3}	2026-05-03 19:00:13.109964+00	\N
fdcd203e-c9d5-4104-96ca-e250a70752bf	01a63c98-3dcd-4666-9be1-182d11c3e066	2026-05-04	2026-05-10	Consistency is hemorrhaging; 4 missed days halted your 29-day momentum.	This week was a significant lapse in discipline. You’ve proven you have the "Legend" tier capacity by maintaining 8h sleep and 3L hydration on the days you recorded, but a 43% check-in rate is unacceptable for your level. You are currently coasting on past momentum while your current streak has reset to a 1-day minimum.\n\nThe data shows a "ghosting" pattern. On the days you logged (Tue, Thu, Sun), your performance was surgical and consistent. This suggests that your environment or schedule on the off-days is likely causing a total disconnect from your protocols. You aren't failing the tasks; you're failing the habit of accountability.\n\nNext week is about reclamation. You have the baseline stats—8h sleep and 3L water—which many struggle to hit. Use that physical readiness to fix the mental gap. Don't let 11,340 XP worth of work go to waste by allowing another gapped week. Log in every morning, regardless of whether you’ve hit a workout yet. Stop the bleeding.	[{"icon": "warning", "title": "Momentum Crash", "detail": "You only logged 3/7 days. Despite 11,340 total XP, your engagement dropped 57% this week, putting your Legend status at risk."}, {"icon": "pattern", "title": "Binary Discipline", "detail": "On days you show up, you hit 8h sleep and 3L water perfectly. Your execution isn't the problem—showing up to the starting line is."}, {"icon": "win", "title": "Strong Baseline Maintenance", "detail": "Even on your \\"worst\\" day (194 XP), you still hit the workout/cold shower/hydration stack. Your floor is high; you just need to raise the ceiling."}]	[{"why": "Reduce the friction of the 'did not record' zeros.", "action": "Log a 5-min habit (even if just hydration) by 09:00 AM."}, {"why": "Maintain high baseline energy during lower activity periods.", "action": "Increase water to 3.5L on non-workout days."}, {"why": "Restore the lost 29-day momentum and stabilize XP gains.", "action": "Re-establish a 3-day workout streak."}]	{"best_day": {"xp": 280, "date": "2026-05-07"}, "total_xp": 674, "workouts": 3, "avg_sleep": 8, "worst_day": {"xp": 194, "date": "2026-05-10"}, "cold_showers": 3, "perfect_days": 0, "avg_hydration": 3, "completion_pct": 43, "days_checked_in": 3}	2026-05-10 19:00:10.922+00	\N
\.


--
-- Name: badges badges_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_name_key UNIQUE (name);


--
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (id);


--
-- Name: battle_votes battle_votes_battle_id_voter_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battle_votes
    ADD CONSTRAINT battle_votes_battle_id_voter_id_key UNIQUE (battle_id, voter_id);


--
-- Name: battle_votes battle_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battle_votes
    ADD CONSTRAINT battle_votes_pkey PRIMARY KEY (id);


--
-- Name: battles battles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battles
    ADD CONSTRAINT battles_pkey PRIMARY KEY (id);


--
-- Name: coach_athlete_profile coach_athlete_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_athlete_profile
    ADD CONSTRAINT coach_athlete_profile_pkey PRIMARY KEY (user_id);


--
-- Name: coach_chat_memory coach_chat_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_chat_memory
    ADD CONSTRAINT coach_chat_memory_pkey PRIMARY KEY (id);


--
-- Name: coach_daily_briefs coach_daily_briefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_daily_briefs
    ADD CONSTRAINT coach_daily_briefs_pkey PRIMARY KEY (id);


--
-- Name: coach_daily_briefs coach_daily_briefs_user_id_brief_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_daily_briefs
    ADD CONSTRAINT coach_daily_briefs_user_id_brief_date_key UNIQUE (user_id, brief_date);


--
-- Name: coach_daily_plans coach_daily_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_daily_plans
    ADD CONSTRAINT coach_daily_plans_pkey PRIMARY KEY (id);


--
-- Name: coach_daily_plans coach_daily_plans_user_id_plan_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_daily_plans
    ADD CONSTRAINT coach_daily_plans_user_id_plan_date_key UNIQUE (user_id, plan_date);


--
-- Name: coach_goals coach_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_goals
    ADD CONSTRAINT coach_goals_pkey PRIMARY KEY (id);


--
-- Name: coach_mission_logs coach_mission_logs_daily_plan_id_mission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_mission_logs
    ADD CONSTRAINT coach_mission_logs_daily_plan_id_mission_id_key UNIQUE (daily_plan_id, mission_id);


--
-- Name: coach_mission_logs coach_mission_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_mission_logs
    ADD CONSTRAINT coach_mission_logs_pkey PRIMARY KEY (id);


--
-- Name: coach_nudges coach_nudges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_nudges
    ADD CONSTRAINT coach_nudges_pkey PRIMARY KEY (id);


--
-- Name: coach_performance_snapshots coach_performance_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_performance_snapshots
    ADD CONSTRAINT coach_performance_snapshots_pkey PRIMARY KEY (id);


--
-- Name: coach_performance_snapshots coach_performance_snapshots_user_id_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_performance_snapshots
    ADD CONSTRAINT coach_performance_snapshots_user_id_snapshot_date_key UNIQUE (user_id, snapshot_date);


--
-- Name: coach_preference_signals coach_preference_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_preference_signals
    ADD CONSTRAINT coach_preference_signals_pkey PRIMARY KEY (id);


--
-- Name: coach_program_logs coach_program_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_program_logs
    ADD CONSTRAINT coach_program_logs_pkey PRIMARY KEY (id);


--
-- Name: coach_program_logs coach_program_logs_program_id_week_day_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_program_logs
    ADD CONSTRAINT coach_program_logs_program_id_week_day_index_key UNIQUE (program_id, week, day_index);


--
-- Name: coach_programs coach_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_programs
    ADD CONSTRAINT coach_programs_pkey PRIMARY KEY (id);


--
-- Name: coach_reflections coach_reflections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_reflections
    ADD CONSTRAINT coach_reflections_pkey PRIMARY KEY (id);


--
-- Name: coach_reflections coach_reflections_user_id_reflection_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_reflections
    ADD CONSTRAINT coach_reflections_user_id_reflection_date_key UNIQUE (user_id, reflection_date);


--
-- Name: coach_weekly_reviews coach_weekly_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_weekly_reviews
    ADD CONSTRAINT coach_weekly_reviews_pkey PRIMARY KEY (id);


--
-- Name: coach_weekly_reviews coach_weekly_reviews_user_id_week_starts_on_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_weekly_reviews
    ADD CONSTRAINT coach_weekly_reviews_user_id_week_starts_on_key UNIQUE (user_id, week_starts_on);


--
-- Name: content_moderations content_moderations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_moderations
    ADD CONSTRAINT content_moderations_pkey PRIMARY KEY (id);


--
-- Name: daily_checkins daily_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_checkins
    ADD CONSTRAINT daily_checkins_pkey PRIMARY KEY (id);


--
-- Name: direct_messages direct_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_pkey PRIMARY KEY (id);


--
-- Name: feed_comments feed_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_comments
    ADD CONSTRAINT feed_comments_pkey PRIMARY KEY (id);


--
-- Name: feed_posts feed_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_pkey PRIMARY KEY (id);


--
-- Name: feed_reactions feed_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_reactions
    ADD CONSTRAINT feed_reactions_pkey PRIMARY KEY (id);


--
-- Name: feed_reactions feed_reactions_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_reactions
    ADD CONSTRAINT feed_reactions_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);


--
-- Name: friendships friendships_requester_id_addressee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_requester_id_addressee_id_key UNIQUE (requester_id, addressee_id);


--
-- Name: kudos kudos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kudos
    ADD CONSTRAINT kudos_pkey PRIMARY KEY (id);


--
-- Name: leaderboard_champions leaderboard_champions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_champions
    ADD CONSTRAINT leaderboard_champions_pkey PRIMARY KEY (id);


--
-- Name: leaderboard_champions leaderboard_champions_season_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_champions
    ADD CONSTRAINT leaderboard_champions_season_id_user_id_key UNIQUE (season_id, user_id);


--
-- Name: leaderboard_season_baselines leaderboard_season_baselines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_season_baselines
    ADD CONSTRAINT leaderboard_season_baselines_pkey PRIMARY KEY (id);


--
-- Name: leaderboard_season_baselines leaderboard_season_baselines_season_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_season_baselines
    ADD CONSTRAINT leaderboard_season_baselines_season_id_user_id_key UNIQUE (season_id, user_id);


--
-- Name: leaderboard_seasons leaderboard_seasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_seasons
    ADD CONSTRAINT leaderboard_seasons_pkey PRIMARY KEY (id);


--
-- Name: legend_invites legend_invites_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legend_invites
    ADD CONSTRAINT legend_invites_code_key UNIQUE (code);


--
-- Name: legend_invites legend_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legend_invites
    ADD CONSTRAINT legend_invites_pkey PRIMARY KEY (id);


--
-- Name: moderation_cache moderation_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_cache
    ADD CONSTRAINT moderation_cache_pkey PRIMARY KEY (image_hash);


--
-- Name: moderation_queue moderation_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_queue
    ADD CONSTRAINT moderation_queue_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_user_id_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_token_key UNIQUE (user_id, token);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_referred_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_id_key UNIQUE (referred_id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: tribe_battles tribe_battles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_battles
    ADD CONSTRAINT tribe_battles_pkey PRIMARY KEY (id);


--
-- Name: tribe_invites tribe_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_invites
    ADD CONSTRAINT tribe_invites_pkey PRIMARY KEY (id);


--
-- Name: tribe_members tribe_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_members
    ADD CONSTRAINT tribe_members_pkey PRIMARY KEY (id);


--
-- Name: tribe_members tribe_members_tribe_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_members
    ADD CONSTRAINT tribe_members_tribe_id_user_id_key UNIQUE (tribe_id, user_id);


--
-- Name: tribe_post_comments tribe_post_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_post_comments
    ADD CONSTRAINT tribe_post_comments_pkey PRIMARY KEY (id);


--
-- Name: tribe_post_kudos tribe_post_kudos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_post_kudos
    ADD CONSTRAINT tribe_post_kudos_pkey PRIMARY KEY (id);


--
-- Name: tribe_post_kudos tribe_post_kudos_post_id_giver_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_post_kudos
    ADD CONSTRAINT tribe_post_kudos_post_id_giver_id_key UNIQUE (post_id, giver_id);


--
-- Name: tribe_post_reactions tribe_post_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_post_reactions
    ADD CONSTRAINT tribe_post_reactions_pkey PRIMARY KEY (id);


--
-- Name: tribe_post_reactions tribe_post_reactions_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_post_reactions
    ADD CONSTRAINT tribe_post_reactions_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: tribe_post_reports tribe_post_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_post_reports
    ADD CONSTRAINT tribe_post_reports_pkey PRIMARY KEY (id);


--
-- Name: tribe_posts tribe_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_posts
    ADD CONSTRAINT tribe_posts_pkey PRIMARY KEY (id);


--
-- Name: tribes tribes_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribes
    ADD CONSTRAINT tribes_name_key UNIQUE (name);


--
-- Name: tribes tribes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribes
    ADD CONSTRAINT tribes_pkey PRIMARY KEY (id);


--
-- Name: tribes tribes_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribes
    ADD CONSTRAINT tribes_slug_key UNIQUE (slug);


--
-- Name: user_badges user_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_pkey PRIMARY KEY (id);


--
-- Name: user_badges user_badges_user_id_badge_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id);


--
-- Name: user_habit_logs user_habit_logs_habit_id_logged_on_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_habit_logs
    ADD CONSTRAINT user_habit_logs_habit_id_logged_on_key UNIQUE (habit_id, logged_on);


--
-- Name: user_habit_logs user_habit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_habit_logs
    ADD CONSTRAINT user_habit_logs_pkey PRIMARY KEY (id);


--
-- Name: user_habits user_habits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_habits
    ADD CONSTRAINT user_habits_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: vault_articles vault_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_articles
    ADD CONSTRAINT vault_articles_pkey PRIMARY KEY (id);


--
-- Name: vault_articles vault_articles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_articles
    ADD CONSTRAINT vault_articles_slug_key UNIQUE (slug);


--
-- Name: vault_lesson_progress vault_lesson_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_lesson_progress
    ADD CONSTRAINT vault_lesson_progress_pkey PRIMARY KEY (id);


--
-- Name: vault_lesson_progress vault_lesson_progress_user_id_article_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_lesson_progress
    ADD CONSTRAINT vault_lesson_progress_user_id_article_id_key UNIQUE (user_id, article_id);


--
-- Name: weekly_briefings weekly_briefings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_briefings
    ADD CONSTRAINT weekly_briefings_pkey PRIMARY KEY (id);


--
-- Name: weekly_briefings weekly_briefings_user_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_briefings
    ADD CONSTRAINT weekly_briefings_user_id_week_start_key UNIQUE (user_id, week_start);


--
-- Name: idx_battle_votes_battle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_battle_votes_battle ON public.battle_votes USING btree (battle_id);


--
-- Name: idx_chat_memory_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_memory_user ON public.coach_chat_memory USING btree (user_id, created_at DESC);


--
-- Name: idx_checkins_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkins_user_date ON public.daily_checkins USING btree (user_id, checked_in_at DESC);


--
-- Name: idx_coach_daily_briefs_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coach_daily_briefs_user_date ON public.coach_daily_briefs USING btree (user_id, brief_date DESC);


--
-- Name: idx_coach_daily_plans_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coach_daily_plans_user_date ON public.coach_daily_plans USING btree (user_id, plan_date DESC);


--
-- Name: idx_coach_goals_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coach_goals_user_status ON public.coach_goals USING btree (user_id, status);


--
-- Name: idx_coach_mission_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coach_mission_logs_user ON public.coach_mission_logs USING btree (user_id, completed_at DESC);


--
-- Name: idx_coach_nudges_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coach_nudges_user_created ON public.coach_nudges USING btree (user_id, created_at DESC);


--
-- Name: idx_coach_perf_snapshots_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coach_perf_snapshots_user_date ON public.coach_performance_snapshots USING btree (user_id, snapshot_date DESC);


--
-- Name: idx_coach_program_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coach_program_logs_user ON public.coach_program_logs USING btree (user_id, logged_at DESC);


--
-- Name: idx_coach_programs_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coach_programs_user_active ON public.coach_programs USING btree (user_id, status, created_at DESC);


--
-- Name: idx_coach_reflections_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coach_reflections_user_date ON public.coach_reflections USING btree (user_id, reflection_date DESC);


--
-- Name: idx_coach_weekly_reviews_user_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coach_weekly_reviews_user_week ON public.coach_weekly_reviews USING btree (user_id, week_starts_on DESC);


--
-- Name: idx_content_moderations_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_moderations_action ON public.content_moderations USING btree (action, created_at DESC);


--
-- Name: idx_content_moderations_content; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_moderations_content ON public.content_moderations USING btree (content_type, content_id);


--
-- Name: idx_dm_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_created ON public.direct_messages USING btree (created_at DESC);


--
-- Name: idx_dm_receiver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_receiver ON public.direct_messages USING btree (receiver_id);


--
-- Name: idx_dm_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_sender ON public.direct_messages USING btree (sender_id);


--
-- Name: idx_feed_comments_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_comments_parent_id ON public.feed_comments USING btree (parent_id);


--
-- Name: idx_feed_comments_post_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_comments_post_parent ON public.feed_comments USING btree (post_id, parent_id);


--
-- Name: idx_leaderboard_baselines_season_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leaderboard_baselines_season_user ON public.leaderboard_season_baselines USING btree (season_id, user_id);


--
-- Name: idx_leaderboard_champions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leaderboard_champions_user ON public.leaderboard_champions USING btree (user_id);


--
-- Name: idx_leaderboard_seasons_status_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leaderboard_seasons_status_dates ON public.leaderboard_seasons USING btree (status, starts_at, ends_at);


--
-- Name: idx_legend_invites_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_legend_invites_code ON public.legend_invites USING btree (lower(code));


--
-- Name: idx_legend_invites_used_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_legend_invites_used_by ON public.legend_invites USING btree (used_by);


--
-- Name: idx_moderation_cache_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_cache_created_at ON public.moderation_cache USING btree (created_at);


--
-- Name: idx_moderation_queue_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moderation_queue_status_created ON public.moderation_queue USING btree (status, created_at DESC);


--
-- Name: idx_pref_signals_user_protocol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pref_signals_user_protocol ON public.coach_preference_signals USING btree (user_id, protocol_id) WHERE (protocol_id IS NOT NULL);


--
-- Name: idx_pref_signals_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pref_signals_user_type ON public.coach_preference_signals USING btree (user_id, signal_type, created_at DESC);


--
-- Name: idx_tribe_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tribe_members_user ON public.tribe_members USING btree (user_id) WHERE (status = 'active'::text);


--
-- Name: idx_tribe_post_comments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tribe_post_comments_parent ON public.tribe_post_comments USING btree (parent_id);


--
-- Name: idx_tribe_post_comments_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tribe_post_comments_post ON public.tribe_post_comments USING btree (post_id);


--
-- Name: idx_tribe_post_kudos_giver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tribe_post_kudos_giver ON public.tribe_post_kudos USING btree (giver_id);


--
-- Name: idx_tribe_post_kudos_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tribe_post_kudos_post ON public.tribe_post_kudos USING btree (post_id);


--
-- Name: idx_tribe_post_reports_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tribe_post_reports_post ON public.tribe_post_reports USING btree (post_id);


--
-- Name: idx_tribe_posts_tribe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tribe_posts_tribe ON public.tribe_posts USING btree (tribe_id, created_at DESC);


--
-- Name: idx_vault_articles_category_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vault_articles_category_order ON public.vault_articles USING btree (category_id, display_order);


--
-- Name: idx_weekly_briefings_user_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_briefings_user_generated ON public.weekly_briefings USING btree (user_id, generated_at DESC);


--
-- Name: kudos_giver_post_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX kudos_giver_post_unique ON public.kudos USING btree (giver_id, post_id);


--
-- Name: profiles_is_premium_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_is_premium_idx ON public.profiles USING btree (is_premium) WHERE (is_premium = true);


--
-- Name: profiles_referral_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_referral_code_idx ON public.profiles USING btree (referral_code);


--
-- Name: referrals_referred_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX referrals_referred_id_unique ON public.referrals USING btree (referred_id);


--
-- Name: referrals_referrer_converted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX referrals_referrer_converted_idx ON public.referrals USING btree (referrer_id, converted);


--
-- Name: tribe_battles_challenger_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tribe_battles_challenger_idx ON public.tribe_battles USING btree (challenger_tribe_id, status);


--
-- Name: tribe_battles_opponent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tribe_battles_opponent_idx ON public.tribe_battles USING btree (opponent_tribe_id, status);


--
-- Name: tribe_invites_invitee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tribe_invites_invitee_idx ON public.tribe_invites USING btree (invitee_id, status);


--
-- Name: tribe_invites_pending_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tribe_invites_pending_unique ON public.tribe_invites USING btree (tribe_id, invitee_id) WHERE (status = 'pending'::text);


--
-- Name: tribe_invites_tribe_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tribe_invites_tribe_idx ON public.tribe_invites USING btree (tribe_id, status);


--
-- Name: tribes_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tribes_name_unique ON public.tribes USING btree (lower(name));


--
-- Name: user_habit_logs_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_habit_logs_user_date_idx ON public.user_habit_logs USING btree (user_id, logged_on DESC);


--
-- Name: user_habits_active_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_habits_active_unique ON public.user_habits USING btree (user_id, protocol_id) WHERE (archived_at IS NULL);


--
-- Name: user_habits_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_habits_user_idx ON public.user_habits USING btree (user_id);


--
-- Name: vault_articles_category_lesson_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vault_articles_category_lesson_idx ON public.vault_articles USING btree (category_id, lesson_number);


--
-- Name: vault_lesson_progress_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vault_lesson_progress_user_idx ON public.vault_lesson_progress USING btree (user_id);


--
-- Name: battles check_expired_battles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER check_expired_battles AFTER INSERT OR UPDATE ON public.battles FOR EACH STATEMENT EXECUTE FUNCTION public.auto_resolve_expired_battles();


--
-- Name: coach_athlete_profile coach_athlete_profile_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER coach_athlete_profile_set_updated_at BEFORE UPDATE ON public.coach_athlete_profile FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: coach_chat_memory coach_chat_memory_cap; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER coach_chat_memory_cap AFTER INSERT ON public.coach_chat_memory FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_memory_cap();


--
-- Name: coach_goals coach_goals_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER coach_goals_set_updated_at BEFORE UPDATE ON public.coach_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: battle_votes on_battle_vote_check_threshold; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_battle_vote_check_threshold AFTER INSERT ON public.battle_votes FOR EACH ROW EXECUTE FUNCTION public.check_voting_threshold();


--
-- Name: feed_reactions on_feed_reaction_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_feed_reaction_change AFTER INSERT OR DELETE ON public.feed_reactions FOR EACH ROW EXECUTE FUNCTION public.handle_feed_reaction_xp();


--
-- Name: profiles profiles_reconcile_tribe_pause; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_reconcile_tribe_pause AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_owned_tribes_pause();


--
-- Name: profiles trg_auto_grant_founding_apex_to_legends; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auto_grant_founding_apex_to_legends BEFORE UPDATE OF status_tier ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.auto_grant_founding_apex_to_legends();


--
-- Name: feed_comments trg_check_commentator_badge; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_check_commentator_badge AFTER INSERT ON public.feed_comments FOR EACH ROW EXECUTE FUNCTION public.check_commentator_badge();


--
-- Name: feed_reactions trg_check_influencer_badge; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_check_influencer_badge AFTER INSERT ON public.feed_reactions FOR EACH ROW EXECUTE FUNCTION public.check_influencer_badge();


--
-- Name: feed_reactions trg_check_viral_badge; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_check_viral_badge AFTER INSERT ON public.feed_reactions FOR EACH ROW EXECUTE FUNCTION public.check_viral_badge();


--
-- Name: coach_programs trg_coach_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_coach_programs_updated_at BEFORE UPDATE ON public.coach_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: kudos trg_handle_kudos_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_handle_kudos_delete AFTER DELETE ON public.kudos FOR EACH ROW EXECUTE FUNCTION public.handle_kudos_delete();


--
-- Name: kudos trg_handle_kudos_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_handle_kudos_insert AFTER INSERT ON public.kudos FOR EACH ROW EXECUTE FUNCTION public.handle_kudos_insert();


--
-- Name: profiles trg_new_profile_leaderboard_baseline; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_new_profile_leaderboard_baseline AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_leaderboard_baseline();


--
-- Name: tribe_post_comments trg_tribe_comment_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tribe_comment_count AFTER INSERT OR DELETE ON public.tribe_post_comments FOR EACH ROW EXECUTE FUNCTION public.handle_tribe_comment_count();


--
-- Name: tribe_post_kudos trg_tribe_kudos_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tribe_kudos_delete AFTER DELETE ON public.tribe_post_kudos FOR EACH ROW EXECUTE FUNCTION public.handle_tribe_kudos_delete();


--
-- Name: tribe_post_kudos trg_tribe_kudos_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tribe_kudos_insert AFTER INSERT ON public.tribe_post_kudos FOR EACH ROW EXECUTE FUNCTION public.handle_tribe_kudos_insert();


--
-- Name: tribe_post_reactions trg_tribe_post_reaction_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tribe_post_reaction_del AFTER DELETE ON public.tribe_post_reactions FOR EACH ROW EXECUTE FUNCTION public.handle_tribe_post_reaction();


--
-- Name: tribe_post_reactions trg_tribe_post_reaction_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tribe_post_reaction_ins AFTER INSERT ON public.tribe_post_reactions FOR EACH ROW EXECUTE FUNCTION public.handle_tribe_post_reaction();


--
-- Name: tribes trg_tribes_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tribes_updated BEFORE UPDATE ON public.tribes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: coach_daily_plans update_coach_daily_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_coach_daily_plans_updated_at BEFORE UPDATE ON public.coach_daily_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: feed_posts update_feed_posts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_feed_posts_updated_at BEFORE UPDATE ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: battles update_status_after_battle; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_status_after_battle AFTER UPDATE ON public.battles FOR EACH ROW EXECUTE FUNCTION public.trg_update_status_after_battle();


--
-- Name: daily_checkins update_status_after_checkin; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_status_after_checkin AFTER INSERT ON public.daily_checkins FOR EACH ROW EXECUTE FUNCTION public.trg_update_status_after_checkin();


--
-- Name: user_habits user_habits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_habits_updated_at BEFORE UPDATE ON public.user_habits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: battle_votes battle_votes_battle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battle_votes
    ADD CONSTRAINT battle_votes_battle_id_fkey FOREIGN KEY (battle_id) REFERENCES public.battles(id) ON DELETE CASCADE;


--
-- Name: battles battles_challenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battles
    ADD CONSTRAINT battles_challenger_id_fkey FOREIGN KEY (challenger_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: battles battles_opponent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battles
    ADD CONSTRAINT battles_opponent_id_fkey FOREIGN KEY (opponent_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: battles battles_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battles
    ADD CONSTRAINT battles_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES auth.users(id);


--
-- Name: coach_mission_logs coach_mission_logs_daily_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_mission_logs
    ADD CONSTRAINT coach_mission_logs_daily_plan_id_fkey FOREIGN KEY (daily_plan_id) REFERENCES public.coach_daily_plans(id) ON DELETE CASCADE;


--
-- Name: coach_program_logs coach_program_logs_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_program_logs
    ADD CONSTRAINT coach_program_logs_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.coach_programs(id) ON DELETE CASCADE;


--
-- Name: daily_checkins daily_checkins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_checkins
    ADD CONSTRAINT daily_checkins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: feed_comments feed_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_comments
    ADD CONSTRAINT feed_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.feed_comments(id) ON DELETE CASCADE;


--
-- Name: feed_comments feed_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_comments
    ADD CONSTRAINT feed_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.feed_posts(id) ON DELETE CASCADE;


--
-- Name: feed_comments feed_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_comments
    ADD CONSTRAINT feed_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: feed_posts feed_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: feed_reactions feed_reactions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_reactions
    ADD CONSTRAINT feed_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.feed_posts(id) ON DELETE CASCADE;


--
-- Name: feed_reactions feed_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_reactions
    ADD CONSTRAINT feed_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: kudos kudos_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kudos
    ADD CONSTRAINT kudos_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.feed_posts(id) ON DELETE CASCADE;


--
-- Name: leaderboard_champions leaderboard_champions_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_champions
    ADD CONSTRAINT leaderboard_champions_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.leaderboard_seasons(id) ON DELETE CASCADE;


--
-- Name: leaderboard_season_baselines leaderboard_season_baselines_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_season_baselines
    ADD CONSTRAINT leaderboard_season_baselines_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.leaderboard_seasons(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_featured_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_featured_badge_id_fkey FOREIGN KEY (featured_badge_id) REFERENCES public.badges(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reports reports_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.feed_posts(id) ON DELETE CASCADE;


--
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tribe_battles tribe_battles_challenger_tribe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_battles
    ADD CONSTRAINT tribe_battles_challenger_tribe_id_fkey FOREIGN KEY (challenger_tribe_id) REFERENCES public.tribes(id) ON DELETE CASCADE;


--
-- Name: tribe_battles tribe_battles_opponent_tribe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_battles
    ADD CONSTRAINT tribe_battles_opponent_tribe_id_fkey FOREIGN KEY (opponent_tribe_id) REFERENCES public.tribes(id) ON DELETE CASCADE;


--
-- Name: tribe_invites tribe_invites_tribe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_invites
    ADD CONSTRAINT tribe_invites_tribe_id_fkey FOREIGN KEY (tribe_id) REFERENCES public.tribes(id) ON DELETE CASCADE;


--
-- Name: tribe_members tribe_members_tribe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_members
    ADD CONSTRAINT tribe_members_tribe_id_fkey FOREIGN KEY (tribe_id) REFERENCES public.tribes(id) ON DELETE CASCADE;


--
-- Name: tribe_post_comments tribe_post_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_post_comments
    ADD CONSTRAINT tribe_post_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.tribe_post_comments(id) ON DELETE CASCADE;


--
-- Name: tribe_post_comments tribe_post_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_post_comments
    ADD CONSTRAINT tribe_post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.tribe_posts(id) ON DELETE CASCADE;


--
-- Name: tribe_post_kudos tribe_post_kudos_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_post_kudos
    ADD CONSTRAINT tribe_post_kudos_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.tribe_posts(id) ON DELETE CASCADE;


--
-- Name: tribe_post_reactions tribe_post_reactions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_post_reactions
    ADD CONSTRAINT tribe_post_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.tribe_posts(id) ON DELETE CASCADE;


--
-- Name: tribe_post_reports tribe_post_reports_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_post_reports
    ADD CONSTRAINT tribe_post_reports_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.tribe_posts(id) ON DELETE CASCADE;


--
-- Name: tribe_posts tribe_posts_tribe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tribe_posts
    ADD CONSTRAINT tribe_posts_tribe_id_fkey FOREIGN KEY (tribe_id) REFERENCES public.tribes(id) ON DELETE CASCADE;


--
-- Name: user_badges user_badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(id) ON DELETE CASCADE;


--
-- Name: user_badges user_badges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_habit_logs user_habit_logs_habit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_habit_logs
    ADD CONSTRAINT user_habit_logs_habit_id_fkey FOREIGN KEY (habit_id) REFERENCES public.user_habits(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vault_lesson_progress vault_lesson_progress_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_lesson_progress
    ADD CONSTRAINT vault_lesson_progress_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.vault_articles(id) ON DELETE CASCADE;


--
-- Name: tribe_post_reports Admins and tribe owners can view tribe reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and tribe owners can view tribe reports" ON public.tribe_post_reports FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.tribe_posts p
  WHERE ((p.id = tribe_post_reports.post_id) AND public.is_tribe_owner(p.tribe_id, auth.uid()))))));


--
-- Name: battles Admins can delete any battle; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete any battle" ON public.battles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: feed_comments Admins can delete any comment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete any comment" ON public.feed_comments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: feed_posts Admins can delete any post; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete any post" ON public.feed_posts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tribe_posts Admins can delete any tribe post; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete any tribe post" ON public.tribe_posts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: battles Admins can update any battle; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update any battle" ON public.battles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: feed_posts Admins can update any post; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update any post" ON public.feed_posts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tribe_posts Admins can update any tribe post; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update any tribe post" ON public.tribe_posts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: moderation_queue Admins can update moderation queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update moderation queue" ON public.moderation_queue FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: content_moderations Admins can update moderations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update moderations" ON public.content_moderations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: reports Admins can update reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update reports" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: legend_invites Admins can view legend invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view legend invites" ON public.legend_invites FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: moderation_queue Admins can view moderation queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view moderation queue" ON public.moderation_queue FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: content_moderations Admins can view moderations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view moderations" ON public.content_moderations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: reports Admins can view reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view reports" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tribe_post_reports Admins update tribe reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update tribe reports" ON public.tribe_post_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tribe_post_kudos Apex tribe members can give kudos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Apex tribe members can give kudos" ON public.tribe_post_kudos FOR INSERT TO authenticated WITH CHECK (((auth.uid() = giver_id) AND (giver_id <> receiver_id) AND (EXISTS ( SELECT 1
   FROM public.tribe_posts p
  WHERE ((p.id = tribe_post_kudos.post_id) AND public.is_tribe_member(p.tribe_id, auth.uid()) AND (p.user_id = tribe_post_kudos.receiver_id)))) AND (EXISTS ( SELECT 1
   FROM public.profiles pr
  WHERE ((pr.user_id = auth.uid()) AND ((pr.is_apex_subscriber = true) OR (pr.status_tier = ANY (ARRAY['apex'::public.status_tier, 'legend'::public.status_tier]))))))));


--
-- Name: leaderboard_season_baselines Authenticated can view all baselines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can view all baselines" ON public.leaderboard_season_baselines FOR SELECT TO authenticated USING (true);


--
-- Name: battle_votes Authenticated can view votes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can view votes" ON public.battle_votes FOR SELECT TO authenticated USING (true);


--
-- Name: battle_votes Authenticated users can vote; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can vote" ON public.battle_votes FOR INSERT WITH CHECK (((auth.uid() = voter_id) AND (auth.uid() <> ( SELECT battles.challenger_id
   FROM public.battles
  WHERE (battles.id = battle_votes.battle_id))) AND (auth.uid() <> ( SELECT battles.opponent_id
   FROM public.battles
  WHERE (battles.id = battle_votes.battle_id)))));


--
-- Name: badges Badges viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Badges viewable by everyone" ON public.badges FOR SELECT USING (true);


--
-- Name: user_badges Badges viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Badges viewable by everyone" ON public.user_badges FOR SELECT USING (true);


--
-- Name: feed_comments Comments viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Comments viewable by everyone" ON public.feed_comments FOR SELECT USING (true);


--
-- Name: feed_posts Elite users can post; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Elite users can post" ON public.feed_posts FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.status_tier = ANY (ARRAY['elite'::public.status_tier, 'apex'::public.status_tier, 'legend'::public.status_tier]))))) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))));


--
-- Name: feed_posts Feed viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Feed viewable by everyone" ON public.feed_posts FOR SELECT USING (true);


--
-- Name: tribe_invites Invites visible to participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Invites visible to participants" ON public.tribe_invites FOR SELECT TO authenticated USING (((auth.uid() = inviter_id) OR (auth.uid() = invitee_id) OR public.is_tribe_owner(tribe_id, auth.uid())));


--
-- Name: kudos Kudos viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Kudos viewable by everyone" ON public.kudos FOR SELECT USING (true);


--
-- Name: leaderboard_champions Leaderboard champions viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leaderboard champions viewable by everyone" ON public.leaderboard_champions FOR SELECT USING (true);


--
-- Name: leaderboard_seasons Leaderboard seasons viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leaderboard seasons viewable by everyone" ON public.leaderboard_seasons FOR SELECT USING (true);


--
-- Name: tribe_posts Members can post in their tribe; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can post in their tribe" ON public.tribe_posts FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND public.is_tribe_member(tribe_id, auth.uid())));


--
-- Name: tribe_post_reactions Members can react; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can react" ON public.tribe_post_reactions FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.tribe_posts p
  WHERE ((p.id = tribe_post_reactions.post_id) AND public.is_tribe_member(p.tribe_id, auth.uid()))))));


--
-- Name: tribe_members Members rows visible to authed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members rows visible to authed" ON public.tribe_members FOR SELECT TO authenticated USING ((public.is_tribe_member(tribe_id, auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.tribes t
  WHERE ((t.id = tribe_members.tribe_id) AND (t.visibility = 'public'::text)))) OR (user_id = auth.uid())));


--
-- Name: user_badges No direct badge insertion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct badge insertion" ON public.user_badges FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: coach_daily_plans No direct daily plan insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct daily plan insert" ON public.coach_daily_plans FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: coach_daily_plans No direct daily plan update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct daily plan update" ON public.coach_daily_plans FOR UPDATE TO authenticated USING (false);


--
-- Name: legend_invites No direct delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct delete" ON public.legend_invites FOR DELETE TO authenticated USING (false);


--
-- Name: user_habit_logs No direct habit log insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct habit log insert" ON public.user_habit_logs FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: user_habit_logs No direct habit log update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct habit log update" ON public.user_habit_logs FOR UPDATE TO authenticated USING (false);


--
-- Name: legend_invites No direct insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct insert" ON public.legend_invites FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: tribe_invites No direct invite delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct invite delete" ON public.tribe_invites FOR DELETE TO authenticated USING (false);


--
-- Name: tribe_invites No direct invite insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct invite insert" ON public.tribe_invites FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: tribe_invites No direct invite update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct invite update" ON public.tribe_invites FOR UPDATE TO authenticated USING (false);


--
-- Name: tribe_members No direct member delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct member delete" ON public.tribe_members FOR DELETE TO authenticated USING (false);


--
-- Name: tribe_members No direct member insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct member insert" ON public.tribe_members FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: tribe_members No direct member update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct member update" ON public.tribe_members FOR UPDATE TO authenticated USING (false);


--
-- Name: coach_mission_logs No direct mission log insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct mission log insert" ON public.coach_mission_logs FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: coach_reflections No direct reflection insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct reflection insert" ON public.coach_reflections FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: coach_reflections No direct reflection update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct reflection update" ON public.coach_reflections FOR UPDATE TO authenticated USING (false);


--
-- Name: user_roles No direct role deletion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct role deletion" ON public.user_roles FOR DELETE TO authenticated USING (false);


--
-- Name: user_roles No direct role insertion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct role insertion" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: user_roles No direct role updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct role updates" ON public.user_roles FOR UPDATE TO authenticated USING (false);


--
-- Name: coach_performance_snapshots No direct snapshot insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct snapshot insert" ON public.coach_performance_snapshots FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: coach_performance_snapshots No direct snapshot update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct snapshot update" ON public.coach_performance_snapshots FOR UPDATE TO authenticated USING (false);


--
-- Name: tribe_battles No direct tribe battle delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct tribe battle delete" ON public.tribe_battles FOR DELETE TO authenticated USING (false);


--
-- Name: tribe_battles No direct tribe battle insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct tribe battle insert" ON public.tribe_battles FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: tribe_battles No direct tribe battle update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct tribe battle update" ON public.tribe_battles FOR UPDATE TO authenticated USING (false);


--
-- Name: tribes No direct tribe delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct tribe delete" ON public.tribes FOR DELETE TO authenticated USING (false);


--
-- Name: tribes No direct tribe insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct tribe insert" ON public.tribes FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: tribes No direct tribe update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct tribe update" ON public.tribes FOR UPDATE TO authenticated USING (false);


--
-- Name: legend_invites No direct update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct update" ON public.legend_invites FOR UPDATE TO authenticated USING (false);


--
-- Name: vault_articles No direct vault delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct vault delete" ON public.vault_articles FOR DELETE TO authenticated USING (false);


--
-- Name: vault_articles No direct vault insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct vault insert" ON public.vault_articles FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: vault_articles No direct vault update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct vault update" ON public.vault_articles FOR UPDATE TO authenticated USING (false);


--
-- Name: coach_weekly_reviews No direct weekly review insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct weekly review insert" ON public.coach_weekly_reviews FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: friendships Only addressee can accept or decline friendships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only addressee can accept or decline friendships" ON public.friendships FOR UPDATE TO authenticated USING (((auth.uid() = requester_id) OR (auth.uid() = addressee_id))) WITH CHECK (
CASE
    WHEN (auth.uid() = addressee_id) THEN true
    WHEN (auth.uid() = requester_id) THEN (status = 'pending'::public.friendship_status)
    ELSE false
END);


--
-- Name: vault_articles Premium members can read vault articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Premium members can read vault articles" ON public.vault_articles FOR SELECT TO authenticated USING (public.has_premium(auth.uid()));


--
-- Name: user_habits Premium users can add own habits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Premium users can add own habits" ON public.user_habits FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND public.has_premium(auth.uid())));


--
-- Name: coach_programs Premium users can create own programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Premium users can create own programs" ON public.coach_programs FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND public.has_premium(auth.uid())));


--
-- Name: coach_program_logs Premium users can insert own logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Premium users can insert own logs" ON public.coach_program_logs FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND public.has_premium(auth.uid())));


--
-- Name: vault_lesson_progress Premium users mark own lessons complete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Premium users mark own lessons complete" ON public.vault_lesson_progress FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND public.has_premium(auth.uid())));


--
-- Name: vault_lesson_progress Premium users update own lesson progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Premium users update own lesson progress" ON public.vault_lesson_progress FOR UPDATE TO authenticated USING (((auth.uid() = user_id) AND public.has_premium(auth.uid()))) WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Profiles viewable by authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: tribes Public tribes viewable by all authed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public tribes viewable by all authed" ON public.tribes FOR SELECT TO authenticated USING (((visibility = 'public'::text) OR public.is_tribe_member(id, auth.uid()) OR (owner_id = auth.uid())));


--
-- Name: feed_reactions Reactions viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reactions viewable by everyone" ON public.feed_reactions FOR SELECT USING (true);


--
-- Name: tribe_post_reactions Reactions viewable by tribe-visible viewers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reactions viewable by tribe-visible viewers" ON public.tribe_post_reactions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.tribe_posts p
     JOIN public.tribes t ON ((t.id = p.tribe_id)))
  WHERE ((p.id = tribe_post_reactions.post_id) AND ((t.visibility = 'public'::text) OR public.is_tribe_member(t.id, auth.uid()))))));


--
-- Name: push_tokens Service can read all tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can read all tokens" ON public.push_tokens FOR SELECT TO service_role USING (true);


--
-- Name: referrals System can insert referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert referrals" ON public.referrals FOR INSERT TO authenticated WITH CHECK ((auth.uid() = referred_id));


--
-- Name: tribe_battles Tribe battles visible to participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tribe battles visible to participants" ON public.tribe_battles FOR SELECT TO authenticated USING ((public.is_tribe_member(challenger_tribe_id, auth.uid()) OR public.is_tribe_member(opponent_tribe_id, auth.uid()) OR public.is_tribe_owner(challenger_tribe_id, auth.uid()) OR public.is_tribe_owner(opponent_tribe_id, auth.uid())));


--
-- Name: tribe_post_comments Tribe comments viewable by tribe-visible viewers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tribe comments viewable by tribe-visible viewers" ON public.tribe_post_comments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.tribe_posts p
     JOIN public.tribes t ON ((t.id = p.tribe_id)))
  WHERE ((p.id = tribe_post_comments.post_id) AND ((t.visibility = 'public'::text) OR public.is_tribe_member(t.id, auth.uid()))))));


--
-- Name: tribe_post_kudos Tribe kudos viewable by tribe-visible viewers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tribe kudos viewable by tribe-visible viewers" ON public.tribe_post_kudos FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.tribe_posts p
     JOIN public.tribes t ON ((t.id = p.tribe_id)))
  WHERE ((p.id = tribe_post_kudos.post_id) AND ((t.visibility = 'public'::text) OR public.is_tribe_member(t.id, auth.uid()))))));


--
-- Name: tribe_post_comments Tribe members can comment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tribe members can comment" ON public.tribe_post_comments FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.tribe_posts p
  WHERE ((p.id = tribe_post_comments.post_id) AND public.is_tribe_member(p.tribe_id, auth.uid()))))));


--
-- Name: tribe_post_reports Tribe members can report; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tribe members can report" ON public.tribe_post_reports FOR INSERT TO authenticated WITH CHECK (((auth.uid() = reporter_id) AND (EXISTS ( SELECT 1
   FROM public.tribe_posts p
  WHERE ((p.id = tribe_post_reports.post_id) AND public.is_tribe_member(p.tribe_id, auth.uid()))))));


--
-- Name: tribe_posts Tribe posts viewable by members or public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tribe posts viewable by members or public" ON public.tribe_posts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tribes t
  WHERE ((t.id = tribe_posts.tribe_id) AND ((t.visibility = 'public'::text) OR public.is_tribe_member(t.id, auth.uid()))))));


--
-- Name: feed_comments Users can comment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can comment" ON public.feed_comments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: battles Users can create battles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create battles" ON public.battles FOR INSERT WITH CHECK ((auth.uid() = challenger_id));


--
-- Name: reports Users can create reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK ((auth.uid() = reporter_id));


--
-- Name: feed_comments Users can delete own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own comments" ON public.feed_comments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: coach_daily_plans Users can delete own daily plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own daily plans" ON public.coach_daily_plans FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: friendships Users can delete own friendships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own friendships" ON public.friendships FOR DELETE TO authenticated USING (((auth.uid() = requester_id) OR (auth.uid() = addressee_id)));


--
-- Name: user_habits Users can delete own habits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own habits" ON public.user_habits FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_program_logs Users can delete own logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own logs" ON public.coach_program_logs FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: feed_posts Users can delete own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own posts" ON public.feed_posts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: coach_programs Users can delete own programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own programs" ON public.coach_programs FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: tribe_posts Users can delete own tribe post; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own tribe post" ON public.tribe_posts FOR DELETE TO authenticated USING (((auth.uid() = user_id) OR public.is_tribe_owner(tribe_id, auth.uid())));


--
-- Name: kudos Users can give kudos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can give kudos" ON public.kudos FOR INSERT WITH CHECK ((auth.uid() = giver_id));


--
-- Name: daily_checkins Users can insert own checkins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own checkins" ON public.daily_checkins FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: push_tokens Users can manage own tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own tokens" ON public.push_tokens TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: weekly_briefings Users can mark own briefings viewed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can mark own briefings viewed" ON public.weekly_briefings FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: coach_nudges Users can mark own nudges seen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can mark own nudges seen" ON public.coach_nudges FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: direct_messages Users can mark own received messages read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can mark own received messages read" ON public.direct_messages FOR UPDATE USING ((auth.uid() = receiver_id));


--
-- Name: feed_reactions Users can react; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can react" ON public.feed_reactions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: kudos Users can remove own kudos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove own kudos" ON public.kudos FOR DELETE USING ((auth.uid() = giver_id));


--
-- Name: tribe_post_reactions Users can remove own reaction; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove own reaction" ON public.tribe_post_reactions FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: feed_reactions Users can remove own reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove own reactions" ON public.feed_reactions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: tribe_post_kudos Users can remove own tribe kudos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove own tribe kudos" ON public.tribe_post_kudos FOR DELETE TO authenticated USING ((auth.uid() = giver_id));


--
-- Name: friendships Users can send friend requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can send friend requests" ON public.friendships FOR INSERT TO authenticated WITH CHECK (((auth.uid() = requester_id) AND (requester_id <> addressee_id)));


--
-- Name: direct_messages Users can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can send messages" ON public.direct_messages FOR INSERT WITH CHECK ((auth.uid() = sender_id));


--
-- Name: feed_comments Users can update own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own comments" ON public.feed_comments FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_habits Users can update own habits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own habits" ON public.user_habits FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: feed_posts Users can update own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own posts" ON public.feed_posts FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile via RPC only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile via RPC only" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: coach_programs Users can update own programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own programs" ON public.coach_programs FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: tribe_post_comments Users can update own tribe comment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own tribe comment" ON public.tribe_post_comments FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: tribe_posts Users can update own tribe post; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own tribe post" ON public.tribe_posts FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: battles Users can view own battles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own battles" ON public.battles FOR SELECT USING (((auth.uid() = challenger_id) OR (auth.uid() = opponent_id)));


--
-- Name: weekly_briefings Users can view own briefings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own briefings" ON public.weekly_briefings FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: daily_checkins Users can view own checkins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own checkins" ON public.daily_checkins FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: coach_daily_plans Users can view own daily plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own daily plans" ON public.coach_daily_plans FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: friendships Users can view own friendships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own friendships" ON public.friendships FOR SELECT TO authenticated USING (((auth.uid() = requester_id) OR (auth.uid() = addressee_id)));


--
-- Name: user_habit_logs Users can view own habit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own habit logs" ON public.user_habit_logs FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_habits Users can view own habits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own habits" ON public.user_habits FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_program_logs Users can view own logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own logs" ON public.coach_program_logs FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: direct_messages Users can view own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own messages" ON public.direct_messages FOR SELECT USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));


--
-- Name: coach_mission_logs Users can view own mission logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own mission logs" ON public.coach_mission_logs FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_nudges Users can view own nudges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own nudges" ON public.coach_nudges FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_programs Users can view own programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own programs" ON public.coach_programs FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: legend_invites Users can view own redeemed invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own redeemed invites" ON public.legend_invites FOR SELECT TO authenticated USING ((auth.uid() = used_by));


--
-- Name: referrals Users can view own referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT TO authenticated USING (((auth.uid() = referrer_id) OR (auth.uid() = referred_id)));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_athlete_profile Users delete own athlete profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own athlete profile" ON public.coach_athlete_profile FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_chat_memory Users delete own chat memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own chat memory" ON public.coach_chat_memory FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_goals Users delete own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own goals" ON public.coach_goals FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: vault_lesson_progress Users delete own lesson progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own lesson progress" ON public.vault_lesson_progress FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_reflections Users delete own reflections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own reflections" ON public.coach_reflections FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_weekly_reviews Users delete own weekly reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own weekly reviews" ON public.coach_weekly_reviews FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_athlete_profile Users insert own athlete profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own athlete profile" ON public.coach_athlete_profile FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: coach_chat_memory Users insert own chat memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own chat memory" ON public.coach_chat_memory FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: coach_goals Users insert own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own goals" ON public.coach_goals FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: coach_preference_signals Users insert own preference signals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own preference signals" ON public.coach_preference_signals FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: coach_weekly_reviews Users mark own weekly reviews seen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users mark own weekly reviews seen" ON public.coach_weekly_reviews FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: tribe_post_comments Users or owners can delete tribe comment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users or owners can delete tribe comment" ON public.tribe_post_comments FOR DELETE TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.tribe_posts p
  WHERE ((p.id = tribe_post_comments.post_id) AND public.is_tribe_owner(p.tribe_id, auth.uid()))))));


--
-- Name: coach_daily_briefs Users read own daily briefs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own daily briefs" ON public.coach_daily_briefs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: vault_lesson_progress Users read own lesson progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own lesson progress" ON public.vault_lesson_progress FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_athlete_profile Users update own athlete profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own athlete profile" ON public.coach_athlete_profile FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: coach_goals Users update own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own goals" ON public.coach_goals FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: coach_athlete_profile Users view own athlete profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own athlete profile" ON public.coach_athlete_profile FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_chat_memory Users view own chat memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own chat memory" ON public.coach_chat_memory FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_goals Users view own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own goals" ON public.coach_goals FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_preference_signals Users view own preference signals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own preference signals" ON public.coach_preference_signals FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_reflections Users view own reflections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own reflections" ON public.coach_reflections FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_performance_snapshots Users view own snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own snapshots" ON public.coach_performance_snapshots FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coach_weekly_reviews Users view own weekly reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own weekly reviews" ON public.coach_weekly_reviews FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

--
-- Name: battle_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.battle_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: battles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_athlete_profile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_athlete_profile ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_chat_memory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_chat_memory ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_daily_briefs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_daily_briefs ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_daily_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_daily_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_mission_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_mission_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_nudges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_nudges ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_performance_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_performance_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_preference_signals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_preference_signals ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_program_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_program_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_programs ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_reflections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_reflections ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_weekly_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_weekly_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: content_moderations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_moderations ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_checkins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

--
-- Name: direct_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: feed_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: feed_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: feed_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: friendships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

--
-- Name: kudos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;

--
-- Name: leaderboard_champions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leaderboard_champions ENABLE ROW LEVEL SECURITY;

--
-- Name: leaderboard_season_baselines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leaderboard_season_baselines ENABLE ROW LEVEL SECURITY;

--
-- Name: leaderboard_seasons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leaderboard_seasons ENABLE ROW LEVEL SECURITY;

--
-- Name: legend_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.legend_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: moderation_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.moderation_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: moderation_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: push_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: tribe_battles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tribe_battles ENABLE ROW LEVEL SECURITY;

--
-- Name: tribe_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tribe_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: tribe_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tribe_members ENABLE ROW LEVEL SECURITY;

--
-- Name: tribe_post_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tribe_post_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: tribe_post_kudos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tribe_post_kudos ENABLE ROW LEVEL SECURITY;

--
-- Name: tribe_post_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tribe_post_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: tribe_post_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tribe_post_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: tribe_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tribe_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: tribes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tribes ENABLE ROW LEVEL SECURITY;

--
-- Name: user_badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

--
-- Name: user_habit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_habit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: user_habits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_habits ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: vault_articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vault_articles ENABLE ROW LEVEL SECURITY;

--
-- Name: vault_lesson_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vault_lesson_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_briefings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_briefings ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict ZJHhKh3mhiutiYABzjD9f7fOr2LgORlEC50OT3MbrittSiQHsHL4t9F8nSXYdnt

