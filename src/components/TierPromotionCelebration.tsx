import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sparkles, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTierConfig, TIER_ORDER, StatusTier } from "@/lib/status-tiers";
import { useAuth } from "@/contexts/AuthContext";
import StoryShareModal from "@/components/StoryShareModal";
import ConfettiBurst from "@/components/ConfettiBurst";
import { triggerHaptic } from "@/lib/haptics";

const STORAGE_KEY = "w_last_tier_seen";

const tierRank = (t: string) => TIER_ORDER.indexOf(t as StatusTier);

const TierPromotionCelebration = () => {
  const { profile, user } = useAuth();
  const [showCelebration, setShowCelebration] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [previousTier, setPreviousTier] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.status_tier || !user?.id) return;
    const currentTier = profile.status_tier;
    const stored = localStorage.getItem(`${STORAGE_KEY}_${user.id}`);

    // First time we see this user — just store, don't celebrate
    if (!stored) {
      localStorage.setItem(`${STORAGE_KEY}_${user.id}`, currentTier);
      return;
    }

    // Promotion detected
    if (stored !== currentTier && tierRank(currentTier) > tierRank(stored)) {
      setPreviousTier(stored);
      setShowCelebration(true);
      triggerHaptic("success");
      localStorage.setItem(`${STORAGE_KEY}_${user.id}`, currentTier);
    } else if (stored !== currentTier) {
      // Demotion or sideways — silently update
      localStorage.setItem(`${STORAGE_KEY}_${user.id}`, currentTier);
    }
  }, [profile?.status_tier, user?.id]);

  if (!profile) return null;
  const tier = profile.status_tier || 'recruit';
  const config = getTierConfig(tier);
  const isLegend = tier === 'legend';
  const isApex = tier === 'apex';
  const isElite = tier === 'elite';

  const heroGradient = isLegend
    ? "linear-gradient(160deg, hsl(280 70% 18% / 0.95), hsl(255 14% 5% / 0.98), hsl(350 60% 14% / 0.95))"
    : isApex
    ? "linear-gradient(160deg, hsl(18 80% 18% / 0.95), hsl(255 14% 5% / 0.98))"
    : isElite
    ? "linear-gradient(160deg, hsl(42 70% 16% / 0.95), hsl(255 14% 5% / 0.98))"
    : "linear-gradient(160deg, hsl(255 14% 12% / 0.95), hsl(255 14% 5% / 0.98))";

  return (
    <>
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-6"
            style={{ background: heroGradient, backdropFilter: "blur(20px)" }}
          >
            <ConfettiBurst trigger={showCelebration} />

            <button
              onClick={() => setShowCelebration(false)}
              className="absolute top-6 right-6 p-2 rounded-full bg-secondary/60 hover:bg-secondary"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <div className="text-center max-w-sm">
              <motion.p
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-[11px] font-black tracking-[0.4em] text-gold/80 uppercase mb-3"
              >
                Status Promotion
              </motion.p>

              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 180, damping: 14 }}
                className="text-7xl mb-3"
                style={{
                  filter: isLegend
                    ? "drop-shadow(0 0 30px hsl(280 70% 60% / 0.6))"
                    : isApex
                    ? "drop-shadow(0 0 30px hsl(18 95% 58% / 0.6))"
                    : "drop-shadow(0 0 24px hsl(var(--gold) / 0.5))",
                }}
              >
                {config.emoji}
              </motion.div>

              {previousTier && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center justify-center gap-2 mb-2 text-xs text-muted-foreground"
                >
                  <span className="line-through opacity-50">{getTierConfig(previousTier).label}</span>
                  <span>→</span>
                </motion.div>
              )}

              <motion.h1
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className={cn(
                  "font-display text-4xl font-black tracking-tight mb-2",
                  config.textClass,
                )}
              >
                {config.label}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-sm text-foreground/80 mb-1"
              >
                {config.message}
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-xs text-muted-foreground mb-6"
              >
                You're now in the <span className="font-bold text-foreground">{config.percentile}</span>
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="space-y-2"
              >
                <Button
                  variant="gold"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setShareOpen(true);
                    triggerHaptic("light");
                  }}
                >
                  <Share2 size={16} />
                  Share to Stories
                  <Sparkles size={14} className="opacity-70" />
                </Button>
                <button
                  onClick={() => setShowCelebration(false)}
                  className="text-[11px] text-muted-foreground/60 font-semibold tracking-wider uppercase hover:text-foreground transition-colors py-2 w-full"
                >
                  Continue
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <StoryShareModal
        open={shareOpen}
        onClose={() => {
          setShareOpen(false);
          setShowCelebration(false);
        }}
        variant="stats"
      />
    </>
  );
};

export default TierPromotionCelebration;
