import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { getTierConfig, getNextTier } from "@/lib/status-tiers";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

const HIDDEN_ROUTES = new Set([
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

/**
 * Thin status stripe shown above BottomNav. Reinforces the user's tier
 * and shows the next milestone or trial deadline.
 */
const StatusStripe = () => {
  const { user, profile, isElite } = useAuth();
  const { isInTrial, daysRemaining } = useTrialAccess();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user || !profile) return null;
  if (HIDDEN_ROUTES.has(location.pathname)) return null;

  const tier = profile.status_tier || "recruit";
  const config = getTierConfig(tier);
  const next = getNextTier(tier);

  const message = isInTrial && !isElite && daysRemaining <= 3
    ? `Trial ends in ${daysRemaining}d — keep your ${config.label} status`
    : next
    ? `Next: ${next.label}`
    : "Top of the hierarchy";

  return (
    <button
      onClick={() => navigate("/leaderboard")}
      className={cn(
        "shrink-0 w-full flex items-center justify-between gap-2 px-4 py-1.5 border-t border-border/40 backdrop-blur-md bg-background/60 active:bg-secondary/40 transition-colors",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.bgClass.replace("/5", ""), config.textClass)} 
              style={{ backgroundColor: "currentColor" }} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
          {config.percentile} · <span className={cn("font-bold", config.textClass)}>{message}</span>
        </span>
      </div>
      <ChevronRight size={12} className="text-muted-foreground shrink-0" />
    </button>
  );
};

export default StatusStripe;
