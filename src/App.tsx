import { lazy, Suspense, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RevenueCatProvider } from "@/contexts/RevenueCatContext";
import AmbientParticles from "@/components/AmbientParticles";
import BottomNav from "@/components/BottomNav";
import StatusHeader from "@/components/StatusHeader";
import AccessGate from "@/components/AccessGate";
import TierPromotionCelebration from "@/components/TierPromotionCelebration";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import OAuthCallback from "./pages/OAuthCallback";
import NotFound from "./pages/NotFound";
import { isAppleUsernameSelectionPending } from "@/lib/apple-username";

// Lazy-loaded pages for code-splitting
const DailyCheckin = lazy(() => import("./pages/DailyCheckin"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Battles = lazy(() => import("./pages/Battles"));
const Profile = lazy(() => import("./pages/Profile"));
const EliteFeed = lazy(() => import("./pages/EliteFeed"));
const Referrals = lazy(() => import("./pages/Referrals"));
const Paywall = lazy(() => import("./pages/Paywall"));
const BadgeCompare = lazy(() => import("./pages/BadgeCompare"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const Messages = lazy(() => import("./pages/Messages"));
const Friends = lazy(() => import("./pages/Friends"));
const Chat = lazy(() => import("./pages/Chat"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const IosDebug = lazy(() => import("./pages/IosDebug"));
const AppleAuthLaunch = lazy(() => import("./pages/AppleAuthLaunch"));
const AppleUsername = lazy(() => import("./pages/AppleUsername"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Coach = lazy(() => import("./pages/Coach"));
const AthleteProfileSettings = lazy(() => import("./pages/AthleteProfileSettings"));
const CoachHabits = lazy(() => import("./pages/CoachHabits"));
const CoachReflect = lazy(() => import("./pages/CoachReflect"));
const CoachGoal = lazy(() => import("./pages/CoachGoal"));
const CoachProgress = lazy(() => import("./pages/CoachProgress"));
const CoachProgramDetail = lazy(() => import("./pages/CoachProgramDetail"));
const CoachMemoryScreen = lazy(() => import("./pages/CoachMemoryScreen"));
const ProtocolLibrary = lazy(() => import("./pages/ProtocolLibrary"));
const Tribes = lazy(() => import("./pages/Tribes"));
const Squad = lazy(() => import("./pages/Squad"));
const TribeNew = lazy(() => import("./pages/TribeNew"));
const TribeDetail = lazy(() => import("./pages/TribeDetail"));
const TribeBattles = lazy(() => import("./pages/TribeBattles"));
const TribeLeaderboard = lazy(() => import("./pages/TribeLeaderboard"));
const Vault = lazy(() => import("./pages/Vault"));
const Recipes = lazy(() => import("./pages/Recipes"));
const WeeklyBriefing = lazy(() => import("./pages/WeeklyBriefing"));
const AdminModeration = lazy(() => import("./pages/AdminModeration"));
const AdminLegendInvites = lazy(() => import("./pages/AdminLegendInvites"));
const ButtonGallery = lazy(() => import("./pages/ButtonGallery"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tiered freshness: 2 min default so back-navigation within a session
      // reuses cache instead of refetching. Volatile/realtime-backed queries
      // override with a shorter staleTime; static catalogs use a longer one.
      staleTime: 120_000,
      gcTime: 30 * 60_000,
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx (auth/not-found errors)
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

import RouteFallback from "@/components/RouteFallback";

const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
  </div>
);

// Paths reachable WITHOUT an active subscription/trial — the paywall itself,
// onboarding, the Apple username picker, and legal pages — so a gated user can
// still subscribe, finish setup and read terms.
const ACCESS_EXEMPT = new Set([
  "/paywall",
  "/onboarding",
  "/apple-username",
  "/privacy",
  "/terms",
  "/reset-password",
]);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isPremium } = useAuth();
  if (loading) return <LazyFallback />;
  if (!user) return <Navigate to="/landing" replace />;

  const path = window.location.pathname;

  if (isAppleUsernameSelectionPending() && path !== "/apple-username") {
    return <Navigate to="/apple-username" replace />;
  }

  // Read once per render; localStorage is sync but cheap, this just keeps it tidy.
  if (
    !localStorage.getItem("w_onboarding_done") &&
    path !== "/onboarding" &&
    path !== "/apple-username"
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  // Hard paywall: every app function requires an active subscription. The
  // 14-day free trial is Apple's introductory offer — the user confirms payment
  // on the paywall, gets 14 days free, then auto-renews at 4.99 €/mo unless
  // they cancel. isPremium reflects the real entitlement (paid / in Apple trial /
  // referral credits / Founders). Exempt paths let them reach the paywall, finish
  // onboarding and read legal pages.
  if (!isPremium && !ACCESS_EXEMPT.has(path)) {
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
  usePushNotifications();

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
    <div className="max-w-md mx-auto h-[100dvh] flex flex-col relative z-10">
      <StatusHeader />
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* RouteFallback renders a layout-matched skeleton for the destination
            route (HomeSkeleton on /, FeedSkeleton on /feed, etc.) so the lazy-
            load → real-content swap has zero visual jank. LazyFallback (a
            spinner) is kept only as the AccessGate gate while auth resolves. */}
        <Suspense fallback={<RouteFallback />}>
          <AccessGate>
          {/* Route-level ErrorBoundary — keeps the app shell (StatusHeader +
              BottomNav) visible if the current page crashes. The global
              ErrorBoundary at the very root only kicks in for
              shell-level failures. Page crashes get a contained recovery
              UI here so the user can still navigate elsewhere. */}
          <ErrorBoundary>
          <Routes>
          <Route path="/landing" element={user ? <Navigate to="/" replace /> : <Landing />} />
          <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/apple-username" element={<ProtectedRoute><AppleUsername /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/checkin" element={<ProtectedRoute><DailyCheckin /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
          <Route path="/battles" element={<ProtectedRoute><Battles /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/coach" element={<ProtectedRoute><Coach /></ProtectedRoute>} />
          <Route path="/coach/profile" element={<ProtectedRoute><AthleteProfileSettings /></ProtectedRoute>} />
          <Route path="/coach/habits" element={<ProtectedRoute><CoachHabits /></ProtectedRoute>} />
          <Route path="/coach/reflect" element={<ProtectedRoute><CoachReflect /></ProtectedRoute>} />
          <Route path="/coach/goal" element={<ProtectedRoute><CoachGoal /></ProtectedRoute>} />
          <Route path="/coach/progress" element={<ProtectedRoute><CoachProgress /></ProtectedRoute>} />
          <Route path="/coach/program" element={<ProtectedRoute><CoachProgramDetail /></ProtectedRoute>} />
          <Route path="/coach/memory" element={<ProtectedRoute><CoachMemoryScreen /></ProtectedRoute>} />
          <Route path="/coach/library" element={<ProtectedRoute><ProtocolLibrary /></ProtectedRoute>} />
          <Route path="/squad" element={<ProtectedRoute><Squad /></ProtectedRoute>} />
          <Route path="/tribes" element={<ProtectedRoute><Tribes /></ProtectedRoute>} />
          <Route path="/tribes/new" element={<ProtectedRoute><TribeNew /></ProtectedRoute>} />
          <Route path="/tribes/leaderboard" element={<ProtectedRoute><TribeLeaderboard /></ProtectedRoute>} />
          <Route path="/tribes/:id" element={<ProtectedRoute><TribeDetail /></ProtectedRoute>} />
          <Route path="/tribes/:id/battles" element={<ProtectedRoute><TribeBattles /></ProtectedRoute>} />
          <Route path="/vault" element={<ProtectedRoute><Vault /></ProtectedRoute>} />
          <Route path="/recipes" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
          <Route path="/briefing/:id" element={<ProtectedRoute><WeeklyBriefing /></ProtectedRoute>} />
          <Route path="/admin/moderation" element={<ProtectedRoute><AdminModeration /></ProtectedRoute>} />
          <Route path="/admin/legend-invites" element={<ProtectedRoute><AdminLegendInvites /></ProtectedRoute>} />
          <Route path="/button-gallery" element={<ProtectedRoute><ButtonGallery /></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><EliteFeed /></ProtectedRoute>} />
          <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
          <Route path="/paywall" element={<ProtectedRoute><Paywall /></ProtectedRoute>} />
          <Route path="/badges/compare" element={<ProtectedRoute><BadgeCompare /></ProtectedRoute>} />
          <Route path="/user/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
          <Route path="/chat/:partnerId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<TermsOfUse />} />
          <Route path="/ios-debug" element={<IosDebug />} />
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
          </AccessGate>
        </Suspense>
      </div>
      <BottomNav />
      {user && <TierPromotionCelebration />}
    </div>
  );
};

const App = () => {
  // SplashScreen previously rendered for ~1.5s on every cold start before
  // the React tree appeared. The user asked to remove the app-open animation
  // entirely — gone now. iOS native splash (LaunchScreen.storyboard) still
  // covers the brief boot delay on the native shell; the web build just
  // shows the page directly.
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <RevenueCatProvider>
                <AmbientParticles />
                <ErrorBoundary>
                  <AppRoutes />
                </ErrorBoundary>
              </RevenueCatProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
