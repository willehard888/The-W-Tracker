import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Moon, Dumbbell, Droplets, Camera, Zap,
  TrendingUp, AlertTriangle, Trophy, ChevronDown, Check,
  SlidersHorizontal, ShieldCheck, Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { downscaleImage } from "@/lib/downscale-image";
import MediaPreview from "@/components/media/MediaPreview";
import { track, FUNNEL } from "@/lib/analytics";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import BadgeUnlockModal from "@/components/BadgeUnlockModal";
import { checkAndAwardBadges } from "@/lib/badge-awards";
import ConfettiBurst from "@/components/ConfettiBurst";
import DailyQuests from "@/components/DailyQuests";
import LevelUpCelebration from "@/components/LevelUpCelebration";
import { syncStreakWarningNotification } from "@/lib/streak-notifications";
import { useModeration } from "@/hooks/use-moderation";
import ModerationGate from "@/components/ModerationGate";
import { hapticImpact, hapticNotification, hapticSelection } from "@/lib/haptics";
import { triggerGust } from "@/lib/wind";
import CheckinTierHeader from "@/components/CheckinTierHeader";
import CheckinTierSummary from "@/components/CheckinTierSummary";
import { useHealthKit } from "@/hooks/use-healthkit";
import { queueCheckin, isNetworkError } from "@/lib/offline-checkin";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useCheckinConfig } from "@/hooks/use-checkin-config";
import CheckinHabitPicker from "@/components/checkin/CheckinHabitPicker";
import {
  resolveCheckinHabits, PILLAR_LABEL, OPTIONAL_XP_CAP, type CheckinPillar, type CheckinHabit,
  type VerifySignal,
} from "@/lib/checkin-habits";

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

const PILLAR_ORDER: CheckinPillar[] = [
  "sleep", "movement", "nutrition", "mind", "recovery", "connection",
];

