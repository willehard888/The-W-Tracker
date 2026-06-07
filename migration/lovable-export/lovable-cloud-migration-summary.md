# Lovable Cloud migration export

Generated: 2026-05-20T06:22:16.991416+00:00

## What I could execute

- ✅ Direct DB session is available as a restricted export role.
- ✅ Full `public` schema + data dump succeeded via `pg_dump`.
- ✅ `auth.users` rows with `encrypted_password` hashes were readable via the internal read-only database tool (21 rows).
- ✅ `auth.identities` rows were readable via the same tool (22 rows).
- ❌ Full `auth` schema `pg_dump` is blocked for the direct DB role:

```text
pg_dump: error: query failed: ERROR:  permission denied for schema auth
pg_dump: detail: Query was: LOCK TABLE auth.users, auth.refresh_tokens, auth.instances, auth.audit_log_entries, auth.schema_migrations, auth.identities, auth.sessions, auth.mfa_factors, auth.mfa_challenges, auth.mfa_amr_claims, auth.sso_providers, auth.sso_domains, auth.saml_providers, auth.saml_relay_states, auth.flow_state, auth.one_time_tokens, auth.oauth_clients, auth.oauth_authorizations, auth.oauth_consents, auth.oauth_client_states, auth.custom_oauth_providers, auth.webauthn_credentials, auth.webauthn_challenges IN ACCESS SHARE MODE
```

## Public table row counts

```text
table_name\trows
public.badges\t122
public.battle_votes\t0
public.battles\t1
public.coach_athlete_profile\t2
public.coach_chat_memory\t10
public.coach_daily_briefs\t9
public.coach_daily_plans\t4
public.coach_goals\t0
public.coach_mission_logs\t0
public.coach_nudges\t15
public.coach_performance_snapshots\t0
public.coach_preference_signals\t0
public.coach_program_logs\t3
public.coach_programs\t2
public.coach_reflections\t0
public.coach_weekly_reviews\t0
public.content_moderations\t0
public.daily_checkins\t61
public.direct_messages\t25
public.feed_comments\t1
public.feed_posts\t2
public.feed_reactions\t6
public.friendships\t4
public.kudos\t1
public.leaderboard_champions\t2
public.leaderboard_season_baselines\t61
public.leaderboard_seasons\t3
public.legend_invites\t0
public.moderation_cache\t0
public.moderation_queue\t0
public.profiles\t21
public.push_tokens\t0
public.referrals\t0
public.reports\t0
public.tribe_battles\t0
public.tribe_invites\t1
public.tribe_members\t2
public.tribe_post_comments\t0
public.tribe_post_kudos\t0
public.tribe_post_reactions\t0
public.tribe_post_reports\t0
public.tribe_posts\t1
public.tribes\t1
public.user_badges\t98
public.user_habit_logs\t0
public.user_habits\t0
public.user_roles\t1
public.vault_articles\t25
public.vault_lesson_progress\t3
public.weekly_briefings\t4
```

## Artifact

- `lovable-cloud-migration-export.sql`

## Critical caveat

This artifact is useful as a fallback reconstruction export, but it is not as safe as a real admin-level `pg_dump --schema=auth --schema=public --schema=storage`, because auth constraints, indexes, sequences, triggers, and identities are best preserved by the native dump.
