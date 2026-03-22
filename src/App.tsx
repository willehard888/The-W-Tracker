import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RevenueCatProvider } from "@/contexts/RevenueCatContext";
import BottomNav from "@/components/BottomNav";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import DailyCheckin from "./pages/DailyCheckin";
import Leaderboard from "./pages/Leaderboard";
import Battles from "./pages/Battles";
import Profile from "./pages/Profile";
import EliteFeed from "./pages/EliteFeed";
import Referrals from "./pages/Referrals";
import Paywall from "./pages/Paywall";
import BadgeCompare from "./pages/BadgeCompare";
import UserProfile from "./pages/UserProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" /></div>;
  if (!user) return <Navigate to="/landing" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user } = useAuth();
  usePushNotifications();

  return (
    <div className="max-w-md mx-auto min-h-screen relative">
      <Routes>
        <Route path="/landing" element={user ? <Navigate to="/" replace /> : <Landing />} />
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
        <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
        <Route path="/checkin" element={<ProtectedRoute><DailyCheckin /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
        <Route path="/battles" element={<ProtectedRoute><Battles /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/feed" element={<ProtectedRoute><EliteFeed /></ProtectedRoute>} />
        <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
        <Route path="/paywall" element={<ProtectedRoute><Paywall /></ProtectedRoute>} />
        <Route path="/badges/compare" element={<ProtectedRoute><BadgeCompare /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav />
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RevenueCatProvider>
            <AppRoutes />
          </RevenueCatProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
