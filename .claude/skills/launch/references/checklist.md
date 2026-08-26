# App Store launch checklist — The W Tracker

Each item: what Apple requires → how to verify in THIS repo. Guideline
numbers reference Apple's App Review Guidelines. Verify, don't assume.

## 1. Highest risk: HealthKit (guideline 5.1.3)

- [ ] `NSHealthShareUsageDescription` (and `NSHealthUpdateUsageDescription`
      if writing) present in `ios/App/App/Info.plist`, written in plain
      user language naming what is read and why.
- [ ] HealthKit entitlement enabled in the Xcode project
      (`grep -r HealthKit ios/App --include='*.entitlements' -l` +
      project capabilities).
- [ ] Health data is used ONLY for the user-facing feature — never sent to
      advertising/analytics. Verify: grep where HealthKit values flow
      (`src/hooks/use-healthkit*`, health sync paths) and confirm no
      analytics payload carries raw health values.
- [ ] App works when HealthKit permission is denied (check-in must be fully
      manual) — verify the denial path renders.
- [ ] Privacy policy explicitly covers health data (see §4).

## 2. Subscriptions & payments (3.1.x)

- [ ] All digital-content purchases go through Apple IAP on iOS — Stripe
      web checkout must not be reachable from inside the native app
      (grep `create-checkout` / stripe URLs in client code; web-only paths
      must be gated off native).
- [ ] Paywall shows: price, billing period, trial terms, and working
      links to Privacy Policy + Terms of Use (EULA) — `src/pages/Paywall.tsx`.
- [ ] Restore Purchases button exists and works — grep `restore` in
      Paywall/RevenueCat context.
- [ ] IAP products exist in App Store Connect AND match RevenueCat product
      identifiers (founder verifies in both dashboards; list the product
      IDs from the code for them).
- [x] Free-trial copy matches reality — 7d organic / 14d referred; paywall +
      onboarding use neutral "free trial" wording (fixed 2026-08-26,
      `PremiumHero.tsx`, `OnboardingSlides.tsx`). InviteCTA keeps "14-day"
      (a referred friend genuinely gets 14). Re-verify if copy is edited.
- [ ] Paid Applications agreement + banking + tax active in ASC (founder).

## 3. User-generated content (1.2) — feed, tribes, comments, DMs

- [ ] Content moderation exists — server-side moderation of posts/images
      (moderate-content edge fn, `moderation_status` flow) ✓ expected; verify
      it still gates the feed.
- [x] Report/flag mechanism on every UGC surface — feed posts
      (`FeedPostCard.tsx`), tribe posts (`TribePostCard.tsx`), comments
      (`CommentThread.tsx` via `onReport`), DMs (`Chat.tsx` header kebab),
      profiles (`UserProfile.tsx` actions). Comment/DM/profile reports go
      through the `report_content` RPC into `moderation_queue`. Built
      2026-08-26 (`use-blocking.ts`). Regression check: each surface still
      has a Report control.
- [x] **Block user** — end-to-end via `blocked_users` + `is_blocked(a,b)`
      SECURITY DEFINER helper (one-way block, bidirectional hide). The block
      predicate is on every content SELECT policy (feed/tribe posts,
      comments, reactions, kudos, DMs, friendships) and both DM + friend
      INSERT WITH CHECK. UI: Block on `UserProfile.tsx` + `Chat.tsx` kebab,
      management page `/settings/blocked`. Migration
      `20260826160000_block_and_report.sql`. Regression check: `is_blocked`
      still referenced by the content policies (a policy rewrite must
      re-append `AND NOT public.is_blocked(...)`).
- [x] EULA/terms state zero tolerance for objectionable content — Apple 1.2
      wording + mention of report/block in `src/pages/TermsOfUse.tsx`
      (strengthened 2026-08-26).
- [x] Developer can act on reports within 24h — `AdminModeration.tsx` reads
      `moderation_queue` (realtime); reject removes the reported row for
      feed_post / tribe_post / comment / tribe_comment content types
      (extended 2026-08-26). Founder-side: the 24h response is a process
      commitment, not code.

## 4. Privacy (5.1)

- [ ] Privacy policy URL live and accurate (whealthfactory.com) — covers
      health data, account data, analytics, subscriptions, deletion.
- [ ] App Privacy "nutrition labels" in ASC match reality (founder fills;
      prepare the answer sheet from code: health & fitness data, email,
      user content, identifiers, purchase history, usage data — linked to
      identity, not used for tracking).
- [x] `PrivacyInfo.xcprivacy` privacy manifest present + wired into the App
      target — required-reason APIs (UserDefaults CA92.1, file timestamp,
      disk space, boot time), NSPrivacyTracking false (added 2026-08-26).
      Regression check: still in the pbxproj Resources build phase.
- [ ] No ATT prompt needed (no cross-app tracking) — confirm no tracking
      SDKs exist.
- [ ] Account deletion available IN-APP (5.1.1(v)) — delete-account flow in
      Profile settings ✓ expected; verify it still fully purges + signs out.

## 5. Sign-in (4.8)

- [ ] Sign in with Apple offered alongside any other third-party login ✓
      expected (native Apple auth exists). Verify it's on the auth screen,
      not buried.
- [ ] Reviewer demo account: prepare working credentials for App Review
      notes (founder creates; must not be a QA account that gets deleted).

## 6. Technical & stability (2.1)

- [ ] App launches and functions offline / with no data — cold start on a
      fresh install must not hang on network (check splash → auth path).
- [ ] No crashes on the happy path: fresh install → onboarding → check-in.
- [ ] Push notification permission is requested in context (priming sheet),
      and the app is fully usable if denied.
- [ ] All remote URLs are https; no dev/localhost endpoints in production
      build (grep `http://localhost` in src minus dev configs).
- [ ] Version + build number scheme sane (Codemagic minutes-since-2026) and
      marketing version bumped for the release.
- [ ] App runs on the minimum supported iOS version set in the project.

## 7. Store listing / ASO (founder in ASC, Claude prepares text)

- [ ] App name (≤30 chars), subtitle (≤30), keywords (≤100 chars, no
      duplicates of name/subtitle), description with first-3-lines hook.
- [ ] Screenshots: 6.9" and 6.5" iPhone sets (5–10), showing real product
      value in brand style; optional app preview video.
- [ ] Category: Health & Fitness. Age rating questionnaire (UGC → likely
      12+; unrestricted web access: no).
- [ ] Support URL + marketing URL live.
- [ ] Release notes for v1.
- [ ] "What to test" notes for the TestFlight → App Review handoff, incl.
      demo account and HealthKit test instructions.

## 8. Legal

- [ ] Terms of Use / EULA reachable in-app AND linked in ASC metadata
      (required when auto-renewing subscriptions exist).
- [ ] Medical disclaimer: coach/health advice framed as wellness guidance,
      not medical advice (check coach system prompts + onboarding copy).
- [ ] CC BY-SA attribution for Everkinetic exercise illustrations visible
      where the library is used.
