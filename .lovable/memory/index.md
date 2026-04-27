# Memory: index.md
Updated: now

# Project Memory

## Core
UI: English, h-[100dvh] layout, cinematic effects, functional color system.
Auth: Apple Sign-In managed in Safari, forces valid username selection.
DB: Supabase with strict RLS, SECURITY DEFINER RPCs for all critical writes.
Access: 7-tier status system based on XP/consistency. Drops with inactivity.
Constraints: Daily check-in/Battle proofs require real-time camera (no gallery).
Membership: €4.99/mo + 7-day trial unlocks the entire app. €15.99/mo Apex Instant adds bought Apex tier + Tribes (max 3).
Elite: EARNED status tier (top 5% rank + 14 active days + 30-day streak). Apex tier can be earned (top 1%) OR bought via subscription (no decay while active).

## Memories
- [Brand Identity](mem://style/brand-identity) — Core visual identity, golden W logo, cinematic effects
- [Color Palette](mem://style/color-palette) — Functional colors for features (Teal, Rose, Amber, Purple, Orange)
- [Unified Fire Theme](mem://style/unified-fire-theme) — All accent tokens re-tinted to warm fire spectrum; BottomNav uses gold/ember/lava only
- [Visual Effects](mem://style/visual-effects) — AmbientParticles, light cones, vignettes, glassmorphism
- [UI Layout](mem://style/ui-layout-decisions) — h-[100dvh] flex, shrink-0 nav, hidden on specific routes
- [Native UX](mem://ux/native-experience) — Capacitor Haptics, BottomNav with safe-area and backdrop-blur
- [Native Transitions](mem://ux/native-transitions) — Three-tier route transitions (tab/push/modal), scroll memory on POP, instant pointerdown nav, layoutId pill, per-route skeletons
- [Level Progression UI](mem://features/level-progression-ui) — Dynamic LevelCard (Rookie to Legendary), auto-updating styles
- [Splash Screen](mem://style/splash-screen) — 2.3s session-based splash, sequence animation, gold particles
- [Elite Unlock Animation](mem://features/elite-unlock-experience) — Full-screen celebration sequence triggered on upgrade
- [Gamification System](mem://features/gamification-system) — Daily check-ins, quests, and sleep-based XP penalties
- [Badge Vault](mem://features/badge-system) — 102 badges, server-side validation RPC, real-time progress
- [Battles System](mem://features/battles-system) — User challenges, delta XP calculation, secure RPCs
- [Leaderboard](mem://features/leaderboard-status) — Season/All-Time, monthly reset, Hall of Champions
- [Streak System](mem://features/streak-system) — Progressive milestones, 48h deadline reset, effective streak
- [Status Hierarchy](mem://features/status-hierarchy) — 7 tiers, degrades with inactivity, unlocks features
- [Status Addiction Loops](mem://features/status-addiction-loops) — TierRiskBanner, DailyStatusPulse, LiveRivals, TierLadder, days-at-tier
- [Rank Scoring Formula](mem://technical/rank-scoring-logic) — 25% 7d XP, 20% streak, 55% 30d consistency, Trust Multiplier
- [Elite Feed](mem://features/elite-feed) — Exclusive media feed for Elite users, HEIC/video support
- [Elite Feed Kudos](mem://features/kudos-system) — 2 kudos/month for Elite users, awards +10 XP to poster
- [Social Infrastructure](mem://features/social-infrastructure) — Real-time chat, friend requests, username search
- [User Profiles](mem://features/user-profiles) — Stats, Season Champion history, Weekly Sleep XP multiplier
- [Membership](mem://monetization/membership) — Two tiers: €4.99/mo Member (with trial) + €15.99/mo Apex Instant (no trial)
- [Tribes](mem://features/tribes) — Apex-only communities (sub OR earned apex/legend), max 3 owned, RPC-gated
- [Road to Elite](mem://features/road-to-elite) — Earned Elite tier requires top 5% + 14 active days + 30-day streak
- [RevenueCat Sub Sync](mem://technical/subscription-sync) — Webhook handles INITIAL_PURCHASE, RENEWAL, EXPIRATION
- [Push Notifications](mem://technical/push-notifications) — Capacitor + Supabase Edge Functions for daily reminders/messages
- [APNs Push](mem://technical/apns-push) — Direct iOS push via Apple .p8 token auth, ES256 JWT in Deno
- [Role-Based Access Control](mem://technical/access-control) — RBAC via user_roles, admin powers (willehard)
- [Backend Security Policies](mem://technical/backend-architecture-security) — SECURITY DEFINER RPCs, strict RLS, JWT Edge Functions
- [Proof Validation Rules](mem://constraints/proof-validation) — Real-time camera requirement, 5-minute expiry for proofs
- [Localization Rules](mem://technical/localization) — English UI, local subscription price format
- [Competitive Pressure UX](mem://ux/intensity-and-pressure) — Constant rank visibility, urgency microcopy
- [Onboarding Flow](mem://features/onboarding-flow) — 4-step swipable intro, framer-motion, local storage flag
- [Story Share Modal](mem://features/viral-loop/premium-sharing) — 3:4 aspect ratio PNG generation, tier-themed branding
- [App Store Demo Account](mem://technical/demo-account-access) — demo@thewtracker.com, demo-login Edge Function, dummy data
- [Authentication Methods](mem://auth/authentication-methods) — Managed Auth in Safari, username selection, oauthHandled flag
- [Apple Username Selection](mem://auth/apple-username-selection) — Forces username choice for new/generic accounts, pending flag
- [iOS Build Constraints](mem://technical/ios-development-build) — Xcode Cloud lockfile integrity, no @capacitor-community/apple-sign-in
- [App Store Compliance](mem://constraints/app-store-compliance) — iPad orientations required, ITSAppUsesNonExemptEncryption=false
- [iOS Debug View](mem://technical/ios-debug-system) — /ios-debug route logs OAuth and RevenueCat metadata
- [Live Web UI Update](mem://technical/live-update-config) — Native app loads production URL, forces reload cache bypass
- [AI Coach](mem://features/ai-coach) — Member-only `/coach` chat (any active subscriber), GPT-5 streaming, 7d memory + morning nudges
- [Sunday Briefing](mem://features/sunday-briefing) — Weekly AI briefing for Elite, Sundays 19:00 UTC, shareable image
