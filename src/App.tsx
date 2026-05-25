import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
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
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";

// Tab routes don't slide — they cross-fade (subtle, doesn't pick a side).
// Detail / modal routes slide from right like an iOS native push.
const TAB_PATHS = new Set([
  "/", "/checkin", "/feed", "/tribes",
  "/messages", "/leaderboard", "/battles", "/profile",
]);

const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
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

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user } = useAuth();
  const location = useLocation();
  usePushNotifications();

  // iOS-style page transitions:
  //  - Tab pages cross-fade (subtle, neutral direction)
  //  - Detail pages slide from the right like a native push
  // Spring curve matches iOS UINavigationController push animation.
  const isTab = TAB_PATHS.has(location.pathname);
  const variants = isTab
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit:    { opacity: 0 },
        transition: { duration: 0.18, ease: [0.32, 0.72, 0, 1] as const },
      }
    : {
        initial: { x: 28, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit:    { x: -28, opacity: 0 },
        transition: { duration: 0.26, ease: [0.32, 0.72, 0, 1] as const },
      };

  return (
    <div className="max-w-md mx-auto h-[100dvh] flex flex-col relative z-10">
      <StatusHeader />
      <div className="flex-1 overflow-y-auto">
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
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={variants.initial}
              animate={variants.animate}
              exit={variants.exit}
              transition={variants.transition}
              className="h-full"
              style={{ willChange: "transform, opacity" }}
            >
              <Routes location={location}>
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
          <Route path="/tribes" element={<ProtectedRoute><Tribes /></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><EliteFeed /></ProtectedRoute>} />
          <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
          <Route path="/paywall" element={<ProtectedRoute><Paywall /></ProtectedRoute>} />
          <Route path="/badges/compare" element={<ProtectedRoute><BadgeCompare /></ProtectedRoute>} />
          <Route path="/user/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
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
            </motion.div>
          </AnimatePresence>
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
