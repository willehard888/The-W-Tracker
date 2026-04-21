

## Plan: Hard entry paywall + earned Elite status

### New mental model

| Old | New |
|---|---|
| App = free, **Elite = paid €4.99/mo** | App = **paid €4.99/mo**, **Elite = earned in-app status** |
| 9-day trial → blocks features | 7-day trial → blocks **entire app** |
| `is_elite` = subscription flag | `is_elite` = subscription flag (renamed mentally to "Subscriber"); **Elite tier** = `status_tier = 'elite'` (already exists, top 5%) |

The `status_tier` enum already has an `elite` rank earned via `update_status_tier()` (Top 5% percentile + 14 days activity). We make this the **real** Elite — visible status, badges, profile glow. The paid tier becomes simply "**Member**" (required to use the app).

---

### 1. Trial: 9 → 7 days
- `src/hooks/use-trial-access.ts`: change `TRIAL_DURATION_DAYS = 9` → `7`.
- DB function `has_active_access`: change `interval '9 days'` → `'7 days'`.

### 2. Hard entry paywall (no skip)
- `src/components/AccessGate.tsx`: keep current logic — already redirects to `/paywall` when trial expires. No code change needed beyond the 7-day update; the gate is already hard.
- `src/pages/Paywall.tsx`: 
  - Rewrite copy from "Go Elite / Unlock Elite features" → **"Membership required"** / "Continue your journey".
  - Hero: replace `Go Elite` headline with **"Become a Member"** + subtitle "€4.99/mo to unlock the app and start your Road to Elite".
  - Features list reframed as **what the app gives you** (daily check-ins, battles, leaderboard, AI Coach, Elite Feed access *if earned*), not as "Elite perks".
  - Keep the €4.99/mo + 7-day trial CTA.
  - Remove the "Already Elite ✓" celebration screen — replace with **"Membership active"** confirmation that links to profile.

### 3. "Road to Elite" — earned status UI
New component `src/components/RoadToElite.tsx` shown on **Profile** and **Index** for any subscribed user whose `status_tier` is below `elite`. It shows the 3 concrete requirements with live progress bars:

```text
ROAD TO ELITE                              Top 5% • Status Tier
─────────────────────────────────────────────
✓ Rank score (top 5%)        ████████░░  82 / 95 pts
✓ 14 days active in 30 days  ██████░░░░   9 / 14 days
✓ 30+ day streak             ████░░░░░░  12 / 30 days
─────────────────────────────────────────────
Keep showing up. Elite is earned, not bought.
```

Stricter Elite criteria (server-side) — update `update_status_tier()`:
- **Elite** now requires: percentile ≥ 95 **AND** activity_days ≥ 14 **AND** `streak ≥ 30` (currently only percentile + 14 days).
- **High Performer**: percentile ≥ 90 + activity ≥ 14 + streak ≥ 14.
- **Apex** / **Legend** unchanged but inherit the streak floor.

This makes Elite a meaningful long-term grind (~30 days minimum, real consistency).

### 4. Decouple paid features from `is_elite`
Today, `is_elite` (= subscriber) gates the Elite Feed and AI Coach. New rules:
- **AI Coach** (`/coach`): available to any subscriber (any user that passes `AccessGate`). Remove `isElite` checks in `Coach.tsx` + `ai-coach` edge function — change to `has_active_access(user_id)`.
- **Elite Feed posting**: stays gated — but on the **earned `status_tier = 'elite'`**, not on `is_elite`. Update RLS on `feed_posts` "Elite users can post" policy to check `status_tier IN ('elite','apex','legend')` instead of `is_elite = true`.
- **Elite Feed reading**: open to all members (any subscriber).
- **2× XP multiplier & Elite badges**: tied to earned `status_tier ≥ elite`.
- `EliteFeedTeaser` and `FeatureGateScreen`: shown when user is a subscriber but hasn't earned Elite tier yet — copy changes from "Unlock Elite €4.99" to **"Earn your Elite status"** with a link to Road to Elite.

### 5. Copy & UI sweep
- Crown/gold "Elite" badge in profile/avatar now reflects **earned tier**, not subscription.
- Subscription state shown as a small "Member since …" line on Profile (no crown).
- `BottomNav`, `EliteFeedTeaser`, `FeatureGateScreen`: replace "Unlock Elite" CTAs that point to `/paywall` with either the membership paywall (for non-members) or **Road to Elite** (for members who haven't earned it).

### 6. Memory updates
- Update `mem://monetization/elite-subscription` → rename to `mem://monetization/membership` reflecting new model.
- Add `mem://features/road-to-elite` documenting the earned tier requirements.
- Update `mem://index.md` Core: "App requires €4.99/mo membership. Elite is earned status (top 5% + 14 active days + 30-day streak)."

---

### Technical details

**Files edited**
- `src/hooks/use-trial-access.ts` — 7 days
- `src/pages/Paywall.tsx` — membership copy, remove "isElite" celebration
- `src/components/AccessGate.tsx` — comment update
- `src/pages/Coach.tsx` — drop `isElite` gate
- `src/pages/EliteFeed.tsx` — read open, post gated on earned tier
- `src/components/EliteFeedTeaser.tsx` — re-route to Road to Elite for members
- `src/components/FeatureGateScreen.tsx` — same
- `src/pages/Profile.tsx` — show Road to Elite + Membership status
- `src/pages/Index.tsx` — Road to Elite teaser for non-Elite-tier members

**Files created**
- `src/components/RoadToElite.tsx` — progress card with the 3 requirements
- `src/hooks/use-road-to-elite.ts` — fetches rank_score, 30-day activity, streak

**DB migrations**
- Update `has_active_access` → 7-day interval
- Update `update_status_tier` and `update_all_status_tiers` → add streak threshold to elite/high_performer
- Update RLS on `feed_posts` "Elite users can post" → check `status_tier`
- Edge function `ai-coach`: replace `is_elite` check with `has_active_access`

**Backwards compatibility**
- Existing Elite subscribers keep all access (they pass `has_active_access`).
- Users currently sitting at `status_tier = 'elite'` because of old criteria will be re-evaluated next time `update_status_tier` runs — some may drop to High Performer until they hit the 30-day streak. Acceptable since this matches the new "earned" promise.

**Conservative scope**
- No payment provider changes (RevenueCat / Stripe stay as-is).
- No onboarding flow changes (new users still see onboarding → land on `/` → AccessGate redirects to `/paywall` if no active trial/sub).
- No badge schema changes; existing `elite_member` badge requirement stays usable.

