import { lazy, Suspense, useState, useCallback } from "react";
import SplashScreen from "@/components/SplashScreen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RevenueCatProvider } from "@/contexts/RevenueCatContext";
import WindProvider from "@/contexts/WindProvider";
import AmbientParticles from "@/components/AmbientParticles";
import BottomNav from "@/components/BottomNav";
import StatusHeader from "@/components/StatusHeader";
import AccessGate from "@/components/AccessGate";
import TierPromotionCelebration from "@/components/TierPromotionCelebration";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteFallback from "@/components/RouteFallback";
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
const WeeklyBriefing = lazy(() => import("./pages/WeeklyBriefing"));
const AdminModeration = lazy(() => import("./pages/AdminModeration"));
const Tribes = lazy(() => import("./pages/Tribes"));
const TribeNew = lazy(() => import("./pages/TribeNew"));
const TribeDetail = lazy(() => import("./pages/TribeDetail"));
const TribeBattles = lazy(() => import("./pages/TribeBattles"));
const TribeLeaderboard = lazy(() => import("./pages/TribeLeaderboard"));
const ButtonGallery = lazy(() => import("./pages/ButtonGallery"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Sensible defaults — most reads are gameification data that can be
      // cached briefly to keep the app feeling instant on tab switches.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
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

  return (
    <div className="max-w-md mx-auto h-[100dvh] flex flex-col relative z-10">
      <StatusHeader />
      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={<RouteFallback />}>
          <AccessGate>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
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
                  <Route path="/feed" element={<ProtectedRoute><EliteFeed /></ProtectedRoute>} />
                  <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
                  <Route path="/paywall" element={<ProtectedRoute><Paywall /></ProtectedRoute>} />
                  <Route path="/badges/compare" element={<ProtectedRoute><BadgeCompare /></ProtectedRoute>} />
                  <Route path="/user/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                  <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                  <Route path="/chat/:partnerId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                  <Route path="/coach" element={<ProtectedRoute><Coach /></ProtectedRoute>} />
                  <Route path="/briefing/:id" element={<ProtectedRoute><WeeklyBriefing /></ProtectedRoute>} />
                  <Route path="/admin/moderation" element={<ProtectedRoute><AdminModeration /></ProtectedRoute>} />
                  <Route path="/tribes" element={<ProtectedRoute><Tribes /></ProtectedRoute>} />
                  <Route path="/tribes/leaderboard" element={<ProtectedRoute><TribeLeaderboard /></ProtectedRoute>} />
                  <Route path="/tribes/new" element={<ProtectedRoute><TribeNew /></ProtectedRoute>} />
                  <Route path="/tribes/:id" element={<ProtectedRoute><TribeDetail /></ProtectedRoute>} />
                  <Route path="/tribes/:id/battles" element={<ProtectedRoute><TribeBattles /></ProtectedRoute>} />
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
          </AccessGate>
        </Suspense>
      </div>
      <BottomNav />
      {user && <TierPromotionCelebration />}
    </div>
  );
};

const App = () => {
  const alreadyShown = sessionStorage.getItem("w_splash_shown") === "1";
  const [splashDone, setSplashDone] = useState(alreadyShown);
  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem("w_splash_shown", "1");
    setSplashDone(true);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
          <BrowserRouter>
            <AuthProvider>
              <RevenueCatProvider>
                <WindProvider>
                  {splashDone && <AmbientParticles />}
                  <AppRoutes />
                </WindProvider>
              </RevenueCatProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
