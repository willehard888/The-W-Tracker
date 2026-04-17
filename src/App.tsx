import { lazy, Suspense, useState, useCallback } from "react";
import SplashScreen from "@/components/SplashScreen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePushNotifications } from "@/hooks/use-push-notifications";
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

const queryClient = new QueryClient();

const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LazyFallback />;
  if (!user) return <Navigate to="/landing" replace />;

  if (isAppleUsernameSelectionPending() && window.location.pathname !== "/apple-username") {
    return <Navigate to="/apple-username" replace />;
  }

  const onboardingDone = localStorage.getItem("w_onboarding_done");
  if (!onboardingDone && window.location.pathname !== "/onboarding" && window.location.pathname !== "/apple-username") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user } = useAuth();
  usePushNotifications();

  return (
    <div className="max-w-md mx-auto h-[100dvh] flex flex-col relative z-10">
      <StatusHeader />
      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={<LazyFallback />}>
          <AccessGate>
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
          <Route path="/feed" element={<ProtectedRoute><EliteFeed /></ProtectedRoute>} />
          <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
          <Route path="/paywall" element={<ProtectedRoute><Paywall /></ProtectedRoute>} />
          <Route path="/badges/compare" element={<ProtectedRoute><BadgeCompare /></ProtectedRoute>} />
          <Route path="/user/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/chat/:partnerId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
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
          </AccessGate>
        </Suspense>
      </div>
      <StatusStripe />
      <BottomNav />
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
        <BrowserRouter>
          <AuthProvider>
            <RevenueCatProvider>
              <AmbientParticles />
              <AppRoutes />
            </RevenueCatProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
