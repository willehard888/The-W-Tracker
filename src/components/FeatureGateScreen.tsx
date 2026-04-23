import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Crown, Lock, Trophy, Flame, Swords, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTierConfig, TIER_ORDER, type StatusTier } from "@/lib/status-tiers";
import { motion, AnimatePresence } from "framer-motion";

interface FeatureGateScreenProps {
  /** The minimum tier required to access this feature */
  requiredTier: StatusTier;
  /** Current user's tier */
  currentTier: StatusTier;
  /** Feature name */
  featureName: string;
  /** Feature description */
  description: string;
  /** Icon to show */
  icon?: React.ElementType;
  /** If true, shows paywall CTA instead of tier progression */
  requiresElite?: boolean;
}

const FeatureGateScreen = ({
  requiredTier,
  currentTier,
  featureName,
  description,
  icon: FeatureIcon = Lock,
  requiresElite = false,
}: FeatureGateScreenProps) => {
  const navigate = useNavigate();
  const requiredConfig = getTierConfig(requiredTier);
  const currentConfig = getTierConfig(currentTier);

  const currentRank = currentConfig.rank;
  const requiredRank = requiredConfig.rank;
  const progress = requiredRank > 0 ? Math.min(100, Math.round((currentRank / requiredRank) * 100)) : 0;

  return (
    <div className="min-h-screen pb-4 px-4 pt-6 flex flex-col items-center justify-center text-center safe-top relative overflow-hidden">
      {/* Animated background glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        style={{
          background: `radial-gradient(ellipse at center, hsl(42 78% 54% / 0.08) 0%, transparent 70%)`,
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-gold/30"
            initial={{ opacity: 0, y: 100 }}
            animate={{
              opacity: [0, 0.6, 0],
              y: [-20, -200],
              x: [0, (i % 2 === 0 ? 1 : -1) * 30],
            }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.8,
              ease: "easeOut",
            }}
            style={{ left: `${15 + i * 14}%`, bottom: "10%" }}
          />
        ))}
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.6, bounce: 0.3 }}
        className="relative z-10"
      >
        {/* Lock icon with pulse */}
        <motion.div
          className="h-20 w-20 rounded-full bg-secondary/80 border border-border flex items-center justify-center mx-auto mb-5 relative"
          animate={{ boxShadow: ["0 0 0px hsl(42 78% 54% / 0)", "0 0 30px hsl(42 78% 54% / 0.15)", "0 0 0px hsl(42 78% 54% / 0)"] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Lock size={32} className="text-gold" />
          <motion.div
            className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-gold flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <Sparkles size={12} className="text-primary-foreground" />
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.h1
          className="font-display text-2xl font-black tracking-tight mb-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          {featureName}
        </motion.h1>

        <motion.p
          className="text-sm text-muted-foreground mb-6 max-w-[280px] mx-auto"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          {description}
        </motion.p>

        {/* Tier requirement card */}
        <motion.div
          className="rounded-xl border border-gold/20 bg-card p-4 mb-5 max-w-[300px] mx-auto"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Unlock requirement</p>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{currentConfig.emoji}</span>
              <div className="text-left">
                <p className="text-xs font-bold">{currentConfig.label}</p>
                <p className="text-[10px] text-muted-foreground">Current</p>
              </div>
            </div>

            <motion.div
              className="flex items-center gap-1"
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <TrendingUp size={14} className="text-gold" />
            </motion.div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs font-bold text-gold">{requiredConfig.label}</p>
                <p className="text-[10px] text-muted-foreground">Required</p>
              </div>
              <span className="text-lg">{requiredConfig.emoji}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full rounded-full gradient-gold"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(5, progress)}%` }}
              transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">{progress}% to {requiredConfig.label}</p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="space-y-3"
        >
          {requiresElite ? (
            <Button variant="coal" size="lg" onClick={() => navigate("/profile")} className="breathing-glow">
              <Crown size={16} />
              Earn Your Elite Status
            </Button>
          ) : (
            <Button variant="ember" size="lg" onClick={() => navigate("/checkin")} className="breathing-glow">
              <Flame size={16} />
              Check In to Level Up
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground">
            {requiresElite
              ? "Elite is earned, not bought — top 5% + 14 active days + 30-day streak"
              : `Reach ${requiredConfig.label} status to unlock this feature`}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default FeatureGateScreen;
