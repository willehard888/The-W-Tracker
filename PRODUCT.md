# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The product ships as an iPhone app (a Capacitor shell around a React UI, so its
design language is web). The public website at www.whealthfactory.com is a
separate static surface: a landing page and company information only.

## Stack

The website is static HTML, CSS and a little JS in `site/`, copied to the
root of the Vercel build by `scripts/build-site.mjs` (the React shell moves to
`app.html`). Nothing in `site/` reaches the iOS bundle. There is no web version of the app: the React bundle is served
on the website for exactly `/privacy`, `/terms` and `/reset-password`
(`src/lib/web-surface.ts` and `vercel.json` enforce it on both sides).

## Users

People who want their discipline to be visible, led by the ambitious: roughly
18–35, the gym, habits and self-command already part of their life, motivated by
seeing their progress and having it seen — status, streaks, rank and proof. The
site speaks to them first without shutting out people whose aim is simply a
steadier everyday rhythm of sleep, training and food. (Confirmed: "both, but
ambition leads".)

## Product Purpose

Whealth Factory turns discipline into something you can see. One check-in a day
locks in sleep, training, food and habits; every day shown up builds a streak,
XP and a rank, and every day skipped shows too. Around that core: an AI coach
that knows your week, training that adapts to the day, a food diary, a library
of evidence-rated lessons (the Vault), and a squad of friends who see your
proof. Success is a daily ritual kept, made visible, and made social.

## Positioning

Discipline made visible and verifiable. The daily check-in is checked against
Apple Health, feeds status tiers that are earned and never bought, and is read
by a coach before it answers — so the progress a member shows is progress that
happened. Neighbouring habit trackers count; this one proves and ranks.

## Operating Context

A member opens the app once a day to lock in the day (under a minute), then
returns to train, log food, ask the coach, read the Vault or check the squad.
iPhone only, portrait. Apple Health is optional. The app is not yet on the App
Store (version 1.0 prepared; the developer account is moving to the company).

## Capabilities and Constraints

Confirmed, and the only claims the site may make:

- Daily check-in (under a minute); streaks, XP, levels, status tiers earned not
  bought; seasons and leaderboards.
- AI coach reading check-ins, training logs and Apple Health sleep; morning
  brief, day plan, weekly review. AI features are off until the member opts in.
- Training: sessions built from muscles, minutes and intensity; weekly programs
  from profile, equipment and injuries; own programs from 260+ illustrated
  exercises; set logging with loads that follow what you lift.
- Nutrition: food diary with search, barcode scanning and photo logging;
  calorie and macro targets; Nordic and international food data.
- The Vault: 80+ short lessons, each with an evidence rating, references and a
  same-day practice; the ideas of 21 thinkers.
- Squad: tribes, a proof feed, direct messages, 1v1 battles; report and block
  everywhere.
- Apple Health: optional; sleep, steps, active energy.
- Membership: 14 days of full access free with no payment details, then
  Whealth Factory Premium, monthly or yearly, auto-renewing through Apple.
- Not a medical device; gives no medical advice.

Constraints:

- **No web app.** The site never signs anyone up, logs anyone in, or offers the
  product in a browser.
- **Headline: "Join the movement."** (founder, 2026-09-18, replacing
  "Discipline, made daily."). **Action line: "Coming to the App Store".** No
  email capture, no waitlist form on the site. On launch day the action line
  becomes an App Store link.
- **English only.**
- iPhone only; there is no Android or iPad version to mention.

## Brand Commitments

- **Name:** Whealth Factory. The legal entity is Whealth Factory Corporation
  Finland Oy, business ID 3636449-8, Soukansalmentie 30 A, 02360 Espoo, Finland
  (`src/lib/company.ts`); the site must name it.
- **Logo binds:** the gold W mark and the name (`public/app-icon.webp`,
  `src/components/BrandLogo.tsx`). Everything else on the website — palette,
  typography, composition — is free to be new. (Confirmed: "Logo binds, the rest
  may be new".)
- **Voice** from the app: direct, earned, unsentimental — "locked in", "proof",
  "discipline you can see", "earn your status", "built for those who refuse to
  be average". No exclamation marks, no wellness softness.

## Evidence on Hand

- Real product UI, capturable from the iPhone simulator on the QA account.
  Screens showing other members' names or avatars must not be used.
- 268 exercise illustrations (`public/illustrations/`), 15 recipe photographs
  generated for the app (`src/assets/recipes/square/`), the Vault's gem mark.
- **Absent, and not to be fabricated:** testimonials, member counts, ratings,
  reviews, press, partner logos, results or outcome claims. The app has never
  been released.

## Product Principles

1. Proof over promises: show the mechanism, never claim an outcome.
2. Earned, never bought: status is a result of days kept, not money spent.
3. One ritual at the centre: every feature hangs off the daily check-in.
4. Calm by default, one spectacle: the founder's standing taste — chrome stays
   quiet and a single element carries the drama.
