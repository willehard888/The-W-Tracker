import { ScrollContainerProvider } from "@/contexts/ScrollContainerContext";
import { shouldGateOnboarding } from "@/lib/onboarding-gate";
import { HARNESS_KEY, readHarnessParam, shouldForcePaywall } from "@/lib/paywall-harness";
import { useAdminAccess, useIsAdmin } from "@/hooks/use-is-admin";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { webExitFor } from "@/lib/web-surface";
import { LazyMotion, MotionConfig } from "framer-motion";

// Animation features load AFTER first paint. With the eager `motion` import
// the 40 kB gzip framer chunk sat in modulepreload on every cold start to
// power one StatusHeader bar; `m` renders the same elements, `domAnimation`
// arrives on the first animation.
const loadMotionFeatures = () => import("framer-motion").then((mod) => mod.domAnimation);
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { readLocal, writeLocal } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications, PushControlsContext } from "@/hooks/use-push-notifications";
import { useOfflineCheckinSync } from "@/hooks/use-offline-checkin-sync";
import { useOfflineNutritionSync } from "@/hooks/use-offline-nutrition-sync";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { useActivityHeartbeat } from "@/hooks/use-activity-heartbeat";
import { useOnline } from "@/hooks/use-online";
import PushPrimingSheet from "@/components/notifications/PushPrimingSheet";
import OnboardingProvider from "@/components/onboarding/OnboardingProvider";
import { cancelLapsedReengagement } from "@/lib/streak-notifications";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { pageKey } from "@/lib/nav";
import { setNavigator } from "@/lib/router-bridge";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RevenueCatProvider } from "@/contexts/RevenueCatContext";
import AmbientParticles from "@/components/AmbientParticles";
import BottomNav from "@/components/BottomNav";
import StatusHeader from "@/components/StatusHeader";
import TierPromotionCelebration from "@/components/TierPromotionCelebration";

