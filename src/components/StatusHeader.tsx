import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { getTierConfig } from "@/lib/status-tiers";
import StatusAvatar from "@/components/StatusAvatar";
import { cn } from "@/lib/utils";
import { Crown, Clock } from "lucide-react";
import { motion } from "framer-motion";

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

const StatusHeader = () => {
  const { user, profile, isElite } = useAuth();
  const { isInTrial, daysRemaining, hoursRemaining } = useTrialAccess();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user || !profile) return null;
  if (HIDDEN_ROUTES.has(location.pathname)) return null;
  if (location.pathname.startsWith("/oauth") || location.pathname.startsWith("/callback") || location.pathname.startsWith("/~oauth")) return null;

  const tier = profile.status_tier || "recruit";
  const config = getTierConfig(tier);

  const trialLabel = daysRemaining > 1
    ? `${daysRemaining}d left`
    : hoursRemaining > 1
    ? `${hoursRemaining}h left`
    : "Last hours";

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/40 safe-top">
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 min-w-0 active:opacity-70 transition-opacity"
        >
          <StatusAvatar
            src={profile.avatar_url}
            name={profile.username}
            tier={tier}
            size="sm"
          />
          <div className="text-left min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
              Status
            </p>
            <p className={cn("text-xs font-black truncate leading-tight", config.textClass)}>
              {config.label}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {isElite ? (
            <motion.button
              onClick={() => navigate("/paywall")}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold/10 border border-gold/30"
              whileTap={{ scale: 0.95 }}
            >
              <Crown size={11} className="text-gold" />
              <span className="text-[10px] font-bold text-gold uppercase tracking-wider">Elite</span>
            </motion.button>
          ) : isInTrial ? (
            <motion.button
              onClick={() => navigate("/paywall")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
                daysRemaining <= 2
                  ? "bg-destructive/10 border-destructive/40 text-destructive"
                  : "bg-secondary/60 border-border text-foreground",
              )}
              whileTap={{ scale: 0.95 }}
              animate={daysRemaining <= 2 ? { scale: [1, 1.04, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Clock size={11} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {trialLabel}
              </span>
            </motion.button>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default StatusHeader;