// A single evidence-based habit rendered as an emoji toggle, with an optional
// "Detected ✓" badge when Apple Health confirms it.
const HabitToggle = ({
  habit, active, onToggle, detected,
}: { habit: CheckinHabit; active: boolean; onToggle: () => void; detected?: boolean }) => (
  <button
    onClick={() => { hapticSelection(); onToggle(); }}
    className={cn(
      "flex items-center gap-3 w-full rounded-xl border p-3.5 transition-all duration-200 text-left active:scale-[0.98]",
      active ? "border-gold/40 bg-gold/5" : "border-border bg-card hover:bg-secondary/50",
    )}
  >
    <span className="text-xl w-8 text-center shrink-0">{habit.emoji}</span>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <p className={cn("font-semibold text-[15px]", active && "text-gold")}>{habit.label}</p>
        {detected && (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-teal bg-teal/10 px-1.5 py-0.5 rounded-full">
            <ShieldCheck size={10} /> Detected
          </span>
        )}
      </div>
      {habit.note && <p className="text-[11px] text-muted-foreground leading-snug line-clamp-1">{habit.note}</p>}
    </div>
    {active && <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full shrink-0">+{habit.xp}</span>}
    <div className={cn(
      "h-5 w-5 rounded-full border-2 transition-all duration-200 shrink-0 flex items-center justify-center",
      active ? "border-gold bg-gold" : "border-muted-foreground/30",
    )}>
      {active && <Check size={12} className="text-primary-foreground" strokeWidth={3} />}
    </div>
  </button>
);

const DailyCheckin = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  // The user's personalized habit selection (or the classic default set).
  const { keys: habitKeys, save: saveHabits, saving: savingHabits } = useCheckinConfig();
  const chosenHabits = useMemo(() => resolveCheckinHabits(habitKeys), [habitKeys]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: lastCheckin } = useQuery({
    queryKey: ["last-checkin", user?.id],
    staleTime: 0,
    gcTime:    30 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("daily_checkins")
        .select("checked_in_at")
        .eq("user_id", user.id)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: recentSleep } = useQuery({
    queryKey: ["recent-sleep-7d", user?.id],
    staleTime: 10 * 60_000,
    gcTime:    30 * 60_000,
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

  // Reactive local-day tracking. The check-in window is per LOCAL calendar day,
  // but `new Date()` is only read at render — so if the webview stays alive across
  // midnight (or the app resumes on a new day) with no re-render, the lock would
  // wrongly persist and the check-in never re-opens. Track today's local date in
  // state and re-sync it on tick / tab focus / native resume so the screen unlocks
  // the moment the day rolls over.
  const [todayStr, setTodayStr] = useState(() => new Date().toDateString());
  useEffect(() => {
    let cancelled = false;
    const sync = () => setTodayStr((prev) => {
      const d = new Date().toDateString();
      return prev === d ? prev : d;
    });
    const interval = setInterval(sync, 30_000); // catch midnight within ~30s
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    let removeResume: (() => void) | undefined;
    // Capacitor fires "resume" when the native app returns to the foreground —
    // the reliable signal on iOS, where window focus/visibility can be flaky.
    import("@capacitor/app")
      .then(({ App: CapApp }) => {
        if (cancelled) return;
        CapApp.addListener("resume", sync).then((h) => { removeResume = () => h.remove(); });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      removeResume?.();
    };
  }, []);

  const canCheckin = !lastCheckin ||
    new Date(lastCheckin.checked_in_at).toDateString() !== todayStr;

  const getTimeUntilCheckin = () => {
    if (canCheckin) return null;
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    const diff = tomorrow.getTime() - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  // ── Core state ──────────────────────────────────────────────────────────
  const [sleep, setSleep] = useState(8);
  const [sportCategory, setSportCategory] = useState("none");
  const [sportOpen, setSportOpen] = useState(false);
  const [hydration, setHydration] = useState(2);
  // All boolean habits keyed by habit.key.
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // When the local day rolls over, clear yesterday's celebration + refetch the
  // last check-in so a mounted screen resets to a fresh check-in for the new day.
  const prevDayRef = useRef(todayStr);
  useEffect(() => {
    if (prevDayRef.current === todayStr) return;
    prevDayRef.current = todayStr;
    setSubmitted(false);
    queryClient.invalidateQueries({ queryKey: ["last-checkin", user?.id] });
  }, [todayStr, queryClient, user?.id]);

  const healthKit = useHealthKit();
  // Apple Health auto-detected signals for today (workout / steps / sleep / mindful).
  const [detected, setDetected] = useState<Partial<Record<VerifySignal, boolean>>>({});
  const [detectedWorkoutMin, setDetectedWorkoutMin] = useState<number | null>(null);
  const sleepPrefilled = useRef(false);
  const stepsPrefilled = useRef(false);

  const [unlockedBadge, setUnlockedBadge] = useState<any>(null);
  const [honest, setHonest] = useState<boolean | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [questBonusXp, setQuestBonusXp] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevelReached, setNewLevelReached] = useState(0);
  const [summary, setSummary] = useState<{
    xpEarned: number; newTotalXp: number; oldLevel: number; newLevel: number;
    xpToNextLevel: number; levelProgressPct: number; newStreak: number;
    streakBroken: boolean; completedCount: number; maxCount: number;
  } | null>(null);
  const moderation = useModeration();

  const selectedSport = SPORT_CATEGORIES.find((s) => s.id === sportCategory) ?? SPORT_CATEGORIES[0];
  const workout = sportCategory !== "none";

  // ── Apple Health auto-detect (billion-dollar verification) ──────────────
  // On open, pull today's HealthKit snapshot to confirm what actually happened
  // and prefill / flag verifiable habits. Fully fail-open, iOS-only.
  useEffect(() => {
    if (!healthKit.available) return;
    let alive = true;
    healthKit.syncToday().then((snap) => {
      if (!alive || !snap) return;
      const workoutDone = (snap.workout_count ?? 0) >= 1 || (snap.workout_minutes ?? 0) >= 15;
      const stepsDone = (snap.steps ?? 0) >= 8000;
      const mindDone = (snap.mindful_minutes ?? 0) > 0;
      const sleepKnown = snap.sleep_hours != null && snap.sleep_hours > 0;
      setDetected({ workout: workoutDone, steps: stepsDone, mindfulness: mindDone, sleep: sleepKnown });
      if (snap.workout_minutes) setDetectedWorkoutMin(snap.workout_minutes);
      // Prefill sleep slider from HealthKit once (user can still adjust).
      if (sleepKnown && !sleepPrefilled.current) {
        sleepPrefilled.current = true;
        setSleep(Math.min(12, Math.max(4, Math.round((snap.sleep_hours as number) * 2) / 2)));
      }
      // Auto-mark the 8k-steps habit if it's confirmed (only surfaces if chosen).
      if (stepsDone && !stepsPrefilled.current) {
        stepsPrefilled.current = true;
        setCompleted((c) => ({ ...c, steps_8k: true }));
      }
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healthKit.available]);

  // Is a verifiable habit backed by a live Health signal right now?
  const isDetected = (h: CheckinHabit): boolean => {
    if (!h.verify) return false;
    if (h.verify === "workout") return !!detected.workout;
    if (h.verify === "steps") return !!detected.steps;
    if (h.verify === "sleep") return !!detected.sleep;
    if (h.verify === "mindfulness") return !!detected.mindfulness;
    return false;
  };

  const { isOptimalSleep, isChronicOversleep, oversleepCount, sleepMultiplier, sleepPenaltyLabel } = useMemo(() => {
    const oversleepCount = (recentSleep || []).filter((h) => h >= 10).length;
    const chronic = oversleepCount >= 3;
    const optimal = (sleep >= 7.5 && sleep <= 9) || (sleep > 9 && sleep <= 12 && !chronic);
    let multiplier = 1.0;
    if (sleep >= 7.5 && sleep <= 9) multiplier = 1.0;
    else if (sleep > 9 && sleep <= 12) multiplier = chronic ? 0.6 : 0.95;
    else if (sleep >= 7 && sleep < 7.5) multiplier = 0.8;
    else if (sleep >= 6 && sleep < 7) multiplier = 0.65;
    else if (sleep >= 5 && sleep < 6) multiplier = 0.5;
    else multiplier = 0.4;
    let penalty: string | null = null;
    if (multiplier < 1) {
      const pct = `${Math.round((1 - multiplier) * 100)}% XP penalty`;
      if (chronic && sleep > 9) penalty = `Chronic oversleep — ${pct}`;
      else if (sleep >= 7 && sleep < 7.5) penalty = `Sub-optimal sleep — ${pct}`;
      else if (sleep < 7) penalty = `Poor sleep — ${pct}`;
      else penalty = pct;
    }
    return { isOptimalSleep: optimal, isChronicOversleep: chronic, oversleepCount, sleepMultiplier: multiplier, sleepPenaltyLabel: penalty };
  }, [sleep, recentSleep]);

  const done = (key: string) => !!completed[key];
  const toggle = (key: string) => setCompleted((c) => ({ ...c, [key]: !c[key] }));

  // Is a given chosen habit "done" (for XP + completion counting)?
  const habitDone = (h: CheckinHabit): boolean => {
    if (h.key === "sleep") return isOptimalSleep;
    if (h.key === "workout") return workout;
    if (h.key === "hydration") return hydration >= 3;
    return done(h.key);
  };
  const habitXp = (h: CheckinHabit): number => {
    if (h.key === "workout") return workout ? selectedSport.xp : 0;
    return habitDone(h) ? h.xp : 0;
  };

  // Proof photo is available to everyone (all app users are paid members) and
  // earns the same bonus for all.
  const proofBonus = proofFile ? 30 : 0;
  // Anti-cheat scoring: core habits (sleep, workout, water, meditation) earn their
  // full value; self-chosen habits together add at most OPTIONAL_XP_CAP, so stacking
  // many optional habits can't inflate the score. The server enforces the same cap.
  // XP is identical for everyone — it does NOT depend on membership. "Elite" is an
  // EARNED status tier (profile.status_tier), not a paid tier, so it grants no XP edge.
  let coreXp = 0, optionalXpRaw = 0;
  for (const h of chosenHabits) {
    const xp = habitXp(h);
    if (h.core) coreXp += xp; else optionalXpRaw += xp;
  }
  const optionalXp = Math.min(optionalXpRaw, OPTIONAL_XP_CAP);
  const rawXp = coreXp + optionalXp + proofBonus;
  const baseXp = Math.round(rawXp * sleepMultiplier);
  const totalXp = baseXp + questBonusXp;

  const completedCount = chosenHabits.filter(habitDone).length;
  const maxCount = chosenHabits.length;
  const perfPercent = maxCount ? Math.round((completedCount / maxCount) * 100) : 0;

  const getPerfLabel = () => {
    if (perfPercent >= 70) return { text: "Perfect Day 🔥", color: "text-gold", icon: Trophy, bg: "bg-gold/10 border-gold/30" };
    if (perfPercent >= 50) return { text: "Strong Execution 💪", color: "text-emerald-400", icon: TrendingUp, bg: "bg-emerald-500/10 border-emerald-500/30" };
    if (perfPercent >= 30) return { text: "Decent Day — Push Harder", color: "text-amber-400", icon: TrendingUp, bg: "bg-amber-500/10 border-amber-500/30" };
    return { text: "Low Output — Step Up", color: "text-destructive", icon: AlertTriangle, bg: "bg-destructive/10 border-destructive/30" };
  };
  const perf = getPerfLabel();

  // Habits grouped by pillar, excluding the ones with custom widgets
  // (sleep / workout / hydration render as sliders + sport picker).
  const CUSTOM = new Set(["sleep", "workout", "hydration"]);
  const groupedHabits = useMemo(() => {
    const map = new Map<CheckinPillar, CheckinHabit[]>();
    for (const h of chosenHabits) {
      if (CUSTOM.has(h.key)) continue;
      const arr = map.get(h.pillar) ?? [];
      arr.push(h);
      map.set(h.pillar, arr);
    }
    return map;
  }, [chosenHabits]);

  const hasHydration = chosenHabits.some((h) => h.key === "hydration");

  const handleSubmit = async () => {
    if (!user || submitting || !canCheckin || honest !== true) return;
    hapticImpact("medium");
    setSubmitting(true);

    try {
      const checkinTimestamp = new Date().toISOString();

      let proof_photo_url: string | null = null;
      if (proofFile) {
        const outcome = await moderation.moderateImage({ file: proofFile, kind: "proof" });
        if (outcome.blocked) {
          toast.error(outcome.friendlyMessage ?? "Proof rejected");
          setSubmitting(false);
          return;
        }
        const upload = await downscaleImage(proofFile, { maxDim: 1280, quality: 0.8 });
        const ext = upload.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("proof-photos").upload(path, upload, {
          cacheControl: "3600", upsert: false, contentType: upload.type,
        });
        if (uploadErr) throw new Error(`Photo upload failed: ${uploadErr.message}`);
        const { data: urlData } = supabase.storage.from("proof-photos").getPublicUrl(path);
        proof_photo_url = urlData.publicUrl;
      }

      // Build the jsonb of completions for personalized habits that don't map
      // to a legacy column (new evidence-based habits). Column-backed habits
      // still go through the dedicated params below for backward-compat.
      const habitsJson: Record<string, boolean> = {};
      for (const h of chosenHabits) {
        if (h.core || h.column) continue;
        if (habitDone(h)) habitsJson[h.key] = true;
      }

      const tzOffsetMinutes = new Date().getTimezoneOffset();
      const rpcArgs = {
        p_sleep_hours: sleep,
        p_workout: workout,
        p_extra_workout: done("extra_workout"),
        p_cold_shower: done("cold_shower"),
        p_healthy_food: done("healthy_food"),
        p_protein_intake: done("protein"),
        p_meditation_morning: done("meditation"),
        p_meditation_evening: done("meditation_pm"),
        p_hydration_liters: hydration,
        p_no_phone_morning: done("no_phone_am"),
        p_no_phone_evening: done("no_phone_pm"),
        p_reading: done("reading"),
        p_xp_earned: totalXp,
        p_proof_photo_url: proof_photo_url,
        p_journal_entry: done("journaling") ? "logged" : null,
        p_tz_offset_minutes: tzOffsetMinutes,
        p_habits: habitsJson,
      };

      let result: unknown = null;
      let rpcError: { message?: string } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const resp = await supabase.rpc("record_checkin", rpcArgs as any);
        result = resp.data;
        rpcError = resp.error;
        if (!rpcError) break;
        if (rpcError.message?.includes("ALREADY_CHECKED_IN_TODAY")) break;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          await supabase.auth.getSession().catch(() => {});
        }
      }

      if (rpcError) {
        if (rpcError.message?.includes("ALREADY_CHECKED_IN_TODAY")) {
          toast.error("You've already checked in today. Come back tomorrow 💪");
          queryClient.invalidateQueries({ queryKey: ["last-checkin"] });
          hapticNotification("error");
        } else if (isNetworkError(rpcError)) {
          queueCheckin(rpcArgs as any);
          hapticNotification("success");
          toast.success("Saved offline 📶", {
            description: "No connection right now — we'll log this check-in automatically when you're back online.",
            duration: 6000,
          });
        } else {
          console.error("record_checkin failed after retries:", rpcError);
          toast.error("Couldn't save your check-in — check your connection and try again.", {
            description: rpcError.message ? `Details: ${rpcError.message}` : undefined,
            duration: 6000,
          });
          hapticNotification("error");
        }
        setSubmitting(false);
        return;
      }

      const r = result as {
        checkin_id: string; xp_earned: number; new_xp: number; old_level: number;
        new_level: number; old_streak: number; new_streak: number; streak_broken: boolean;
      };
      const newCheckinId = r.checkin_id;

      if (r.new_level > r.old_level) { setNewLevelReached(r.new_level); setShowLevelUp(true); }
      if (r.streak_broken && r.old_streak > 0) {
        toast.error(`💀 Streak lost! Your ${r.old_streak}-day streak was reset.`, { duration: 5000 });
      }

      const xpIntoLevel = r.new_xp - (r.new_level - 1) * 500;
      setSummary({
        xpEarned: r.xp_earned, newTotalXp: r.new_xp, oldLevel: r.old_level, newLevel: r.new_level,
        xpToNextLevel: 500 - xpIntoLevel, levelProgressPct: Math.round((xpIntoLevel / 500) * 100),
        newStreak: r.new_streak, streakBroken: r.streak_broken && r.old_streak > 0,
        completedCount, maxCount,
      });

      setSubmitted(true);
      setSubmitting(false);
      try { hapticNotification("success"); triggerGust(0.95); } catch { /* cosmetic */ }

      // HealthKit verification — fire-and-forget. Awards the bonus XP + badge.
      if (newCheckinId && healthKit.available) {
        healthKit.syncToday().then(async () => {
          try {
            const vr = await healthKit.verifyCheckin(newCheckinId);
            if (vr.verified) {
              void track(FUNNEL.checkinVerified);
              const n = Object.keys(vr.signals ?? {}).filter((k) => (vr.signals as any)[k]?.matched).length;
              toast.success("Verified ✓", {
                description: `Apple Health confirmed ${n} habit${n === 1 ? "" : "s"} — bonus XP added.`,
                duration: 4500,
              });
            }
          } catch (err) { console.warn("verify_checkin failed", err); }
        }).catch((err) => console.warn("HK sync failed", err));
      }

      void (async () => {
        try { await syncStreakWarningNotification({ lastCheckinAt: checkinTimestamp, streak: r.new_streak }); } catch (e) { console.warn("streak notif", e); }
        try { await supabase.rpc("update_status_tier", { target_user_id: user.id }); } catch (e) { console.warn("tier update", e); }
        try {
          const newBadge = await checkAndAwardBadges(user.id);
          if (newBadge?.isNew) setUnlockedBadge(newBadge.badge);
        } catch (e) { console.warn("badge award", e); }
        try {
          const { count: tribeCount } = await supabase
            .from("tribe_members")
            .select("tribe_id", { count: "exact", head: true })
            .eq("user_id", user.id).eq("status", "active");
          if ((tribeCount ?? 0) > 0) {
            const flameMsg = (tribeCount ?? 0) === 1 ? "Your tribe felt it 🔥" : `Your ${tribeCount} tribes felt it 🔥`;
            toast.success(flameMsg, { description: `+1 day → collective fire just grew`, duration: 4500 });
          }
        } catch { /* non-critical */ }
        try {
          if (proof_photo_url) {
            const sportLabel = selectedSport.id !== "none" ? `${selectedSport.emoji} ${selectedSport.label}` : null;
            const content = sportLabel
              ? `Daily check-in ✅ ${sportLabel} — ${totalXp} XP earned 🔥`
              : `Daily check-in ✅ — ${totalXp} XP earned 🔥`;
            await supabase.from("feed_posts").insert({ user_id: user.id, content, image_url: proof_photo_url });
          }
        } catch (e) { console.warn("feed post", e); }
        try { await refreshProfile(); } catch (e) { console.warn("refresh profile", e); }
        queryClient.invalidateQueries({ queryKey: ["last-checkin"] });
        queryClient.invalidateQueries({ queryKey: ["user-badges"] });
        queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      })();

      return;
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong saving your check-in. Please try again.", { duration: 5000 });
      hapticNotification("error");
    }
    setSubmitting(false);
  };

  // Daily lock screen
  if (!canCheckin && !submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center pb-4">
        <div className="animate-reveal">
          <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
            <Moon size={36} className="text-muted-foreground" />
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight mb-2">Already Logged Today</h1>
          <p className="text-muted-foreground text-sm mb-2">You can only check in once per day.</p>
          <p className="text-gold font-display text-lg font-bold mb-8">Next check-in in {getTimeUntilCheckin()}</p>
          <Button variant="gold-outline" size="lg" onClick={() => navigate("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <ErrorBoundary
        fallback={
          <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
            <div className="h-20 w-20 rounded-full bg-[hsl(152_68%_46%)]/15 flex items-center justify-center mx-auto mb-5">
              <Check size={40} className="text-[hsl(152_68%_46%)]" />
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight mb-2">Checked in ✓</h1>
            <p className="text-muted-foreground text-sm mb-8">Your day is locked in. Nice work.</p>
            <Button variant="gold" size="lg" onClick={() => navigate("/")}>Back to Dashboard</Button>
          </div>
        }
      >
        {showLevelUp && <LevelUpCelebration newLevel={newLevelReached} onComplete={() => setShowLevelUp(false)} />}
        <BadgeUnlockModal badge={unlockedBadge} onClose={() => setUnlockedBadge(null)} />
        <ConfettiBurst active={submitted} />
        {summary && (
          <CheckinTierSummary
            tier={profile?.status_tier ?? "recruit"}
            summary={summary}
            onProfile={() => navigate("/profile")}
            onDashboard={() => navigate("/")}
          />
        )}
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen pb-4 px-4 pt-0">
      <ModerationGate
        state={moderation.state}
        message={moderation.message}
        thumbnailUrl={proofPreview}
        onCancel={moderation.cancel}
        onDismiss={moderation.reset}
      />
      <CheckinTierHeader
        tier={profile?.status_tier ?? "recruit"}
        division={(profile as any)?.tier_division ?? 0}
        username={profile?.username}
        streak={profile?.streak ?? 0}
        totalXp={totalXp}
        completedCount={completedCount}
        maxCount={maxCount}
        onBack={() => navigate("/")}
      />

      <CheckinHabitPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedKeys={habitKeys}
        onSave={saveHabits}
        saving={savingHabits}
      />

      {/* Edit-habits CTA */}
      <div className="mt-3 mb-4 flex items-center justify-between gap-2">
        <p className="text-[11px] font-black tracking-[0.16em] uppercase text-gold/80">Your daily standard</p>
        <button
          onClick={() => { hapticSelection(); setPickerOpen(true); }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-gold transition-colors rounded-lg border border-border px-2.5 py-1.5 active:scale-95"
        >
          <SlidersHorizontal size={13} /> Edit habits
        </button>
      </div>

      {healthKit.available && (detected.workout || detected.steps || detected.mindfulness || detected.sleep) && (
        <div className="mb-4 rounded-xl border border-teal/30 bg-teal/5 p-3 flex items-start gap-2.5">
          <ShieldCheck size={18} className="text-teal shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/90 leading-snug">
            <span className="font-semibold text-teal">Apple Health synced.</span>{" "}
            {[
              detected.workout && `a ${detectedWorkoutMin ?? ""}${detectedWorkoutMin ? "-min " : ""}workout`,
              detected.steps && "8k+ steps",
              detected.mindfulness && "meditation",
              detected.sleep && "your sleep",
            ].filter(Boolean).join(", ")} detected — verified habits earn bonus XP.
          </p>
        </div>
      )}

      {/* ── Sleep (core) ── */}
      <div className="rounded-xl border border-border bg-card p-4 mb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Moon size={20} /></div>
          <div>
            <p className="font-semibold text-sm flex items-center gap-1.5">
              Sleep {detected.sleep && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-teal bg-teal/10 px-1.5 py-0.5 rounded-full"><ShieldCheck size={10} /> Health</span>}
            </p>
            <p className="text-xs text-muted-foreground">Optimal: 7.5–9 hours</p>
          </div>
          <span className={cn(
            "ml-auto text-2xl font-bold font-display tabular-nums",
            isOptimalSleep ? "text-gold" : sleep <= 5 ? "text-destructive" : "text-muted-foreground",
          )}>
            {sleep}h {sleep >= 7.5 && sleep <= 9 ? "🚀" : (sleep > 9 && sleep <= 12 && !isChronicOversleep) ? "✨" : sleep >= 7 && sleep < 7.5 ? "😐" : sleep <= 5 ? "💀" : sleep > 9 ? "😴" : "⚠️"}
          </span>
        </div>
        <input type="range" min={4} max={12} step={0.5} value={sleep} onChange={(e) => setSleep(Number(e.target.value))} className="w-full accent-[hsl(var(--gold))] h-1.5" />
        {sleepPenaltyLabel && <p className="text-[10px] text-destructive mt-1 font-semibold">⚠️ {sleepPenaltyLabel}</p>}
        {isChronicOversleep && sleep >= 10 && (
          <p className="text-[10px] text-muted-foreground mt-1">You've slept 10h+ {oversleepCount} of the last 7 nights — occasional long nights help, chronic oversleep hurts.</p>
        )}
      </div>

      {/* ── Workout (core) ── */}
      <div className="mb-3">
        <button
          onClick={() => setSportOpen(!sportOpen)}
          className={cn(
            "flex items-center gap-3 w-full rounded-xl border p-4 transition-all duration-200 text-left active:scale-[0.97]",
            workout ? "border-gold/40 bg-gold/5" : "border-border bg-card hover:bg-secondary/50",
          )}
        >
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg shrink-0 transition-colors",
            workout ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground",
          )}>
            <Dumbbell size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("font-semibold text-sm flex items-center gap-1.5", workout && "text-gold")}>
              {workout ? `${selectedSport.emoji} ${selectedSport.label}` : "Select Workout"}
              {detected.workout && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-teal bg-teal/10 px-1.5 py-0.5 rounded-full"><ShieldCheck size={10} /> Detected</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {detected.workout && !workout ? "Health saw a workout — pick your sport" : "Choose your sport category"}
            </p>
          </div>
          {workout && <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">+{selectedSport.xp} XP</span>}
          <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", sportOpen && "rotate-180")} />
        </button>
        {sportOpen && (
          <div className="mt-1 rounded-xl border border-border bg-card overflow-hidden">
            {SPORT_CATEGORIES.filter((s) => s.id !== "none").map((sport) => (
              <button
                key={sport.id}
                onClick={() => { setSportCategory(sport.id); setSportOpen(false); }}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 text-left transition-colors border-b border-border last:border-0 active:scale-[0.98]",
                  sportCategory === sport.id ? "bg-gold/5" : "hover:bg-secondary/50",
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

      {/* ── Hydration (optional core metric) ── */}
      {hasHydration && (
        <div className="rounded-xl border border-border bg-card p-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal/10 text-teal"><Droplets size={20} /></div>
            <div><p className="font-semibold text-sm">Hydration</p><p className="text-xs text-muted-foreground">Target: 3L+</p></div>
            <span className={cn("ml-auto text-2xl font-bold font-display tabular-nums", hydration >= 3 ? "text-gold" : "text-muted-foreground")}>{hydration}L</span>
          </div>
          <input type="range" min={0} max={5} step={0.5} value={hydration} onChange={(e) => setHydration(Number(e.target.value))} className="w-full accent-[hsl(var(--gold))] h-1.5" />
        </div>
      )}

      {/* ── Personalized habit groups ── */}
      {PILLAR_ORDER.map((pillar) => {
        const habits = groupedHabits.get(pillar);
        if (!habits?.length) return null;
        return (
          <div key={pillar} className="mb-4">
            <p className="mb-2 text-[11px] font-black tracking-[0.16em] uppercase text-muted-foreground/70">{PILLAR_LABEL[pillar]}</p>
            <div className="space-y-2">
              {habits.map((h) => (
                <HabitToggle key={h.key} habit={h} active={done(h.key)} onToggle={() => toggle(h.key)} detected={isDetected(h)} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Daily Quests */}
      <div className="mt-2 mb-4">
        <DailyQuests
          checkinData={{
            sleep,
            sportCategory,
            extraWorkout: done("extra_workout"),
            coldShower: done("cold_shower"),
            healthyFood: done("healthy_food"),
            protein: done("protein"),
            meditationAm: done("meditation"),
            meditationPm: done("meditation_pm"),
            hydration,
            noPhoneAm: done("no_phone_am"),
            noPhonePm: done("no_phone_pm"),
            reading: done("reading"),
            completedCount,
          }}
          onBonusXpChange={setQuestBonusXp}
        />
      </div>

      {/* Proof Photo — available to everyone (all app users are paid) */}
      <div className="mb-4">
        <label className="flex items-center gap-3 w-full rounded-xl border border-dashed border-gold/30 p-4 hover:bg-gold/5 transition-colors active:scale-[0.97] cursor-pointer">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold"><Camera size={20} /></div>
          <div className="text-left flex-1">
            <p className="font-semibold text-sm">Upload Proof Photo</p>
            <p className="text-xs text-muted-foreground">Earns <span className="text-gold font-bold">+30 bonus XP</span></p>
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
            hapticSelection();
            setProofFile(file);
            const reader = new FileReader();
            reader.onload = () => setProofPreview(reader.result as string);
            reader.readAsDataURL(file);
          }} />
        </label>
        {proofPreview && (
          <MediaPreview imageSrc={proofPreview} sizeBytes={proofFile?.size} onClear={() => { setProofFile(null); setProofPreview(null); }} />
        )}
      </div>

      {/* Performance score */}
      <div className="mb-4">
        <div className={cn("rounded-xl border p-4 transition-all duration-300", perf.bg)}>
          <div className="flex items-center gap-3 mb-2">
            <perf.icon size={20} className={perf.color} />
            <p className={cn("font-display font-bold text-sm", perf.color)}>{perf.text}</p>
            <span className={cn("ml-auto font-display font-black text-lg tabular-nums", perf.color)}>{perfPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500",
                perfPercent === 100 ? "bg-gold" : perfPercent >= 80 ? "bg-teal" : perfPercent >= 50 ? "bg-amber" : "bg-destructive")}
              style={{ width: `${perfPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">{completedCount}/{maxCount} habits completed</p>
        </div>
      </div>

      {/* Honesty check */}
      <div className="mb-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-semibold text-sm mb-3">Were you honest? 🤝</p>
          <p className="text-xs text-muted-foreground mb-3">Answer truthfully — you can't grind with lies.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setHonest(true)}
              className={cn(
                "flex-1 rounded-xl border p-3 text-sm font-bold transition-all active:scale-[0.97]",
                honest === true ? "border-gold/40 bg-gold/10 text-gold" : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80",
              )}
            >Yes ✅</button>
            <button
              onClick={() => setHonest(false)}
              className={cn(
                "flex-1 rounded-xl border p-3 text-sm font-bold transition-all active:scale-[0.97]",
                honest === false ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80",
              )}
            >No ❌</button>
          </div>
          {honest === false && <p className="text-xs text-destructive mt-2">Be honest with yourself. Go back and fix your answers.</p>}
        </div>
      </div>

      {/* Submit */}
      <div className="mt-6">
        <Button variant="ember" size="xl" className="w-full" onClick={handleSubmit} disabled={submitting || honest !== true}>
          <Zap size={20} />
          {submitting ? "Submitting..." : `Submit Day — Earn ${totalXp} XP`}
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1">
          <Sparkles size={12} className="text-gold" /> {maxCount} habits · your personal standard
        </p>
      </div>
    </div>
  );
};

export default DailyCheckin;
