import { Suspense, useState, useCallback, useEffect } from "react";
import SplashScreen from "@/components/SplashScreen";
import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { BrowserRouter, useLocation, Navigate } from "react-router-dom";
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
import TabHost, { matchTabKey } from "@/components/TabHost";
import ModalStack from "@/components/ModalStack";
import { isAppleUsernameSelectionPending } from "@/lib/apple-username";
import { preloadAppRoutes } from "@/lib/route-preload";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tuned for a gameification app where most reads are cosmetic state.
      // Per-query overrides can still tighten this where freshness matters.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
      retry: 1,
      // CRITICAL for native feel: keep showing the previous data while the
      // next page worth fetches in the background. No blank flashes, ever.
      placeholderData: keepPreviousData,
    },
  },
});

// Heavy ambient particle field — skip on routes that already have rich
// per-screen visual effects so iOS Safari doesn't fight two GPU canvases.
const HEAVY_VISUAL_ROUTES = [
  "/paywall", "/tribes", "/battles", "/briefing", "/feed", "/coach",
];
const AmbientParticlesGate = () => {
  const { pathname } = useLocation();
  const skip = HEAVY_VISUAL_ROUTES.some((r) => pathname.startsWith(r));
  if (skip) return null;
  return <AmbientParticles />;
};

/**
 * Auth-level gate: handles login/onboarding/apple-username redirects.
 * Returns either the children, a <Navigate>, or a fallback.
 *
 * Unlike the old <ProtectedRoute> wrapper-per-route pattern, we evaluate
 * once at the layout level so the persistent tab tree never tears down.
 */
const AuthFlowGate = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // While auth is resolving, show the route fallback (a tier-shaped skeleton)
  // — never a blank screen.
  if (loading) return <RouteFallback />;

  const path = location.pathname;
  const isPublic =
    path === "/landing" ||
    path === "/auth" ||
    path === "/reset-password" ||
    path === "/privacy" ||
    path === "/terms" ||
    path === "/ios-debug" ||
    path === "/apple-auth-launch" ||
    path.startsWith("/oauth") ||
    path.startsWith("/~oauth") ||
    path.startsWith("/callback") ||
    path.startsWith("/auth/") ||
    path.startsWith("/u/");

  if (!user) {
    if (isPublic) return <>{children}</>;
    return <Navigate to="/landing" replace />;
  }

  // Logged-in flows
  if (isAppleUsernameSelectionPending() && path !== "/apple-username") {
    return <Navigate to="/apple-username" replace />;
  }

  if (
    !localStorage.getItem("w_onboarding_done") &&
    path !== "/onboarding" &&
    path !== "/apple-username" &&
    !isPublic
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

const HIDDEN_HEADER_PATHS = new Set([
  "/landing",
  "/auth",
  "/onboarding",
  "/apple-username",
  "/apple-auth-launch",
  "/paywall",
  "/reset-password",
  "/privacy",
  "/terms",
  "/ios-debug",
]);
const isFullscreenPath = (p: string) =>
  HIDDEN_HEADER_PATHS.has(p) ||
  p.startsWith("/oauth") ||
  p.startsWith("/~oauth") ||
  p.startsWith("/callback") ||
  p.startsWith("/auth/") ||
  p.startsWith("/u/") ||
  p.startsWith("/chat/");

const AppShell = () => {
  const { user } = useAuth();
  const location = useLocation();
  usePushNotifications();

  const fullscreen = isFullscreenPath(location.pathname);

  return (
    <div className="max-w-md mx-auto h-[100dvh] flex flex-col relative z-10 overflow-hidden">
      {/* Status header is hidden on auth/landing/paywall — same logic as before */}
      {!fullscreen && <StatusHeader />}

      {/* Tab + modal layers share this stack. TabHost is always mounted
          underneath; ModalStack floats over for non-tab routes. */}
      <div
        className="flex-1 relative overflow-hidden"
        style={{ contain: "layout paint" }}
      >
        <AccessGate>
          <AuthFlowGate>
            <TabHost />
            <ModalStack />
          </AuthFlowGate>
        </AccessGate>
      </div>

      {/* Bottom nav hides on auth/landing/onboarding/paywall (its own list). */}
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

  // Kick off background route preloading once the splash is dismissed.
  // This makes subsequent navigation effectively instant (no Suspense flash).
  useEffect(() => {
    if (splashDone) preloadAppRoutes();
  }, [splashDone]);

  // When the native shell resumes from background, refresh hot caches.
  useEffect(() => {
    const onResume = () => {
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["messages"] }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["profile"] }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["streak"] }).catch(() => {});
    };
    window.addEventListener("native:resume", onResume);
    return () => window.removeEventListener("native:resume", onResume);
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
                  {splashDone && <AmbientParticlesGate />}
                  <AppShell />
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
