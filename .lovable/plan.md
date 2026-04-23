

# Make the Collective Flame the Heart of Tribes

The collective flame (every member's streak combined) becomes the **main idea** of the Tribes experience — not a stat among many, but the centerpiece users come back to grow.

## The core idea (one sentence)

> **A tribe is a fire. Every member's streak feeds it. Stop showing up — it dies.**

Today's flame is a small panel buried inside the tribe page. We promote it to a hero on every Tribes surface and reframe all copy around "growing the fire together."

---

## What changes

### 1. `/tribes` — new cinematic hero (replaces current "Communities" banner)

A full-width **Hero Flame** — a single, massive `RealisticFlame` (220–260 px) representing **the user's combined tribe heat** (sum of streaks across every tribe they belong to). If they have no tribe, it shows a cold candle with the line *"Find a fire to feed."*

```text
   ╭─────────────────────────────────────╮
   │   🔥 BIG LIVE FLAME (animated)      │
   │                                     │
   │   1,247 days                        │
   │   YOUR COMBINED TRIBE HEAT          │
   │                                     │
   │   [████████░░] 253 to Diamond       │
   │   3 tribes · +4 members today       │
   ╰─────────────────────────────────────╯
```

- Tier label ("Hot → Warm → On Fire → Blazing → Diamond → Legendary → Firestorm") is the dominant headline.
- Segmented progress bar to next tier (already exists in `TribeCollectiveFlame`) is shown large.
- Ember particles + aurora rim already implemented stay; just scaled up.
- Below the hero: a single line "**Every check-in feeds the fire.**"

### 2. Each tribe row in the list — flame **is** the avatar

Replace the current 56-px Crown/avatar tile with a **live mini-flame sized by that tribe's tier**:
- Cold tribes → small candle icon (gray)
- Hot tribes → real animated flame at 48–80 px scaling with tier
- The number next to the name becomes "🔥 1,247 days · Diamond" — not member count first.

This makes scanning the list feel like walking past campfires of different sizes. Bigger flame = stronger tribe.

### 3. `/tribes/:id` — hero rebuilt around the flame

Current order: Apex header (Crown + name) → CollectiveFlame panel → battles → posts.
New order:

1. **The Flame** (full-bleed, ~280 px tall) — `TribeCollectiveFlame` enlarged, with the tribe name *under* the flame (not above).
2. **"Feed the fire" CTA** — if user hasn't checked in today, a pulsing button: *"Add today's day → +1 to the fire"* → links to `/checkin`.
3. **Member contribution strip** — small horizontal row showing each member's avatar + their current streak as a tiny flame, sorted by streak. Visualises "who is feeding the fire most." Tap → user profile.
4. Then: existing battles button, posts feed, etc.

### 4. Real-time growth feedback

- Subscribe to `profiles` updates for tribe members (Realtime) so when anyone checks in, the flame grows live and a small ember burst animation triggers (`+1` floating text rises from the base).
- A subtle "X members at risk" banner appears if anyone in the tribe has < 6 h left on their streak — turns the flame orange-red and adds the line *"Your fire is in danger."*

### 5. Copy & terminology shift

Everywhere "Tribe Streak" appears, rename to **"Tribe Fire"**. Examples:
- Hero label: `Tribe Fire` (was `Tribe Streak`)
- Tier names stay (Hot, Warm, On Fire, Blazing, Diamond, Legendary, Firestorm)
- Empty state: *"This fire is cold. Be the first to feed it."*
- Check-in success toast inside a tribe: *"+1 day → fire grew to 248"*

### 6. Notifications (optional, behind a flag)

When a tribe crosses a tier threshold (e.g. Warm → On Fire), trigger a push: *"🔥 Your tribe just hit On Fire — 100 days strong."* Uses existing `apns` push infra.

---

## Technical implementation

### Files to modify

| File | Change |
|---|---|
| `src/components/TribeCollectiveFlame.tsx` | Add `variant: "hero" \| "compact"` prop. Hero variant: 240–280 px flame, name below, no border (transparent over page tint). |
| `src/pages/Tribes.tsx` | Replace "Communities" banner with new `<TribeFireHero />`. Replace each tribe row's icon tile with `<RealisticFlame size={tierSize} />`. |
| `src/pages/TribeDetail.tsx` | Reorder: flame hero first, Apex header collapsed into a slim strip below. Add `MemberContributionStrip`. Subscribe to realtime updates. |
| `src/components/TribeFireHero.tsx` *(new)* | The big personal-heat hero on `/tribes`. Sums collective streaks across all user's tribes. |
| `src/components/MemberContributionStrip.tsx` *(new)* | Horizontal scroll of members with mini-flames sized by personal streak. |
| `src/components/FeedTheFireCTA.tsx` *(new)* | Pulsing button shown if user hasn't checked in today. |
| `src/lib/tribe-streak.ts` | Add `fetchUserTotalTribeHeat(userId)` helper. |
| `src/index.css` | Add `@keyframes ember-rise` for the floating "+1" feedback. |

### Data

No new tables. Uses existing `profiles.streak` + `tribe_members` (status='active'). Realtime subscription on `profiles` filtered by member user_ids per tribe page.

### Performance

- Cap realistic flame instances per screen (≤ 1 hero + ≤ 8 row mini-flames). Beyond that, fall back to a static flame SVG.
- Reuse existing `RealisticFlame` and `TribeCollectiveFlame` — no new SVG turbulence filters needed.

### Memory update

Update `mem://features/tribes` to record: *"Collective flame is the central metaphor. Every Tribes surface leads with the fire."*

---

## Out of scope (now)

- Changing the underlying tier thresholds (`30/100/300/700/1500/3000/6000`) — they stay.
- Battles UI — battles already reference the flame ("Bigger flame badge"); no changes needed.
- Backend changes — no new RPCs, no migrations.

