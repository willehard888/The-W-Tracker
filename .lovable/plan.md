
# AI Personal Trainer — Next Level + Deep Personalization

Building on the closed-loop upgrades, this plan adds a **personalization layer** so the Coach feels like it actually knows *this specific human* — their body, schedule, goals, language, history, and quirks.

---

## A. Athlete Profile (the Coach's source of truth about *you*)

A structured "who I am" model the AI reads on every generation.

- New `coach_athlete_profile` table (1 row per user):
  - **Body**: age, sex, height_cm, weight_kg, body_fat_pct (optional)
  - **Goals**: primary_goal (enum: strength / hypertrophy / endurance / fat_loss / longevity / focus), secondary_goal, target_horizon_weeks
  - **Schedule**: timezone, wake_time, sleep_time, training_days_pref[], busy_blocks (e.g. "Wed 18-21")
  - **Constraints**: injuries[], dietary (vegan/halal/lactose/etc), equipment[], no_go_protocols[] (user can blacklist e.g. "cold exposure")
  - **Style**: language_pref (auto-detect or chosen), tone_pref (drill_sergeant / calm_mentor / scientist / hype), preferred_session_length_min
  - **Identity**: `i_am` statement (one sentence: "I'm a father of 2 building strength after 35")
- New onboarding flow `AthleteProfileOnboarding.tsx` — 6-step swipe (body → goal → schedule → constraints → tone → identity), takes ~90 seconds
- Editable any time via `Coach › Settings → Profile`

## B. Personalized Mission Generation

Every prompt to `coach-daily-plan` now includes the athlete profile, not just stats.

- Hard rules added:
  - Skip protocols in `no_go_protocols`
  - Respect `dietary` (no "post-workout whey" if vegan → "soy/pea protein")
  - Respect `injuries` (no "back squat" if lower-back injury → "goblet squat")
  - Respect `equipment` (home-only → no barbell prescriptions)
  - Time missions to `wake_time` / `sleep_time` ("morning light within 60 min of your 06:30 wake")
  - Match `tone_pref` exactly (system prompt swaps voice template)
  - Prefer protocols matching `primary_goal` weighting (e.g. fat_loss → +Z2, +protein, −fasted_cardio gimmicks)
- Mission detail includes a "for you because…" line referencing profile (e.g. "You said you want strength after 35 — progressive overload is non-negotiable.")

## C. Adaptive Personalization Memory

The AI learns preferences from behavior, not just from the form.

- New `coach_preference_signals` table — append-only events:
  - `skipped_protocol` (e.g. user skipped `cold-2-3min` 5×) → auto-add to soft-blacklist after 5 skips, surface UI prompt: "You keep skipping cold — remove from rotation?"
  - `preferred_time_of_day` (when user usually completes missions) → schedule similar missions at that hour
  - `language_used` (detected from chat) → updates `language_pref`
  - `tone_feedback` (thumbs up/down on assistant messages) → drift `tone_pref` toward what they like
- Weekly review surfaces top 3 inferred preferences and asks user to confirm/reject

## D. Conversational Memory & Long-term Context

Right now chat only remembers last 7 days of stats. Make it remember *the relationship*.

- New `coach_chat_memory` table — AI-distilled facts (max 30 per user, FIFO):
  - Auto-extracted by `coach-extract-memory` (runs after each chat session, summarizes new persistent facts: "User's daughter's name is Aino", "User races a 10k in October", "User dislikes running")
  - Injected into `ai-coach` system prompt as "What I know about you:"
- User-visible **Memory** screen at `/coach/memory` — list, edit, delete any fact (transparency + control)
- "Forget that" command in chat triggers deletion

## E. Goal-Driven Mission Targeting

Generic missions become *your* missions tied to *your* goal.

- Each athlete profile carries a **target metric** (e.g. "Bench 100kg by Aug", "Run 5k under 25min", "Sleep 7.5h avg for 30 days")
- New `coach_goals` table with current value, target value, deadline, weekly_milestone
- `coach-daily-plan` prompt: "Today's primary mission must move the needle on: Bench 100kg by Aug (currently 82.5kg, +0.5kg/week pace needed)"
- New **Goal Tracker** card on Today tab: progress bar, projected ETA, on/off-pace badge
- Weekly review computes pace and AI proposes goal adjustment if drifting >20%

## F. Voice & Language Personalization

- Auto-detect user's chat language → all coach output (missions, headlines, voice replies) localized
- `tone_pref` × language → 4 voice templates per language (drill / calm / scientist / hype)
- Voice mode (from earlier plan) uses ElevenLabs-style or Web Speech voice matching `tone_pref`

## G. Smart Plan Timing

The plan currently regenerates daily at midnight UTC. Personalize it.

- Plan auto-regenerates at **user's local wake time + 5 min** via per-user cron schedule (or on first app open after wake)
- Reflection card appears **2h before user's local sleep time**, not blanket 19:00
- Push triggers (pre-workout, reflection nudge) all use user's local schedule

---

## Technical changes (additive to previous plan)

**New tables** (1 migration):
- `coach_athlete_profile` (user_id PK, all fields above, RLS: user can CRUD own)
- `coach_preference_signals` (event log, indexed on user_id+type)
- `coach_chat_memory` (user_id, fact, source, created_at, max 30 enforced via trigger)
- `coach_goals` (user_id, metric, current, target, deadline, weekly_milestone, status)

**New RPCs**:
- `upsert_athlete_profile`, `log_preference_signal`, `add_chat_memory`, `delete_chat_memory`, `upsert_goal`, `update_goal_progress`

**New edge functions**:
- `coach-extract-memory` (runs post-chat, distills facts via gemini-2.5-flash)
- `coach-personalized-cron` (replaces blanket daily cron — fans out per user at their local wake time)

**Edge function updates**:
- `coach-daily-plan`: inject athlete_profile + chat_memory + active_goal into prompt, enforce constraints
- `ai-coach`: inject athlete_profile + chat_memory + tone template, post-message trigger memory extraction

**New / updated UI**:
- `AthleteProfileOnboarding.tsx` (6-step, gates first plan generation)
- `AthleteProfileSettings.tsx` (edit any time)
- `CoachMemoryScreen.tsx` (`/coach/memory`)
- `GoalTrackerCard.tsx` (Today tab, top)
- `PreferenceConfirmModal.tsx` (weekly review surfaces inferred prefs)
- Tone/language switcher in chat header

**Memory update**: extend `mem://features/ai-coach.md` with athlete profile schema, memory extraction loop, and tone/language personalization rules.

---

## Out of scope (intentionally)

- Wearables/Apple Health (still future)
- Actual voice cloning (Web Speech is good enough v1)
- Multi-user shared programs

---

## Rollout order (combined with previous plan)

1. **Athlete profile** (table + onboarding + settings) — foundation everything else uses
2. Reflections (closes daily loop)
3. Personalized mission generation + adaptive preference signals
4. Chat memory + memory screen
5. Goals + tracker card
6. Adaptive mission engine
7. Weekly meta-coach review
8. Performance OS dashboard
9. Smart plan timing (per-user cron)
10. Voice mode + tone-matched output
11. Proactive push triggers (localized to user schedule)

Approve and I'll build in this order.
