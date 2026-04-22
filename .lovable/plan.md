

# Next-Level Unified Theme

Goal: push the whole app one tier higher in craft and cohesion. Single visual language across every screen. **No animation changes** — only static visual properties (color, material, depth, type, spacing, borders).

## Theme: "Obsidian & Gold"

One theme, applied everywhere. Dark obsidian glass as the base, warm gold as the single accent, controlled tier tints (purple/teal/rose/amber) only as semantic signal — never as decoration.

## 1. Tighten the palette (`index.css` tokens)

- **Background**: deepen base from `260 18% 4%` → `258 22% 3%` for more "ink black" depth. Card `255 14% 7%` → `258 16% 6.5%` so cards lift more cleanly.
- **Border**: split into `--border` (hairlines, `258 14% 16%`) and new `--border-strong` (`258 14% 22%`) for headers/dividers.
- **Foreground tiers**: add `--foreground-muted` (`40 6% 72%`) and `--foreground-faint` (`255 6% 38%`) so text hierarchy stops relying on opacity hacks.
- **Gold**: keep core, but introduce `--gold-soft` (`42 60% 46%`) for non-primary gold accents (icons, hairlines) so primary gold stays special.
- **Tier accents** become reserved: only used on tier crests, badges, and the rank/risk system — never on generic cards.

## 2. One unified surface system

Three official surfaces, every component picks exactly one:

- **Primary surface** — `surface-glass` (already strong). Used for hero/feature cards: Command Deck, RankProgressHub, Coach card, Briefing, Battles, Tribe headers.
- **Secondary surface** — new `surface-panel`: matte obsidian, single hairline border, soft inner top highlight, no glow. Used for list items, leaderboard rows, message bubbles, settings rows. Removes the current mix of `bg-card`, `glass-card`, `surface-paper`, custom inline styles.
- **Inset surface** — new `surface-inset`: recessed look (inner top shadow + faint bottom highlight). Used for input fields, progress tracks, chat input, tab content backgrounds.

Deprecate (alias to new ones, don't delete to avoid breakage): `card-3d`, `card-3d-gold`, `card-depth`, `card-depth-lg`, `card-hover`, `glass-card`, `surface-paper`. They get mapped internally to `surface-panel` or `surface-glass` so existing markup auto-upgrades.

## 3. Hairline & divider system

- Replace all 1px solid borders with **gradient hairlines**: `linear-gradient(90deg, transparent, hsl(border-strong), transparent)` for horizontal, mirrored for vertical. Used in section breaks, list separators, BottomNav top edge, header bottom edge.
- Single `--hairline` utility class so every divider in the app looks identical.

## 4. Typography scale (one ladder)

Define a strict 6-step scale used app-wide:
- `display-xl` — 32/38, Space Grotesk 800, `-0.025em`
- `display-lg` — 24/30, Space Grotesk 700, `-0.02em`
- `display-md` — 18/24, Space Grotesk 700, `-0.015em`
- `body-lg` — 15/22, Inter 500, `-0.005em`
- `body` — 13/19, Inter 500, `-0.003em`
- `caption` — 11/14, Inter 600, `0.06em` uppercase, `--foreground-faint`

Applied to: page titles, card titles, section headings, tier labels, all "uppercase tracking-widest" labels currently scattered across components. Replaces inline `text-[10px]/[11px]/[12px] tracking-[0.18em/0.22em]` chaos with one consistent caption.

## 5. Iconography normalization

- Lucide stroke width pinned to `1.75` everywhere (currently varies 1.5–2.6).
- Icon sizes standardized to 14 / 16 / 18 / 22 / 28 — no off-grid sizes.
- Icon color = `--foreground-muted` by default; gold only when icon represents a primary action or status signal (Flame, Crown, Trophy, Lock).

## 6. Spacing rhythm

- Card inner padding: `p-4` (16px) for compact, `p-5` for standard, `p-6` for hero. Currently mixes p-2.5/3/4/6 randomly.
- Vertical gap between sections on every page: `mb-4` (16px). Hero block gets `mb-5`.
- Page horizontal padding pinned to `px-4` (already mostly true) — audit `Profile`, `Leaderboard`, `Tribes`, `Coach`, `Battles`, `EliteFeed` to match.

## 7. Pages that get the unified pass

Visual-only sweep — no logic changes:

- `Profile.tsx`, `PublicProfile.tsx`, `UserProfile.tsx` — stat tiles to `surface-panel`, headers to `surface-glass`.
- `Leaderboard.tsx`, `TribeLeaderboard.tsx` — row surface unified, hairline dividers, position badges use single accent ramp.
- `Tribes.tsx`, `TribeDetail.tsx`, `Battles.tsx`, `TribeBattles.tsx` — card system unified; remove ad-hoc gradients.
- `Coach.tsx`, `WeeklyBriefing.tsx`, `EliteFeed.tsx` — `surface-glass` heroes, `surface-panel` content, `surface-inset` inputs.
- `Messages.tsx`, `Chat.tsx` — message bubbles use `surface-panel` (received) / soft gold tint (sent), `surface-inset` for the composer.
- `Auth.tsx`, `Onboarding.tsx`, `Paywall.tsx` — keep their cinematic intensity but adopt the type scale and gold ramp so they feel like the same product.
- `StatusHeader.tsx`, `BottomNav.tsx` — already glass; switch to new hairline system for top/bottom edges.

## 8. What we explicitly do NOT touch

- **No animation/keyframe changes.** All `@keyframes`, `animate-*`, framer-motion timings, page transitions, streak flames, ember bursts, conic spins, shimmer sweeps stay byte-identical.
- No layout restructuring of any page.
- No DB / RLS / edge function changes.
- No new dependencies.

## Files touched

- `src/index.css` — token tightening, new `surface-panel` / `surface-inset` / `--hairline` utilities, type scale classes, deprecated-alias mappings
- `src/components/ui/{card,input,textarea,progress,tabs,separator,badge}.tsx` — adopt new surfaces & hairline
- `src/components/StatusHeader.tsx`, `src/components/BottomNav.tsx` — hairline edges
- `src/components/{StatCard,LevelCard,TierLadder,RankPressureCard,BadgeCard,TribePostCard,TribeBattleCard,LiveRivals,HeadToHead,ProfileActivityPulse,StreakDisplay,XpCounter,InviteCTA,CoachNudgeCard}.tsx` — surface + type unification
- `src/pages/{Profile,PublicProfile,UserProfile,Leaderboard,TribeLeaderboard,Tribes,TribeDetail,Battles,TribeBattles,Coach,WeeklyBriefing,EliteFeed,Messages,Chat}.tsx` — surface/spacing/type pass

Because the changes flow through `Card`, the new surface utilities, and the type scale, screens not directly edited still inherit the unified theme automatically.

