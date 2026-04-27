import { lazy, Suspense, useMemo } from "react";
import { Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { matchTabKey } from "@/components/TabHost";
import RouteFallback from "@/components/RouteFallback";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import OAuthCallback from "@/pages/OAuthCallback";
import NotFound from "@/pages/NotFound";

/**
 * Modal & push route stack — sits ON TOP of the persistent TabHost.
 *
 * When a tab path is active, this returns null (tabs render uncovered).
 * When a non-tab path is active (e.g. /tribes/:id, /chat/:id, /paywall),
 * the matching screen slides in over the last-visited tab.
 *
 *   • push routes (detail screens) translate-in from the right (260 ms)
 *   • modal routes (paywall, briefing, onboarding) slide up from the bottom (300 ms)
 *   • on POP, exit reverses direction
 *
 * Behind the modal, the tab underneath remains fully mounted and
 * interactive (well — the modal blocks pointer events with a backdrop),
 * giving a true native iOS push feel.
 */

const Paywall = lazy(() => import("@/pages/Paywall"));
const BadgeCompare = lazy(() => import("@/pages/BadgeCompare"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const Chat = lazy(() => import("@/pages/Chat"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("@/pages/TermsOfUse"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const IosDebug = lazy(() => import("@/pages/IosDebug"));
const AppleAuthLaunch = lazy(() => import("@/pages/AppleAuthLaunch"));
const AppleUsername = lazy(() => import("@/pages/AppleUsername"));
const PublicProfile = lazy(() => import("@/pages/PublicProfile"));
const Coach = lazy(() => import("@/pages/Coach"));
const WeeklyBriefing = lazy(() => import("@/pages/WeeklyBriefing"));
const AdminModeration = lazy(() => import("@/pages/AdminModeration"));
const TribeNew = lazy(() => import("@/pages/TribeNew"));
const TribeDetail = lazy(() => import("@/pages/TribeDetail"));
const TribeBattles = lazy(() => import("@/pages/TribeBattles"));
const TribeLeaderboard = lazy(() => import("@/pages/TribeLeaderboard"));
const ButtonGallery = lazy(() => import("@/pages/ButtonGallery"));
const Referrals = lazy(() => import("@/pages/Referrals"));

type Tier = "push" | "modal" | "fullscreen";

const MODAL_PREFIXES = [
  "/paywall",
  "/briefing/",
  "/onboarding",
  "/apple-username",
];

const FULLSCREEN_PATHS = new Set([
  "/landing",
  "/auth",
  "/reset-password",
  "/privacy",
  "/terms",
  "/ios-debug",
  "/apple-auth-launch",
]);

const inferTier = (path: string): Tier => {
  if (FULLSCREEN_PATHS.has(path) || path.startsWith("/oauth") ||
      path.startsWith("/callback") || path.startsWith("/~oauth") ||
      path.startsWith("/auth/")) {
    return "fullscreen";
  }
  if (MODAL_PREFIXES.some((p) => path.startsWith(p))) return "modal";
  return "push";
};

const variants = {
  push: {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
    transition: { duration: 0.26, ease: [0.32, 0.72, 0, 1] as const },
  },
  pop: {
    initial: { x: 0 },
    animate: { x: 0 },
    exit: { x: "100%" },
    transition: { duration: 0.24, ease: [0.32, 0.72, 0, 1] as const },
  },
  modal: {
    initial: { y: "100%" },
    animate: { y: 0 },
    exit: { y: "100%" },
    transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] as const },
  },
  fullscreen: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.18, ease: [0.32, 0.72, 0, 1] as const },
  },
};

const ModalStack = () => {
  const location = useLocation();
  const navType = useNavigationType();

  // If the current route is a tab, render nothing — TabHost handles it.
  const isTab = matchTabKey(location.pathname) !== null;
  const tier = useMemo(() => inferTier(location.pathname), [location.pathname]);

  // Choose variant. POP of push reverses direction; modal POP also slides
  // back down.
  const v =
    tier === "push" && navType === "POP"
      ? variants.pop
      : variants[tier];

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {!isTab && (
        <motion.div
          key={location.pathname}
          initial={v.initial}
          animate={v.animate}
          exit={v.exit}
          transition={v.transition}
          className="absolute inset-0 z-30 bg-background"
          style={{
            // GPU-only transforms; no opacity flicker on iOS Safari.
            willChange: "transform",
            // Prevent body scroll bleed-through; modal owns its own scroll.
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <Suspense fallback={<RouteFallback />}>
            <Routes location={location}>
              {/* Fullscreen (auth flow / legal) */}
              <Route path="/landing" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
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

              {/* Modal sheets */}
              <Route path="/paywall" element={<Paywall />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/apple-username" element={<AppleUsername />} />
              <Route path="/briefing/:id" element={<WeeklyBriefing />} />

              {/* Push detail screens */}
              <Route path="/badges/compare" element={<BadgeCompare />} />
              <Route path="/user/:userId" element={<UserProfile />} />
              <Route path="/chat/:partnerId" element={<Chat />} />
              <Route path="/coach" element={<Coach />} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/admin/moderation" element={<AdminModeration />} />
              <Route path="/tribes/new" element={<TribeNew />} />
              <Route path="/tribes/leaderboard" element={<TribeLeaderboard />} />
              <Route path="/tribes/:id" element={<TribeDetail />} />
              <Route path="/tribes/:id/battles" element={<TribeBattles />} />
              <Route path="/button-gallery" element={<ButtonGallery />} />
              <Route path="/u/:username" element={<PublicProfile />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ModalStack;
