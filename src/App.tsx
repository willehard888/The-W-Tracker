import { lazy, Suspense, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { MotionConfig } from "framer-motion";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications, PushControlsContext } from "@/hooks/use-push-notifications";
import { useOfflineCheckinSync } from "@/hooks/use-offline-checkin-sync";
import { useOfflineNutritionSync } from "@/hooks/use-offline-nutrition-sync";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { useActivityHeartbeat } from "@/hooks/use-activity-heartbeat";
import PushPrimingSheet from "@/components/notifications/PushPrimingSheet";
import OnboardingProvider from "@/components/onboarding/OnboardingProvider";
import { cancelLapsedReengagement } from "@/lib/streak-notifications";
import { startWind } from "@/lib/wind";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RevenueCatProvider } from "@/contexts/RevenueCatContext";
import AmbientParticles from "@/components/AmbientParticles";
import BottomNav from "@/components/BottomNav";
import StatusHeader from "@/components/StatusHeader";
import TierPromotionCelebration from "@/components/TierPromotionCelebration";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import OAuthCallback from "./pages/OAuthCallback";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages for code-splitting
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
const AppleAuthLaunch = lazy(() => import("./pages/AppleAuthLaunch"));
const ChooseUsername = lazy(() => import("./pages/ChooseUsername"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Coach = lazy(() => import("./pages/Coach"));
const AthleteProfileSettings = lazy(() => import("./pages/AthleteProfileSettings"));
const CoachReflect = lazy(() => import("./pages/CoachReflect"));
const CoachGoal = lazy(() => import("./pages/CoachGoal"));
const CoachProgress = lazy(() => import("./pages/CoachProgress"));
const Journey = lazy(() => import("./pages/Journey"));
const CoachProgramDetail = lazy(() => import("./pages/CoachProgramDetail"));
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
import { fetchTribesPage } from "@/lib/tribes-query";
import { parseStorageUrl, isPrivateStorageUrl, signMediaUrl, signedMediaKey, SIGNED_MEDIA_STALE_MS } from "@/lib/signed-url";

const LazyFallback = () => (
  <div className="min-h-full flex items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
  </div>
);

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

// Dev harness (?paywallDev=1): force the gate closed to exercise the paywall
// without waiting 14 days. Sticky via sessionStorage (SPA navigation drops
// the query string). Dead code in production builds.
const devForcedPaywall = (): boolean => {
  if (!import.meta.env.DEV) return false;
  if (new URLSearchParams(window.location.search).has("paywallDev")) {
    sessionStorage.setItem("w_paywall_dev", "1");
  }
  return sessionStorage.getItem("w_paywall_dev") === "1";
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  // Membership OR live 14-day trial (hook is isElite-aware) — called before
  // any early return so the hook order stays stable.
  const trial = useTrialAccess();
  if (loading) return <LazyFallback />;
  if (!user) return <Navigate to="/landing" replace />;

  const path = window.location.pathname;

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
  const onboarded = !!profile?.onboarded_at || !!localStorage.getItem("w_onboarding_done");
  if (profile?.onboarded_at && !localStorage.getItem("w_onboarding_done")) {
    try { localStorage.setItem("w_onboarding_done", "true"); } catch { /* noop */ }
  }
  if (!onboarded && path !== "/onboarding" && path !== "/choose-username") {
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
    (PAYWALL_ENABLED && !trial.loading && !trial.hasAccess) || devForcedPaywall();
  if (gated && !ACCESS_EXEMPT.has(path)) {
    return <Navigate to="/paywall" replace />;
  }

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
const AppRoutes = () => {
  const { user } = useAuth();
  const { needsPriming, enablePush, dismissPriming, resyncStreakWarning } = usePushNotifications();
  useOfflineCheckinSync();
  useOfflineNutritionSync();
  useActivityHeartbeat();

  // Win-backs moved server-side (winback-lapsed) — cancel the legacy local
  // +3d/+7d timers once per session so pre-update devices don't get doubles.
  useEffect(() => {
    if (!user) return;
    cancelLapsedReengagement();
  }, [user]);

  // Ambient wind for every flame in the app. The CSS plumbing (--wind-x /
  // --wind-gust in the flame keyframes) shipped long ago but nothing ever
  // started the loop — the fire has been standing still since day one.
  // Reduced-motion users keep still flames: their flame animations are off,
  // so the vars are never read.
  useEffect(() => {
    startWind();
  }, []);

  // Every page lands at the top. The main scroll container persists across
  // route changes (it lives outside <Routes>), so without this its scroll
  // position would carry over when navigating between tabs — making a new
  // page open already scrolled down. Reset it on every pathname change.
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  // Page-transition wrap was REMOVED — keying a motion.div on
  // location.pathname caused React to unmount + remount the entire
  // page tree on every navigation, which:
  //   - reset scroll position on every tab switch
  //   - re-ran every useEffect (re-fetched all data)
  //   - lost in-flight form state
  //   - made Tribes appear empty for ~1s after every tab switch
  // Component-level animations (framer-motion on cards, motion variants
  // on individual cards) still provide visual polish without the
  // re-mount tax.

  return (
    <PushControlsContext.Provider value={{ enablePush, dismissPriming, resyncStreakWarning }}>
    <OnboardingProvider>
    <div className="max-w-md mx-auto h-[100dvh] flex flex-col relative z-10">
      <StatusHeader />
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden momentum-scroll">
        {/* RouteFallback renders a layout-matched skeleton for the destination
            route (HomeSkeleton on /, FeedSkeleton on /feed, etc.) so the lazy-
            load → real-content swap has zero visual jank. LazyFallback (a
            spinner) is kept as the gate while auth resolves. */}
        <Suspense fallback={<RouteFallback />}>
          {/* Route-level ErrorBoundary — keeps the app shell (StatusHeader +
              BottomNav) visible if the current page crashes. The global
              ErrorBoundary at the very root only kicks in for
              shell-level failures. Page crashes get a contained recovery
              UI here so the user can still navigate elsewhere.
              key={pathname}: without it the boundary LATCHED into the error
              state — tapping BottomNav changed the URL but the fallback kept
              rendering and the user could never navigate out. */}
          <ErrorBoundary key={location.pathname}>
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
          <Route path="/recipes" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
          {/* A recipe is a route, not local state — so the coach and the Vault
              can link to a specific dish, and Back actually goes back. */}
          <Route path="/recipes/:id" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
          <Route path="/nutrition" element={<ProtectedRoute><NutritionDiary /></ProtectedRoute>} />
          <Route path="/nutrition/photo" element={<ProtectedRoute><NutritionPhotoReview /></ProtectedRoute>} />
          <Route path="/nutrition/targets" element={<ProtectedRoute><NutritionTargets /></ProtectedRoute>} />
          <Route path="/nutrition/foods/new" element={<ProtectedRoute><UserFoodEditor /></ProtectedRoute>} />
          <Route path="/nutrition/foods/:id/edit" element={<ProtectedRoute><UserFoodEditor /></ProtectedRoute>} />
          <Route path="/nutrition/recipes" element={<ProtectedRoute><NutritionRecipes /></ProtectedRoute>} />
          <Route path="/nutrition/recipes/new" element={<ProtectedRoute><NutritionRecipeEditor /></ProtectedRoute>} />
          <Route path="/nutrition/recipes/:id" element={<ProtectedRoute><NutritionRecipeEditor /></ProtectedRoute>} />
          <Route path="/exercises" element={<ProtectedRoute><Exercises /></ProtectedRoute>} />
          {/* Same reason as /recipes/:id — a movement the coach prescribes
              should be linkable, and Back should close the detail. */}
          <Route path="/exercises/:slug" element={<ProtectedRoute><Exercises /></ProtectedRoute>} />
          <Route path="/briefing/:id" element={<ProtectedRoute><WeeklyBriefing /></ProtectedRoute>} />
          <Route path="/admin/moderation" element={<ProtectedRoute><AdminModeration /></ProtectedRoute>} />
          <Route path="/admin/legend-invites" element={<ProtectedRoute><AdminLegendInvites /></ProtectedRoute>} />
          <Route path="/admin/metrics" element={<ProtectedRoute><AdminMetrics /></ProtectedRoute>} />
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
            <Route path="/ios-debug" element={<ProtectedRoute><IosDebug /></ProtectedRoute>} />
          )}
          <Route path="/apple-auth-launch" element={<AppleAuthLaunch />} />
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
      <BottomNav />
      {user && <TierPromotionCelebration />}
      <PushPrimingSheet open={needsPriming} onEnable={enablePush} onDismiss={dismissPriming} />
    </div>
    </OnboardingProvider>
    </PushControlsContext.Provider>
  );
};

/**
 * Warms every main tab while the user is still on Home, so each first tap
 * renders instantly instead of paying its route chunk + data round trips at
 * the moment of the tap (on a high-RTT connection: 1.5–3s of spinner per
 * surface). Two waves: the feed (the most-opened tab) at +1.5s, everything
 * else at +3.5s. All best-effort; every page still loads itself normally.
 */
const TabPrefetcher = () => {
  useEffect(() => {
    // One timer per app boot, deliberately NOT keyed on the auth context —
    // its user object identity churns (token refresh, profile updates) and a
    // [user]-dep effect kept clearing the timeout before it ever fired.
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const userId = data.session.user.id;
        await queryClient.prefetchQuery({
          queryKey: ["feed-posts", false],
          queryFn: () => fetchFeedPosts(false),
        });
        // Warm the first screenful of media signatures (images use the
        // feed's 760px transform; videos sign plain — keys must match
        // PostMedia/AppImage exactly or the warm entry is wasted).
        const posts: any[] = queryClient.getQueryData(["feed-posts", false]) ?? [];
        const withMedia = posts.filter((p) => p.image_url || p.video_url).slice(0, 8);
        await Promise.all(
          withMedia.map((p) => {
            const url: string = p.image_url || p.video_url;
            const parsed = parseStorageUrl(url);
            if (!parsed || !isPrivateStorageUrl(url)) return null;
            const transform = p.image_url ? { width: 760, quality: 82 } : undefined;
            return queryClient.prefetchQuery({
              queryKey: signedMediaKey(url, transform),
              queryFn: () => signMediaUrl(parsed, transform),
              staleTime: SIGNED_MEDIA_STALE_MS,
            });
          }),
        );
        // ── Wave 2: the other main tabs (chunks + data) ─────────────────
        setTimeout(async () => {
          try {
            // Route chunks — kills the Suspense skeleton flash on first tap.
            void import("./pages/Squad");
            void import("./pages/Leaderboard");
            void import("./pages/Profile");
            void import("./pages/DailyCheckin");
            void import("./pages/TribeDetail");

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
                  queryFn: () => fetchSeasonBoard(season.id, userId),
                  staleTime: 5 * 60_000,
                }),
              );
            }

            // Tribes tab: the page mounts on "browse" and flips to "mine"
            // for members after its own probe — warm BOTH variants so the
            // flip renders from cache and neither state ever spinners.
            const tribesJob = (async () => {
              const { data: mem } = await supabase
                .from("tribe_members")
                .select("tribe_id")
                .eq("user_id", userId)
                .eq("status", "active")
                .limit(1);
              const jobs = [
                queryClient.prefetchQuery({
                  queryKey: ["tribes-page", "browse", null, userId],
                  queryFn: () => fetchTribesPage("browse", null, userId),
                }),
              ];
              if ((mem?.length ?? 0) > 0) {
                jobs.push(
                  queryClient.prefetchQuery({
                    queryKey: ["tribes-page", "mine", null, userId],
                    queryFn: () => fetchTribesPage("mine", null, userId),
                  }),
                );
              }
              await Promise.all(jobs);
            })();

            await Promise.all([...seasonJobs, tribesJob]);
          } catch {
            /* best-effort */
          }
        }, 2000);
      } catch {
        /* prefetch is best-effort — the feed loads normally without it */
      }
    }, 1500);
    return () => clearTimeout(t);
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
    </ErrorBoundary>
  );
};

export default App;