// Lazy: the sheet is asked for once, and it must not ride in the boot chunk.
const AiConsentSheet = lazy(() => import("@/components/consent/AiConsentSheet"));
import Index from "./pages/Index";
import OAuthCallback from "./pages/OAuthCallback";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages for code-splitting
// Landing and Auth were static imports — 110 kB gzip of entry chunk carried
// two screens a signed-in user never renders (and Auth dragged the Apple
// button's motion + native-auth along). Lazy like the other 56 routes.
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const DailyCheckin = lazy(() => import("./pages/DailyCheckin"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Battles = lazy(() => import("./pages/Battles"));
const Profile = lazy(() => import("./pages/Profile"));
const Referrals = lazy(() => import("./pages/Referrals"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Paywall = lazy(() => import("./pages/Paywall"));
const BadgeCompare = lazy(() => import("./pages/BadgeCompare"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const Messages = lazy(() => import("./pages/Messages"));
const Friends = lazy(() => import("./pages/Friends"));
const Chat = lazy(() => import("./pages/Chat"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const BlockedUsers = lazy(() => import("./pages/BlockedUsers"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const IosDebug = lazy(() => import("./pages/IosDebug"));
const ChooseUsername = lazy(() => import("./pages/ChooseUsername"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Coach = lazy(() => import("./pages/Coach"));
const AthleteProfileSettings = lazy(() => import("./pages/AthleteProfileSettings"));
const CoachReflect = lazy(() => import("./pages/CoachReflect"));
const CoachGoal = lazy(() => import("./pages/CoachGoal"));
const CoachProgress = lazy(() => import("./pages/CoachProgress"));
const Journey = lazy(() => import("./pages/Journey"));
const CoachProgramDetail = lazy(() => import("./pages/CoachProgramDetail"));
const CoachSession = lazy(() => import("./pages/CoachSession"));
const Recovery = lazy(() => import("./pages/Recovery"));
const CoachMemoryScreen = lazy(() => import("./pages/CoachMemoryScreen"));
const Squad = lazy(() => import("./pages/Squad"));
const TribeNew = lazy(() => import("./pages/TribeNew"));
const TribeDetail = lazy(() => import("./pages/TribeDetail"));
const TribeBattles = lazy(() => import("./pages/TribeBattles"));
const TribeLeaderboard = lazy(() => import("./pages/TribeLeaderboard"));
const Vault = lazy(() => import("./pages/Vault"));
const Recipes = lazy(() => import("./pages/Recipes"));
const Exercises = lazy(() => import("./pages/Exercises"));
// Nutrition engine — the diary and its satellites light the Today tab (BottomNav PARENT_TAB).
const NutritionDiary = lazy(() => import("./pages/nutrition/NutritionDiary"));
const NutritionPhotoReview = lazy(() => import("./pages/nutrition/NutritionPhotoReview"));
const NutritionTargets = lazy(() => import("./pages/nutrition/NutritionTargets"));
const UserFoodEditor = lazy(() => import("./pages/nutrition/UserFoodEditor"));
const NutritionRecipes = lazy(() => import("./pages/nutrition/NutritionRecipes"));
const NutritionRecipeEditor = lazy(() => import("./pages/nutrition/NutritionRecipeEditor"));
const WeeklyBriefing = lazy(() => import("./pages/WeeklyBriefing"));
const AdminModeration = lazy(() => import("./pages/AdminModeration"));
const AdminLegendInvites = lazy(() => import("./pages/AdminLegendInvites"));
const AdminMetrics = lazy(() => import("./pages/AdminMetrics"));
const ButtonGallery = lazy(() => import("./pages/ButtonGallery"));

// queryClient moved to src/lib/query-client.ts so AuthContext.signOut can
// clear it on logout (shared-device data leakage).

import RouteFallback from "@/components/RouteFallback";
import { fetchFeedPosts } from "@/lib/feed-query";
import { fetchActiveSeason, fetchAllTimeLeaders, fetchSeasonBoard } from "@/lib/leaderboard-query";
import { fetchMyTribeMembership, fetchTribesPage } from "@/lib/tribes-query";
import { fetchVaultArticleSummaries, vaultArticlesKey } from "@/hooks/use-vault-articles";
import { afterIdle, onIdle } from "@/lib/idle";

// Paths reachable WITHOUT an active subscription/trial — the paywall itself,
// onboarding, the username picker, and legal pages — so a gated user can
// still subscribe, finish setup and read terms.
const ACCESS_EXEMPT = new Set([
  "/paywall",
  "/onboarding",
  "/choose-username",
  "/privacy",
  "/terms",
  "/reset-password",
]);

// Master switch for the hard paywall gate in ProtectedRoute. ON since the
// 8,99 €/mo launch (2026-09-01): members and 14-day trialists pass, everyone
// else lands on /paywall. Pilot testers get through by redeeming a pilot code,
// which grants membership credits — not by the gate being open.
const PAYWALL_ENABLED = true;

// Harness (?paywallDev=1 / ?paywallDev=0): force the gate closed to exercise
// the paywall without waiting 14 days. Sticky via sessionStorage (SPA
// navigation drops the query string). Live in dev builds and for admin
// accounts in any build — sandbox purchases are driven on the simulator and
// TestFlight. It only ever closes the gate, never opens it.
const forcedPaywall = (isAdmin: boolean): boolean => {
  const param = readHarnessParam(window.location.search);
  if (param === "on") sessionStorage.setItem(HARNESS_KEY, "1");
  if (param === "off") sessionStorage.removeItem(HARNESS_KEY);
  return shouldForcePaywall({
    dev: import.meta.env.DEV,
    isAdmin,
    param,
    sticky: sessionStorage.getItem(HARNESS_KEY) === "1",
  });
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  // Membership OR live 14-day trial (hook is isElite-aware) — called before
  // any early return so the hook order stays stable.
  const trial = useTrialAccess();
  // Admins may force the paywall shut on themselves (the sandbox harness).
  const isAdmin = useIsAdmin(user?.id);
  // The router's location, not the window global the component never
  // subscribed to; a trailing slash used to miss the exemption list.
  const { pathname } = useLocation();
  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/landing" replace />;

  const path = pathname.replace(/\/+$/, "") || "/";

  // DB-driven username gate: anyone whose handle wasn't their own choice
  // (Apple/OAuth placeholder, collision suffix, legacy auto-generation)
  // picks one before anything else. Replaces the old Apple-only
  // sessionStorage gate — the flag rides on the profile row itself.
  if (profile?.username_is_auto === true && path !== "/choose-username") {
    return <Navigate to="/choose-username" replace />;
  }

  // Onboarding gate — the DB flag (profiles.onboarded_at) is the authority so
  // a reinstall / new device / signOut on a shared device never replays the
  // flow; localStorage stays as a sync fast-path cache for the same device.
  const onboardedLocally = readLocal("w_onboarding_done") === "true";
  if (profile?.onboarded_at && !onboardedLocally) writeLocal("w_onboarding_done", "true");
  if (shouldGateOnboarding(profile, onboardedLocally) && path !== "/onboarding" && path !== "/choose-username") {
    return <Navigate to="/onboarding" replace />;
  }

  // Hard paywall: trial.hasAccess = paid membership OR inside the 14-day
  // trial (credits/apex/legend ride the membership flag). Never gate while
  // the trial clock is still loading — a flash-redirect to /paywall on every
  // cold start taught users to distrust the app.
  //
  // ACCESS_EXEMPT keeps the paywall itself, onboarding, the username picker
  // and the legal pages reachable — without it a gated user is bounced in a
  // loop with no way to pay, redeem a pilot code, or read the terms.
  const gated =
    (PAYWALL_ENABLED && !trial.loading && !trial.hasAccess) || forcedPaywall(isAdmin);
  if (gated && !ACCESS_EXEMPT.has(path)) {
    return <Navigate to="/paywall" replace />;
  }

  return <>{children}</>;
};

/**
 * Admin-only routes. The three /admin pages each re-check for themselves and
 * their RPCs enforce has_role(admin) server-side, but /ios-debug had no gate
 * at all: any signed-in member who guessed the path read the device
 * diagnostics and the log buffer. One wrapper so a new admin page cannot
 * forget.
 */
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { isAdmin, loading } = useAdminAccess(user?.id);
  if (loading) return <RouteFallback />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

/**
 * ─────────────────────────────────────────────────────────────────────────
 * ROUTING — THE ONLY ROUTER
 * ─────────────────────────────────────────────────────────────────────────
 *
 * App.tsx's <Routes> is the SINGLE source of truth for navigation.
 * Two previous router files (ModalStack.tsx, TabHost.tsx) were deleted
 * in commit fix-routing-audit because:
 *   - they were never imported anywhere (dead code)
 *   - they registered routes that App.tsx didn't, creating ghost routes
 *     that 404'd at runtime (`/briefing/:id`, `/tribes/new`, all
 *     `/coach/*` sub-routes)
 *   - they invited the dangerous mistake "I'll just add my new route in
 *     ModalStack" → silent NotFound for users
 *
 * Rules for adding a route:
 *   1. Lazy-import the page at the top of this file
 *   2. Add a <Route path="..." element={<ProtectedRoute>...</ProtectedRoute>}/>
 *      below — order doesn't matter except the `*` catchall MUST stay last
 *   3. If the route is public (no auth required), wrap with just the
 *      element, not ProtectedRoute (see /u/:username for example)
 *   4. Add the new route's PATH to the navigate() call site at the same
 *      time — don't ship one without the other
 *
 * Audit command — verify every navigate() destination has a Route:
 *   grep -rohE 'navigate\(["\x27]/[^"\x27]+' src --include="*.tsx" --include="*.ts" \
 *     | sed -E 's/navigate\(["\x27]//' | sed -E 's|/:[^/]+|/:id|g' | sort -u
 *
 * Then cross-reference against:
 *   grep -oE 'path="/[^"]+"' src/App.tsx | sort -u
 */
/** The pages whose scroll position survives a hop into a sub-page and back. */
const TAB_ROOTS = new Set(["/", "/squad", "/leaderboard", "/profile"]);
const savedScroll = new Map<string, number>();

const AppRoutes = () => {
  const { user } = useAuth();
  // Native listeners (a push tap) navigate through the router, never through
  // a raw history.pushState — that dropped the router's idx for the session.
  const navigate = useNavigate();
  useEffect(() => { setNavigator(navigate); }, [navigate]);
  const { needsPriming, primingContext, enablePush, dismissPriming, resyncStreakWarning, primeAfterCheckin } = usePushNotifications();
  // One object identity per callback set — a fresh literal re-rendered every
  // context consumer on each shell render.
  const pushControls = useMemo(
    () => ({ enablePush, dismissPriming, resyncStreakWarning, primeAfterCheckin }),
    [enablePush, dismissPriming, resyncStreakWarning, primeAfterCheckin],
  );
  useOfflineCheckinSync();
  useOfflineNutritionSync();
  useActivityHeartbeat();
  const online = useOnline();

  // Coming back from the background used to show yesterday. refetchOnWindowFocus
  // is off (a WebView fires focus constantly) and the default staleTime is two
  // minutes, so a phone unlocked after a night's sleep painted whatever was in
  // the cache and waited for a navigation to correct itself. Resuming, and
  // regaining the network, refetch what is on screen AND already stale —
  // catalogs pinned with a long staleTime are left alone.
  useEffect(() => {
    const refresh = () => { void queryClient.refetchQueries({ type: "active", stale: true }); };
    window.addEventListener("native:resume", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("native:resume", refresh);
      window.removeEventListener("online", refresh);
    };
  }, []);

  // Win-backs moved server-side (winback-lapsed) — cancel the legacy local
  // +3d/+7d timers once per session so pre-update devices don't get doubles.
  useEffect(() => {
    if (!user) return;
    cancelLapsedReengagement();
  }, [user]);

  // Every page lands at the top. The main scroll container persists across
  // route changes (it lives outside <Routes>), so without this its scroll
  // position would carry over when navigating between tabs — making a new
  // page open already scrolled down. Reset it before paint (a post-paint
  // scrollTo was a second layout on every page change), keyed on the page:
  // a list↔detail hop inside Exercises/Recipes keeps the page mounted and the
  // page restores its own list position.
  const location = useLocation();
  const key = pageKey(location.pathname);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // A tab root keeps its place. Home → Library → an exercise → Back used to
  // land at the top of the day, and Profile → Settings → a setting → Back at
  // the top of Profile, every time — the user re-scrolled after every hop.
  // The position is saved for the page being left and restored before paint
  // for the four roots; every other page still opens at the top.
  //
  // The position is recorded as the user scrolls, not read in the effect's
  // cleanup: the cleanup runs after the commit has already swapped the page
  // out of the scroller, so `scrollTop` had already been clamped against the
  // new (shorter) content and every root "restored" to 0 (seen on device).
  const keyRef = useRef(key);
  keyRef.current = key;
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => { savedScroll.set(keyRef.current, el.scrollTop); };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  // Any page keeps its place when you come BACK to it (a pop): the Recover
  // library → a routine → back landed at the top of a forty-row list. Opened
  // fresh (a push), everything but the four roots still starts at the top.
  const navType = useNavigationType();
  useLayoutEffect(() => {
    const keep = TAB_ROOTS.has(key) || navType === "POP";
    scrollContainerRef.current?.scrollTo(0, keep ? (savedScroll.get(key) ?? 0) : 0);
    // navType belongs to the same navigation as `key`; keyed on the page only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // No web version of the app: on the public site only the legal pages and
  // password reset render from here, and any other route — typed, linked, or
  // reached by the back button on /privacy — leaves for the static page before
  // it paints. vercel.json refuses the same paths on the server; see
  // src/lib/web-surface.ts for why both locks exist.
  const webExit = webExitFor(window.location.hostname, location.pathname, Capacitor.isNativePlatform());
  useLayoutEffect(() => {
    if (webExit) window.location.replace(webExit);
  }, [webExit]);

  // Page-transition wrap was REMOVED — keying a m.div on
  // location.pathname caused React to unmount + remount the entire
  // page tree on every navigation, which:
  //   - reset scroll position on every tab switch
  //   - re-ran every useEffect (re-fetched all data)
  //   - lost in-flight form state
  //   - made Tribes appear empty for ~1s after every tab switch
  // Component-level animations (framer-motion on cards, motion variants
  // on individual cards) still provide visual polish without the
  // re-mount tax.

  if (webExit) return null;

  return (
    <PushControlsContext.Provider value={pushControls}>
    <OnboardingProvider>
    <div className="max-w-md mx-auto h-[100dvh] flex flex-col relative z-10">
      <StatusHeader />
      {!online && (
        <p role="status" className="shrink-0 px-4 py-1.5 text-center text-meta text-muted-foreground/75 bg-muted/40">
          Offline — showing what's already synced
        </p>
      )}
      <ScrollContainerProvider value={scrollContainerRef}>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden momentum-scroll">
        {/* RouteFallback renders a layout-matched skeleton for the destination
            route (HomeSkeleton on /, FeedSkeleton on /feed, etc.) so the lazy-
            load → real-content swap has zero visual jank. ProtectedRoute
            renders the same fallback while auth resolves, so a cold start
            is one continuous skeleton (index.html paints its static twin). */}
        <Suspense fallback={<RouteFallback />}>
          {/* Route-level ErrorBoundary — keeps the app shell (StatusHeader +
              BottomNav) visible if the current page crashes. The global
              ErrorBoundary at the very root only kicks in for
              shell-level failures. Page crashes get a contained recovery
              UI here so the user can still navigate elsewhere.
              key={pathname}: without it the boundary LATCHED into the error
              state — tapping BottomNav changed the URL but the fallback kept
              rendering and the user could never navigate out. Keyed on the
              page, not the path, so a list↔detail hop does not remount. */}
          <ErrorBoundary key={key}>
          <Routes>
          <Route path="/landing" element={user ? <Navigate to="/" replace /> : <Landing />} />
          <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/choose-username" element={<ProtectedRoute><ChooseUsername /></ProtectedRoute>} />
          {/* Legacy alias — the picker used to be Apple-only */}
          <Route path="/apple-username" element={<Navigate to="/choose-username" replace />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/checkin" element={<ProtectedRoute><DailyCheckin /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
          <Route path="/battles" element={<ProtectedRoute><Battles /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/coach" element={<ProtectedRoute><Coach /></ProtectedRoute>} />
          <Route path="/coach/profile" element={<ProtectedRoute><AthleteProfileSettings /></ProtectedRoute>} />
          {/* Protocol-habit system removed — habits live ONLY in the check-in.
              Old push deep links land on Coach. */}
          <Route path="/coach/habits" element={<Navigate to="/coach" replace />} />
          <Route path="/coach/reflect" element={<ProtectedRoute><CoachReflect /></ProtectedRoute>} />
          <Route path="/coach/goal" element={<ProtectedRoute><CoachGoal /></ProtectedRoute>} />
          <Route path="/coach/progress" element={<ProtectedRoute><CoachProgress /></ProtectedRoute>} />
          <Route path="/journey" element={<ProtectedRoute><Journey /></ProtectedRoute>} />
          <Route path="/coach/program" element={<ProtectedRoute><CoachProgramDetail /></ProtectedRoute>} />
          {/* The active workout. Full-screen by design — the nav and status
              header are hidden so nothing competes with the set in front of
              the athlete. */}
          <Route path="/recovery" element={<ProtectedRoute><Recovery /></ProtectedRoute>} />
          <Route path="/coach/session/:week/:day" element={<ProtectedRoute><CoachSession /></ProtectedRoute>} />
          <Route path="/coach/memory" element={<ProtectedRoute><CoachMemoryScreen /></ProtectedRoute>} />
          <Route path="/coach/library" element={<Navigate to="/coach" replace />} />
          <Route path="/squad" element={<ProtectedRoute><Squad /></ProtectedRoute>} />
          {/* Legacy standalone routes — Squad is the single entry point for
              Feed and Tribes (renders them behind its segmented header). */}
          <Route path="/tribes" element={<Navigate to="/squad?tab=tribes" replace />} />
          <Route path="/tribes/new" element={<ProtectedRoute><TribeNew /></ProtectedRoute>} />
          <Route path="/tribes/leaderboard" element={<ProtectedRoute><TribeLeaderboard /></ProtectedRoute>} />
          <Route path="/tribes/:id" element={<ProtectedRoute><TribeDetail /></ProtectedRoute>} />
          <Route path="/tribes/:id/battles" element={<ProtectedRoute><TribeBattles /></ProtectedRoute>} />
          <Route path="/vault" element={<ProtectedRoute><Vault /></ProtectedRoute>} />
          {/* A recipe is a route, not local state — so the coach and the Vault
              can link to a specific dish, and Back actually goes back. One
              route for list + detail: the list stays mounted under the detail. */}
          <Route path="/recipes/:id?" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
          <Route path="/nutrition" element={<ProtectedRoute><NutritionDiary /></ProtectedRoute>} />
          <Route path="/nutrition/photo" element={<ProtectedRoute><NutritionPhotoReview /></ProtectedRoute>} />
          <Route path="/nutrition/targets" element={<ProtectedRoute><NutritionTargets /></ProtectedRoute>} />
          <Route path="/nutrition/foods/new" element={<ProtectedRoute><UserFoodEditor /></ProtectedRoute>} />
          <Route path="/nutrition/foods/:id/edit" element={<ProtectedRoute><UserFoodEditor /></ProtectedRoute>} />
          <Route path="/nutrition/recipes" element={<ProtectedRoute><NutritionRecipes /></ProtectedRoute>} />
          <Route path="/nutrition/recipes/new" element={<ProtectedRoute><NutritionRecipeEditor /></ProtectedRoute>} />
          <Route path="/nutrition/recipes/:id" element={<ProtectedRoute><NutritionRecipeEditor /></ProtectedRoute>} />
          {/* Same reason as /recipes/:id? — a movement the coach prescribes
              should be linkable, and Back should close the detail. */}
          <Route path="/exercises/:slug?" element={<ProtectedRoute><Exercises /></ProtectedRoute>} />
          <Route path="/briefing/:id" element={<ProtectedRoute><WeeklyBriefing /></ProtectedRoute>} />
          <Route path="/admin/moderation" element={<ProtectedRoute><AdminRoute><AdminModeration /></AdminRoute></ProtectedRoute>} />
          <Route path="/admin/legend-invites" element={<ProtectedRoute><AdminRoute><AdminLegendInvites /></AdminRoute></ProtectedRoute>} />
          <Route path="/admin/metrics" element={<ProtectedRoute><AdminRoute><AdminMetrics /></AdminRoute></ProtectedRoute>} />
          {import.meta.env.DEV && <Route path="/button-gallery" element={<ProtectedRoute><ButtonGallery /></ProtectedRoute>} />}
          <Route path="/feed" element={<Navigate to="/squad" replace />} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
          <Route path="/paywall" element={<ProtectedRoute><Paywall /></ProtectedRoute>} />
          <Route path="/badges/compare" element={<ProtectedRoute><BadgeCompare /></ProtectedRoute>} />
          <Route path="/user/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
          <Route path="/chat/:partnerId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/settings/blocked" element={<ProtectedRoute><BlockedUsers /></ProtectedRoute>} />
          <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<TermsOfUse />} />
          {/* Debug panel persists token-presence + auth flow state — never
              expose it on the public prod web build. Native app + dev only,
              and behind auth. */}
          {(import.meta.env.DEV || Capacitor.isNativePlatform()) && (
            <Route path="/ios-debug" element={<ProtectedRoute><AdminRoute><IosDebug /></AdminRoute></ProtectedRoute>} />
          )}
          <Route path="/~oauth" element={<OAuthCallback />} />
          <Route path="/~oauth/callback" element={<OAuthCallback />} />
          <Route path="/oauth" element={<OAuthCallback />} />
          <Route path="/callback" element={<OAuthCallback />} />
          <Route path="/oauth/:segment" element={<OAuthCallback />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
          </ErrorBoundary>
        </Suspense>
      </div>
      </ScrollContainerProvider>
      <BottomNav />
      {user && <TierPromotionCelebration />}
      {/* The one place the app asks to send what a member logs to an AI model.
          It registers with the consent gate; every AI surface asks through it. */}
      {user && <Suspense fallback={null}><AiConsentSheet /></Suspense>}
      <PushPrimingSheet open={needsPriming} context={primingContext} onEnable={enablePush} onDismiss={dismissPriming} />
    </div>
    </OnboardingProvider>
    </PushControlsContext.Provider>
  );
};

/**
 * Warms every main tab while the user is still on Home, so each first tap
 * renders instantly instead of paying its route chunk + data round trips at
 * the moment of the tap (on a high-RTT connection: 1.5–3s of spinner per
 * surface). Two idle waves: the feed (the most-opened tab) first, everything
 * else after. All best-effort; every page still loads itself normally.
 */
const TabPrefetcher = () => {
  useEffect(() => {
    // Scheduled once per app boot, deliberately NOT keyed on the auth context —
    // its user object identity churns (token refresh, profile updates) and a
    // [user]-dep effect kept cancelling the wave before it ever fired.
    // afterIdle, not onIdle: "idle" comes ~150 ms after paint, so the waves
    // used to land inside Home's own request burst (37 calls in 1.4 s).
    const cancelFeed = afterIdle(() => void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        await queryClient.prefetchQuery({
          queryKey: ["feed-posts", false],
          queryFn: () => fetchFeedPosts(false),
        });
      } catch {
        /* prefetch is best-effort — the feed loads normally without it */
      }
    })(), 3000);
    // ── Wave 2: the other main tabs (chunks + data) ─────────────────────
    const cancelRest = afterIdle(() => void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const userId = data.session.user.id;
        // Route chunks — kills the Suspense skeleton flash on first tap. One
        // per idle slot: seven imports in one tick were a ~400 kB parse spike
        // about five seconds in, right as the member starts scrolling Home.
        // TribeDetail is two taps away and no longer rides along.
        const chunks = [
          () => import("./pages/Squad"),
          () => import("./pages/Leaderboard"),
          () => import("./pages/Profile"),
          () => import("./pages/DailyCheckin"),
          // Reached from the Today card, the diary door and the library door —
          // each was a Suspense skeleton on first tap.
          () => import("./pages/Coach"),
          () => import("./pages/nutrition/NutritionDiary"),
        ];
        const next = () => { const load = chunks.shift(); if (load) void load().catch(() => {}).finally(() => onIdle(next, 1500)); };
        next();
        // Not Exercises: its chunk drags ExerciseIllustration (165 kB) and
        // ExerciseCoachingBlock (137 kB) — a main-thread parse spike while the
        // user is reading Home, for a screen reached from the Library shelf.

        // The Vault index (light columns) — its headline used to be a skeleton
        // for ~1.5 s because the page fetched every article body to count them.
        void queryClient.prefetchQuery({
          queryKey: vaultArticlesKey(userId),
          queryFn: () => fetchVaultArticleSummaries(),
          staleTime: 5 * 60_000,
        });

        // Ranks: season chain + all-time board (keys match Leaderboard.tsx).
        await queryClient.prefetchQuery({
          queryKey: ["active-season"],
          queryFn: fetchActiveSeason,
          staleTime: 10 * 60_000,
        });
        const season: any = queryClient.getQueryData(["active-season"]);
        const seasonJobs: Promise<unknown>[] = [
          queryClient.prefetchQuery({
            queryKey: ["leaderboard-all-time"],
            queryFn: fetchAllTimeLeaders,
            staleTime: 5 * 60_000,
          }),
        ];
        if (season?.id) {
          seasonJobs.push(
            queryClient.prefetchQuery({
              queryKey: ["leaderboard-season", season.id, userId],
              queryFn: () => fetchSeasonBoard(season.id),
              staleTime: 5 * 60_000,
            }),
          );
        }

        // Tribes tab: members land on "mine", everyone else on "browse" —
        // warm the tab it will land on (warming both cost a member ~12 round
        // trips for a tab they may never open). The membership answer is
        // cached under the key the page reads, so it decides the tab on its
        // first render instead of probing again.
        const tribesJob = (async () => {
          const isMember = await queryClient.fetchQuery({
            queryKey: ["my-tribe-membership", userId],
            queryFn: () => fetchMyTribeMembership(userId),
            staleTime: 5 * 60_000,
          });
          const tab = isMember ? "mine" : "browse";
          await queryClient.prefetchQuery({
            queryKey: ["tribes-page", tab, null, userId],
            queryFn: () => fetchTribesPage(tab, null, userId),
          });
        })();

        await Promise.all([...seasonJobs, tribesJob]);
      } catch {
        /* best-effort */
      }
    })(), 4500);
    return () => { cancelFeed(); cancelRest(); };
  }, []);
  return null;
};

const App = () => {
  // SplashScreen previously rendered for ~1.5s on every cold start before
  // the React tree appeared. The user asked to remove the app-open animation
  // entirely — gone now. iOS native splash (LaunchScreen.storyboard) still
  // covers the brief boot delay on the native shell; the web build just
  // shows the page directly.
  return (
    <ErrorBoundary>
      {/* reducedMotion="user" → every framer-motion animation honors the OS
          "Reduce Motion" setting. The default `transition` gives everything a
          single, physical spring signature (smooth, near-critically-damped —
          matches the CSS --ease-spring token) so motion reads as one designed
          system instead of framer's stock tween. Components with their own
          transition still override. */}
      <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 320, damping: 30 }}>
      <QueryClientProvider client={queryClient}>
        <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <RevenueCatProvider>
                <AmbientParticles />
                <TabPrefetcher />
                <ErrorBoundary>
                  <AppRoutes />
                </ErrorBoundary>
              </RevenueCatProvider>
            </AuthProvider>
          </BrowserRouter>
      </QueryClientProvider>
      </MotionConfig>
      </LazyMotion>
    </ErrorBoundary>
  );
};

export default App;
