import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Moon, Dumbbell, Snowflake, Apple, Droplets, BookOpen,
  Brain, Smartphone, Camera, ChevronLeft, Zap, Plus,
  TrendingUp, AlertTriangle, Trophy, Crown, ChevronDown
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import BadgeUnlockModal from "@/components/BadgeUnlockModal";
import { checkAndAwardBadges } from "@/lib/badge-awards";
import ConfettiBurst from "@/components/ConfettiBurst";
import XpCounter from "@/components/XpCounter";
import DailyQuests from "@/components/DailyQuests";
import LevelUpCelebration from "@/components/LevelUpCelebration";
import { syncStreakWarningNotification } from "@/lib/streak-notifications";

interface ToggleItemProps {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  active: boolean;
  onToggle: () => void;
  bonus?: string;
}

const ToggleItem = ({ icon: Icon, label, sublabel, active, onToggle, bonus }: ToggleItemProps) => (
  <button
    onClick={onToggle}
    className={cn(
      "flex items-center gap-3 w-full rounded-xl border p-4 transition-all duration-200 text-left active:scale-[0.97]",
      active ? "border-gold/40 bg-gold/5" : "border-border bg-card hover:bg-secondary/50"
    )}
  >
    <div className={cn(
      "flex h-10 w-10 items-center justify-center rounded-lg shrink-0 transition-colors",
      active ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground"
    )}>
      <Icon size={20} />
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn("font-semibold text-base", active && "text-gold")}>{label}</p>
      {sublabel && <p className="text-sm text-muted-foreground">{sublabel}</p>}
    </div>
    {bonus && active && (
      <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">{bonus}</span>
    )}
    <div className={cn(
      "h-5 w-5 rounded-full border-2 transition-all duration-200 shrink-0 flex items-center justify-center",
      active ? "border-gold bg-gold" : "border-muted-foreground/30"
    )}>
      {active && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
    </div>
  </button>
);

const SPORT_CATEGORIES = [
  { id: "none", label: "No workout", xp: 0, emoji: "—" },
  { id: "walk", label: "Walking / Light Cardio", xp: 10, emoji: "🚶" },
  { id: "run", label: "Running / Jogging", xp: 20, emoji: "🏃" },
  { id: "gym", label: "Gym / Weights", xp: 30, emoji: "🏋️" },
  { id: "swim", label: "Swimming", xp: 25, emoji: "🏊" },
  { id: "yoga", label: "Yoga / Stretching", xp: 15, emoji: "🧘" },
  { id: "combat", label: "Thai Boxing / MMA", xp: 35, emoji: "🥊" },
  { id: "hiit", label: "HIIT / CrossFit", xp: 30, emoji: "⚡" },
  { id: "team", label: "Team Sports", xp: 25, emoji: "⚽" },
  { id: "cycling", label: "Cycling", xp: 20, emoji: "🚴" },
  { id: "other", label: "Other Sport", xp: 20, emoji: "🏅" },
];

