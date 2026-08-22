import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { canonicalTier } from "@/lib/status-tiers";
import { cn } from "@/lib/utils";
import { Crown, Clock } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

const HIDDEN_ROUTES = new Set([
  "/landing",
  "/auth",
  "/onboarding",
  "/apple-username",
  "/choose-username",
  "/apple-auth-launch",
  "/paywall",
  "/reset-password",
  "/privacy",
  "/terms",
  "/ios-debug",
  // Check-in is a focused full-screen flow with its own header/back.
  "/checkin",
]);

/**
 * The sticky brand strip — the same on every tab. Identity lives on Profile,
 * standing lives in Home's numbers row and on Ranks; the header no longer
 * repeats avatar · name · streak · tier · percentile above them (two identity
 * rows in the first 120px was the #1 "what am I looking at" complaint).
 * Only the trial pill survives here — it's the one time-sensitive fact.
 */
const StatusHeader = () => {
  const { user, profile, isElite } = useAuth();
  const { isInTrial, daysRemaining, hoursRemaining } = useTrialAccess();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user || !profile) return null;
  if (HIDDEN_ROUTES.has(location.pathname)) return null;
  if (
    location.pathname.startsWith("/oauth") ||
    location.pathname.startsWith("/callback") ||
    location.pathname.startsWith("/~oauth") ||
    location.pathname.startsWith("/u/")
  )
    return null;

  const tier = canonicalTier(profile.status_tier);
  const isApex = tier === "apex";
  const streak = profile.streak || 0;

  // The trial is full access, not a countdown to doom — only the last day is
  // flagged as time-sensitive.
  const trialUrgent = isInTrial && !isElite && daysRemaining <= 1;
  const trialLabel =
    daysRemaining > 1 ? `${daysRemaining}d` : hoursRemaining > 1 ? `${hoursRemaining}h` : "Last hours";

  return (
    <header className="sticky top-0 z-40 safe-top">
      <div className="relative bg-[hsl(var(--background)/0.97)] hairline-bottom border-x-0 border-t-0 border-b-0 rounded-none">
        {/* Top hairline shimmer — flame-tinted for Apex */}
        <div className={cn(
          "pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          isApex ? "via-[hsl(var(--ember))]/70" : "via-gold/55",
        )} />

        {/* Bottom rim — only when the user is hot (streak ≥ 7) */}
        {streak >= 7 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 bottom-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${
                isApex ? "hsl(var(--ember) / 0.85)"
                : tier === "legend" ? "hsl(280 70% 60% / 0.8)"
                : tier === "elite" ? "hsl(var(--gold) / 0.8)"
                : "hsl(18 92% 56% / 0.7)"
              } 50%, transparent 100%)`,
              animation: "flame-rim-pulse 4.5s ease-in-out infinite",
            }}
          />
        )}

        <div className="relative flex items-center px-3 pt-2 pb-2">
          {/* Brand — centered */}
          <button
            onClick={() => navigate("/")}
            className="mx-auto flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
            aria-label="Whealth Factory — Home"
          >
            <BrandLogo size={26} alt="" className="rounded-md shadow-[0_2px_8px_hsl(var(--gold)/0.5)]" />
            <span className="font-display font-black tracking-[0.22em] uppercase text-gradient-gold leading-none text-base">
              Whealth Factory
            </span>
          </button>

          {/* Trial pill — compact, right-aligned, absolute so the brand stays centered */}
          {isInTrial && !isElite && (
            <button
              onClick={() => navigate("/paywall")}
              aria-label="Free trial — full access. Tap to see membership."
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-full border transition-colors active:scale-[0.96]",
                trialUrgent
                  ? "bg-destructive/12 border-destructive/45 text-destructive"
                  : "bg-gold/10 border-gold/35 text-gold",
              )}
            >
              {trialUrgent ? <Clock size={10} /> : <Crown size={10} />}
              <span className="text-[10px] font-bold uppercase tracking-wider tabular-nums">{trialLabel}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default StatusHeader;