const DailyCheckin = () => {
  const navigate = useNavigate();
  const { user, refreshProfile, isElite } = useAuth();
  const queryClient = useQueryClient();

  const { data: lastCheckin } = useQuery({
    queryKey: ["last-checkin", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("daily_checkins")
        .select("checked_in_at")
        .eq("user_id", user.id)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Recent sleep history (last 7 days) — used to detect chronic over-sleep
  const { data: recentSleep } = useQuery({
    queryKey: ["recent-sleep-7d", user?.id],
    queryFn: async () => {
      if (!user) return [] as number[];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("daily_checkins")
        .select("sleep_hours")
        .eq("user_id", user.id)
        .gte("checked_in_at", sevenDaysAgo);
      return (data || []).map((d) => Number(d.sleep_hours));
    },
    enabled: !!user,
  });

  const canCheckin = !lastCheckin || (Date.now() - new Date(lastCheckin.checked_in_at).getTime() > 24 * 60 * 60 * 1000);

  const getTimeUntilCheckin = () => {
    if (!lastCheckin || canCheckin) return null;
    const nextTime = new Date(lastCheckin.checked_in_at).getTime() + 24 * 60 * 60 * 1000;
    const diff = nextTime - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const [sleep, setSleep] = useState(8);
  const [sportCategory, setSportCategory] = useState("none");
  const [sportOpen, setSportOpen] = useState(false);
  const [extraWorkout, setExtraWorkout] = useState(false);
  const [coldShower, setColdShower] = useState(false);
  const [healthyFood, setHealthyFood] = useState(false);
  const [protein, setProtein] = useState(false);
  const [meditationAm, setMeditationAm] = useState(false);
  const [meditationPm, setMeditationPm] = useState(false);
  const [hydration, setHydration] = useState(2);
  const [noPhoneAm, setNoPhoneAm] = useState(false);
  const [noPhonePm, setNoPhonePm] = useState(false);
  const [reading, setReading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unlockedBadge, setUnlockedBadge] = useState<any>(null);
  const [honest, setHonest] = useState<boolean | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [questBonusXp, setQuestBonusXp] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevelReached, setNewLevelReached] = useState(0);

  const selectedSport = SPORT_CATEGORIES.find((s) => s.id === sportCategory)!;
  const workout = sportCategory !== "none";

  // Sleep quality logic
  // - 8–9h is optimal
  // - 10–12h is good occasionally, but penalized if chronic (≥3 nights of 10h+ in last 7 days)
  // - 7h is sub-optimal (poor)
  // - <7h is poor / dangerous
  const oversleepCount = (recentSleep || []).filter((h) => h >= 10).length;
  const isChronicOversleep = oversleepCount >= 3;

  const isOptimalSleep =
    (sleep >= 8 && sleep <= 9) ||
    (sleep >= 10 && sleep <= 12 && !isChronicOversleep);

  let sleepMultiplier = 1.0;
  if (sleep >= 8 && sleep <= 9) sleepMultiplier = 1.0;
  else if (sleep >= 10 && sleep <= 12) sleepMultiplier = isChronicOversleep ? 0.6 : 0.95;
  else if (sleep === 7) sleepMultiplier = 0.8;
  else if (sleep === 6) sleepMultiplier = 0.65;
  else if (sleep === 5) sleepMultiplier = 0.5;
  else sleepMultiplier = 0.4; // <5h

  let sleepPenaltyLabel: string | null = null;
  if (sleepMultiplier < 1) {
    const pct = `${Math.round((1 - sleepMultiplier) * 100)}% XP penalty`;
    if (isChronicOversleep && sleep >= 10) sleepPenaltyLabel = `Chronic oversleep — ${pct}`;
    else if (sleep === 7) sleepPenaltyLabel = `Sub-optimal sleep — ${pct}`;
    else if (sleep < 7) sleepPenaltyLabel = `Poor sleep — ${pct}`;
    else sleepPenaltyLabel = pct;
  }

  const proofBonus = isElite && proofFile ? 30 : 0;
  const rawXp = [
    selectedSport.xp,
    extraWorkout && 25,
    coldShower && 30,
    healthyFood && 20,
    protein && 15,
    meditationAm && 15,
    meditationPm && 15,
    noPhoneAm && 20,
    noPhonePm && 20,
    hydration >= 3 && 20,
    isOptimalSleep && 25,
    reading && 20,
    proofBonus,
  ].filter(Boolean).reduce((a: number, b) => a + (b as number), 0);

  const baseXp = Math.round(rawXp * sleepMultiplier);
  const totalXp = (isElite ? baseXp * 2 : baseXp) + questBonusXp;

  // Reactive performance score
  const completedCount = [workout, extraWorkout, coldShower, healthyFood, protein, meditationAm, meditationPm, noPhoneAm, noPhonePm, hydration >= 3, isOptimalSleep, reading].filter(Boolean).length;
  const maxCount = 12;
  const perfPercent = Math.round((completedCount / maxCount) * 100);
  // Sleep quality logic
  // - 8–9h is optimal
  // - 10–12h is good occasionally, but penalized if chronic (≥3 nights of 10h+ in last 7 days)
  // - 7h is sub-optimal (poor)
  // - <7h is poor / dangerous
  const oversleepCount = (recentSleep || []).filter((h) => h >= 10).length;
  const isChronicOversleep = oversleepCount >= 3;

  const isOptimalSleep =
    (sleep >= 8 && sleep <= 9) ||
    (sleep >= 10 && sleep <= 12 && !isChronicOversleep);

  let sleepMultiplier = 1.0;
  if (sleep >= 8 && sleep <= 9) sleepMultiplier = 1.0;
  else if (sleep >= 10 && sleep <= 12) sleepMultiplier = isChronicOversleep ? 0.6 : 0.95;
  else if (sleep === 7) sleepMultiplier = 0.8;
  else if (sleep === 6) sleepMultiplier = 0.65;
  else if (sleep === 5) sleepMultiplier = 0.5;
  else sleepMultiplier = 0.4; // <5h

  let sleepPenaltyLabel: string | null = null;
  if (sleepMultiplier < 1) {
    const pct = `${Math.round((1 - sleepMultiplier) * 100)}% XP penalty`;
    if (isChronicOversleep && sleep >= 10) sleepPenaltyLabel = `Chronic oversleep — ${pct}`;
    else if (sleep === 7) sleepPenaltyLabel = `Sub-optimal sleep — ${pct}`;
    else if (sleep < 7) sleepPenaltyLabel = `Poor sleep — ${pct}`;
    else sleepPenaltyLabel = pct;
  }

  const proofBonus = isElite && proofFile ? 30 : 0;
  const rawXp = [
    selectedSport.xp,
    extraWorkout && 25,
    coldShower && 30,
    healthyFood && 20,
    protein && 15,
    meditationAm && 15,
    meditationPm && 15,
    noPhoneAm && 20,
    noPhonePm && 20,
    hydration >= 3 && 20,
    isOptimalSleep && 25,
    reading && 20,
    proofBonus,
  ].filter(Boolean).reduce((a: number, b) => a + (b as number), 0);

  const baseXp = Math.round(rawXp * sleepMultiplier);
  const totalXp = (isElite ? baseXp * 2 : baseXp) + questBonusXp;

  // Reactive performance score
  const completedCount = [workout, extraWorkout, coldShower, healthyFood, protein, meditationAm, meditationPm, noPhoneAm, noPhonePm, hydration >= 3, isOptimalSleep, reading].filter(Boolean).length;
  const maxCount = 12;
  const perfPercent = Math.round((completedCount / maxCount) * 100);

  const getPerfLabel = () => {
    if (perfPercent >= 70) return { text: "Perfect Day 🔥", color: "text-gold", icon: Trophy, bg: "bg-gold/10 border-gold/30" };
    if (perfPercent >= 50) return { text: "Strong Execution 💪", color: "text-emerald-400", icon: TrendingUp, bg: "bg-emerald-500/10 border-emerald-500/30" };
    if (perfPercent >= 30) return { text: "Decent Day — Push Harder", color: "text-amber-400", icon: TrendingUp, bg: "bg-amber-500/10 border-amber-500/30" };
    return { text: "Low Output — Step Up", color: "text-destructive", icon: AlertTriangle, bg: "bg-destructive/10 border-destructive/30" };
  };

  const perf = getPerfLabel();

  const handleSubmit = async () => {
    if (!user || submitting || !canCheckin || honest !== true) return;
    setSubmitting(true);

    try {
      const checkinTimestamp = new Date().toISOString();

      // Upload proof photo if provided
      let proof_photo_url: string | null = null;
      if (proofFile && isElite) {
        const ext = proofFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("proof-photos").upload(path, proofFile, {
          cacheControl: "3600",
          upsert: false,
        });
        if (uploadErr) throw new Error(`Photo upload failed: ${uploadErr.message}`);
        const { data: urlData } = supabase.storage.from("proof-photos").getPublicUrl(path);
        proof_photo_url = urlData.publicUrl;
      }

      // Insert check-in
      await supabase.from("daily_checkins").insert({
        user_id: user.id,
        checked_in_at: checkinTimestamp,
        sleep_hours: sleep,
        workout,
        extra_workout: extraWorkout,
        cold_shower: coldShower,
        healthy_food: healthyFood,
        protein_intake: protein,
        meditation_morning: meditationAm,
        meditation_evening: meditationPm,
        hydration_liters: hydration,
        no_phone_morning: noPhoneAm,
        no_phone_evening: noPhonePm,
        reading,
        xp_earned: totalXp,
        proof_photo_url,
      });

      // Update profile XP and streak
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        const newXp = profile.xp + totalXp;
        const newLevel = Math.floor(newXp / 500) + 1;

        // Streak logic: reset to 1 if last checkin was more than 48h ago (missed a day)
        const lastCheckinTime = lastCheckin ? new Date(lastCheckin.checked_in_at).getTime() : 0;
        const hoursSinceLastCheckin = lastCheckinTime ? (Date.now() - lastCheckinTime) / (1000 * 60 * 60) : 999;
        const streakBroken = hoursSinceLastCheckin > 48;
        const newStreak = streakBroken ? 1 : profile.streak + 1;
        const longestStreak = Math.max(profile.longest_streak, newStreak);

        // Streak broken warning
        if (streakBroken && profile.streak > 0) {
          toast.error(`💀 Streak lost! Your ${profile.streak}-day streak was reset.`, {
            duration: 5000,
          });
        }

        // Detect level-up
        if (newLevel > profile.level) {
          setNewLevelReached(newLevel);
          setShowLevelUp(true);
        }

        await supabase
          .from("profiles")
          .update({
            xp: newXp,
            level: newLevel,
            streak: newStreak,
            longest_streak: longestStreak,
          })
          .eq("user_id", user.id);

        await syncStreakWarningNotification({
          lastCheckinAt: checkinTimestamp,
          streak: newStreak,
        });

        // Auto-update status tier based on percentile
        await supabase.rpc("update_status_tier", { target_user_id: user.id });

        // Check and award ALL applicable badges (streak, XP, level, checkins, workouts, etc.)
        const newBadge = await checkAndAwardBadges(user.id);
        if (newBadge?.isNew) {
          setUnlockedBadge(newBadge.badge);
        }
      }

      // Elite: auto-post proof photo to feed
      if (isElite && proof_photo_url) {
        const sportLabel = selectedSport.id !== "none" ? `${selectedSport.emoji} ${selectedSport.label}` : null;
        const content = sportLabel
          ? `Daily check-in ✅ ${sportLabel} — ${totalXp} XP earned 🔥`
          : `Daily check-in ✅ — ${totalXp} XP earned 🔥`;
        await supabase.from("feed_posts").insert({
          user_id: user.id,
          content,
          image_url: proof_photo_url,
        });
      }

      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["last-checkin"] });
      queryClient.invalidateQueries({ queryKey: ["user-badges"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  // 24h lock screen
  if (!canCheckin && !submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center pb-4">
        <div className="animate-reveal">
          <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
            <Moon size={36} className="text-muted-foreground" />
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight mb-2">Already Logged Today</h1>
          <p className="text-muted-foreground text-sm mb-2">You can only check in once every 24 hours.</p>
          <p className="text-gold font-display text-lg font-bold mb-8">
            Next check-in in {getTimeUntilCheckin()}
          </p>
          <Button variant="gold-outline" size="lg" onClick={() => navigate("/")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <>
        {showLevelUp && <LevelUpCelebration newLevel={newLevelReached} onComplete={() => setShowLevelUp(false)} />}
        <BadgeUnlockModal badge={unlockedBadge} onClose={() => setUnlockedBadge(null)} />
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
          <ConfettiBurst active={submitted} />

          {/* Radial glow bg */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(circle at 50% 40%, hsl(42 78% 54% / 0.08) 0%, transparent 60%)",
          }} />

          <div className="animate-reveal relative">
            {/* Pulsing ring */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-28 w-28 rounded-full border border-gold/20" style={{
                animation: "badge-ring-expand 2s ease-out infinite",
              }} />
            </div>

            <div className="h-24 w-24 rounded-full gradient-gold flex items-center justify-center glow-gold mx-auto mb-6 relative">
              <Zap size={40} className="text-primary-foreground" />
            </div>

            <h1 className="font-display text-3xl font-black tracking-tight mb-3">Day Logged 🔥</h1>

            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-gold font-display text-5xl font-black glow-gold-text">+</span>
              <XpCounter value={totalXp} className="text-gold font-display text-5xl font-black glow-gold-text" />
            </div>
            <p className="text-sm text-gold/60 font-semibold mb-2">EXPERIENCE EARNED</p>

            <p className="text-muted-foreground text-sm mb-8 max-w-[250px] mx-auto leading-relaxed">
              Your discipline is building. The grind never lies.
            </p>

            <Button variant="gold" size="lg" onClick={() => navigate("/")} className="w-full max-w-[200px]">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen pb-4 px-4 pt-4 safe-top">
      <div className="flex items-center gap-3 mb-6 animate-reveal mx-0 my-[10px] py-[10px]">
        <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-secondary transition-colors active:scale-95">
          <ChevronLeft size={20} />
        </button>
        
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Daily Execution</h1>
          <p className="text-sm text-muted-foreground">Log your day. Earn your status.</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/20">
          {isElite && <span className="text-[10px] font-bold text-gold mr-1">2×</span>}
          <Zap size={14} className="text-gold" />
          <span className="text-sm font-bold text-gold tabular-nums">{totalXp}</span>
          <span className="text-xs text-gold/60">XP</span>
        </div>
      </div>

      {/* Sleep */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-border bg-card p-4 mb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Moon size={20} /></div>
          <div><p className="font-semibold text-sm">Sleep</p><p className="text-xs text-muted-foreground">Optimal: 8–9 hours</p></div>
          <span className={cn("ml-auto text-2xl font-bold font-display tabular-nums", sleep >= 7 && sleep <= 9 ? "text-gold" : sleep <= 5 ? "text-destructive" : "text-muted-foreground")}>{sleep}h {sleep >= 8 && sleep <= 9 ? "🚀" : sleep >= 7 ? "👍" : sleep <= 5 ? "💀" : "😐"}</span>
        </div>
        <input type="range" min={4} max={12} value={sleep} onChange={(e) => setSleep(Number(e.target.value))} className="w-full accent-[hsl(var(--gold))] h-1.5" />
        {sleepPenaltyLabel && (
          <p className="text-[10px] text-destructive mt-1 font-semibold">⚠️ Poor sleep — {sleepPenaltyLabel}</p>
        )}
      </div>

      {/* Hydration */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-border bg-card p-4 mb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400"><Droplets size={20} /></div>
          <div><p className="font-semibold text-sm">Hydration</p><p className="text-xs text-muted-foreground">Target: 3L+</p></div>
          <span className={cn("ml-auto text-2xl font-bold font-display tabular-nums", hydration >= 3 ? "text-gold" : "text-muted-foreground")}>{hydration}L</span>
        </div>
        <input type="range" min={0} max={5} step={0.5} value={hydration} onChange={(e) => setHydration(Number(e.target.value))} className="w-full accent-[hsl(var(--gold))] h-1.5" />
        {sleepPenaltyLabel && (
          <p className="text-[10px] text-destructive mt-1 font-semibold">⚠️ Poor sleep — {sleepPenaltyLabel}</p>
        )}
      </div>

      {/* Sport Category Selector */}
      <div className="animate-reveal animate-reveal-delay-2 mb-2.5">
        <button
          onClick={() => setSportOpen(!sportOpen)}
          className={cn(
            "flex items-center gap-3 w-full rounded-xl border p-4 transition-all duration-200 text-left active:scale-[0.97]",
            workout ? "border-gold/40 bg-gold/5" : "border-border bg-card hover:bg-secondary/50"
          )}
        >
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg shrink-0 transition-colors",
            workout ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground"
          )}>
            <Dumbbell size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("font-semibold text-sm", workout && "text-gold")}>
              {workout ? `${selectedSport.emoji} ${selectedSport.label}` : "Select Workout"}
            </p>
            <p className="text-xs text-muted-foreground">Choose your sport category</p>
          </div>
          {workout && (
            <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">+{selectedSport.xp} XP</span>
          )}
          <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", sportOpen && "rotate-180")} />
        </button>

        {sportOpen && (
          <div className="mt-1 rounded-xl border border-border bg-card overflow-hidden">
            {SPORT_CATEGORIES.filter((s) => s.id !== "none").map((sport) => (
              <button
                key={sport.id}
                onClick={() => {
                  setSportCategory(sport.id);
                  setSportOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 text-left transition-colors border-b border-border last:border-0 active:scale-[0.98]",
                  sportCategory === sport.id ? "bg-gold/5" : "hover:bg-secondary/50"
                )}
              >
                <span className="text-lg w-7 text-center">{sport.emoji}</span>
                <span className="text-sm font-medium flex-1">{sport.label}</span>
                <span className="text-xs font-bold text-gold">+{sport.xp} XP</span>
              </button>
            ))}
            {sportCategory !== "none" && (
              <button
                onClick={() => { setSportCategory("none"); setSportOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-3 text-left text-muted-foreground hover:bg-secondary/50 transition-colors"
              >
                <span className="text-lg w-7 text-center">✗</span>
                <span className="text-sm font-medium">Clear selection</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Other Toggles */}
      <div className="space-y-2.5 animate-reveal animate-reveal-delay-2">
        <ToggleItem icon={Plus} label="Extra Workout" sublabel="Second session today" active={extraWorkout} onToggle={() => setExtraWorkout(!extraWorkout)} bonus="+25 XP" />
        <ToggleItem icon={Snowflake} label="Cold Shower" sublabel="Build mental toughness" active={coldShower} onToggle={() => setColdShower(!coldShower)} bonus="+30 XP" />
        <ToggleItem icon={Apple} label="Healthy Food" sublabel="Clean meals all day" active={healthyFood} onToggle={() => setHealthyFood(!healthyFood)} bonus="+20 XP" />
        <ToggleItem icon={Apple} label="Protein Intake" sublabel="Hit your protein target" active={protein} onToggle={() => setProtein(!protein)} bonus="+15 XP" />
        <ToggleItem icon={Brain} label="Morning Meditation" sublabel="Start the day focused" active={meditationAm} onToggle={() => setMeditationAm(!meditationAm)} bonus="+15 XP" />
        <ToggleItem icon={Brain} label="Evening Meditation" sublabel="Reflect and wind down" active={meditationPm} onToggle={() => setMeditationPm(!meditationPm)} bonus="+15 XP" />
        <ToggleItem icon={Smartphone} label="No Phone After Waking" sublabel="30 min screen-free" active={noPhoneAm} onToggle={() => setNoPhoneAm(!noPhoneAm)} bonus="+20 XP" />
        <ToggleItem icon={Smartphone} label="No Phone Before Sleep" sublabel="30 min screen-free" active={noPhonePm} onToggle={() => setNoPhonePm(!noPhonePm)} bonus="+20 XP" />
        <ToggleItem icon={BookOpen} label="Read / Learn Something New" sublabel="Books, articles, courses" active={reading} onToggle={() => setReading(!reading)} bonus="+20 XP" />
      </div>

      {/* Daily Quests */}
      <div className="mt-4 animate-reveal animate-reveal-delay-3">
        <DailyQuests
          checkinData={{
            sleep,
            sportCategory,
            extraWorkout,
            coldShower,
            healthyFood,
            protein,
            meditationAm,
            meditationPm,
            hydration,
            noPhoneAm,
            noPhonePm,
            reading,
            completedCount,
          }}
          onBonusXpChange={setQuestBonusXp}
        />
      </div>

      {/* Proof Photo — Elite only */}
      <div className="mt-4 animate-reveal animate-reveal-delay-3">
        {isElite ? (
          <div>
            <label className="flex items-center gap-3 w-full rounded-xl border border-dashed border-gold/30 p-4 hover:bg-gold/5 transition-colors active:scale-[0.97] cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold"><Camera size={20} /></div>
              <div className="text-left flex-1">
                <p className="font-semibold text-sm">Upload Proof Photo</p>
                <p className="text-xs text-muted-foreground">Elite perk — earns <span className="text-gold font-bold">+30 bonus XP</span></p>
              </div>
              {proofFile && <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">+30 XP</span>}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fileAge = Date.now() - file.lastModified;
                if (fileAge > 5 * 60 * 1000) {
                  toast.error("Please take a fresh photo right now. Gallery photos are not allowed.");
                  e.target.value = "";
                  return;
                }
                setProofFile(file);
                const reader = new FileReader();
                reader.onload = () => setProofPreview(reader.result as string);
                reader.readAsDataURL(file);
              }} />
            </label>
            {proofPreview && (
              <div className="relative mt-2 rounded-xl overflow-hidden">
                <img src={proofPreview} alt="Proof" className="w-full max-h-40 object-cover rounded-xl" />
                <button
                  onClick={() => { setProofFile(null); setProofPreview(null); }}
                  className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80 transition-colors"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 w-full rounded-xl border border-dashed border-border p-4 opacity-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Camera size={20} /></div>
            <div className="text-left">
              <p className="font-semibold text-sm">Upload Proof Photo</p>
              <p className="text-xs text-muted-foreground">Elite feature — unlock to use</p>
            </div>
            <Crown size={16} className="ml-auto text-gold" />
          </div>
        )}
      </div>

      {/* Performance Score */}
      <div className="mt-4 animate-reveal animate-reveal-delay-3">
        <div className={cn("rounded-xl border p-4 transition-all duration-300", perf.bg)}>
          <div className="flex items-center gap-3 mb-2">
            <perf.icon size={20} className={perf.color} />
            <p className={cn("font-display font-bold text-sm", perf.color)}>{perf.text}</p>
            <span className={cn("ml-auto font-display font-black text-lg tabular-nums", perf.color)}>{perfPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500",
                perfPercent === 100 ? "bg-gold" : perfPercent >= 80 ? "bg-emerald-400" : perfPercent >= 50 ? "bg-amber-400" : "bg-destructive"
              )}
              style={{ width: `${perfPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">{completedCount}/{maxCount} tasks completed</p>
        </div>
      </div>

      {/* Honesty check */}
      <div className="mt-4 animate-reveal animate-reveal-delay-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-semibold text-sm mb-3">Were you honest? 🤝</p>
          <p className="text-xs text-muted-foreground mb-3">Answer truthfully — you can't grind with lies.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setHonest(true)}
              className={cn(
                "flex-1 rounded-xl border p-3 text-sm font-bold transition-all active:scale-[0.97]",
                honest === true
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              Yes ✅
            </button>
            <button
              onClick={() => setHonest(false)}
              className={cn(
                "flex-1 rounded-xl border p-3 text-sm font-bold transition-all active:scale-[0.97]",
                honest === false
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              No ❌
            </button>
          </div>
          {honest === false && (
            <p className="text-xs text-destructive mt-2">Be honest with yourself. Go back and fix your answers.</p>
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="mt-6 animate-reveal animate-reveal-delay-4">
        <Button variant="gold" size="xl" className="w-full" onClick={handleSubmit} disabled={submitting || honest !== true}>
          <Zap size={20} />
          {submitting ? "Submitting..." : `Submit Day — Earn ${totalXp} XP`}
        </Button>
      </div>
    </div>
  );
};

export default DailyCheckin;
