import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Moon, Dumbbell, Droplets, Camera, Zap,
  ChevronDown, Check, Plus,
  SlidersHorizontal, ShieldCheck, Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { captureException } from "@/lib/observability";
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
import { useCheckinDay } from "@/hooks/use-checkin-day";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";
import CheckinHabitPicker from "@/components/checkin/CheckinHabitPicker";
import {
  resolveCheckinHabits, PILLAR_LABEL, type CheckinPillar, type CheckinHabit,
  type VerifySignal,
} from "@/lib/checkin-habits";
import { assessSleep, isHabitDone, computeCheckinXp } from "@/lib/checkin-xp";

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
      "group relative flex items-center gap-3 w-full rounded-2xl border p-3 text-left transition-all duration-200 active:scale-[0.985]",
      active
        ? "border-gold/45 bg-gradient-to-r from-gold/[0.12] to-gold/[0.04] shadow-[0_0_0_1px_hsl(var(--gold)/0.15),0_4px_14px_-6px_hsl(var(--gold)/0.35)]"
        : "border-border bg-card hover:bg-secondary/50",
    )}
  >
    {/* Emoji tile */}
    <span className={cn(
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[22px] transition-colors",
      active ? "bg-gold/15" : "bg-secondary",
    )}>
      {habit.emoji}
    </span>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <p className={cn("font-bold text-[15px] leading-tight", active ? "text-gold" : "text-foreground")}>{habit.label}</p>
        {detected && (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-teal bg-teal/12 px-1.5 py-0.5 rounded-full">
            <ShieldCheck size={10} /> Detected
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-1 mt-0.5">
        {active ? `+${habit.xp} XP` : (habit.note || `+${habit.xp} XP`)}
      </p>
    </div>
    {/* Check pill */}
    <div className={cn(
      "h-6 w-6 rounded-full border-2 transition-all duration-200 shrink-0 flex items-center justify-center",
      active ? "border-gold bg-gold shadow-[0_0_10px_-1px_hsl(var(--gold)/0.6)]" : "border-muted-foreground/30 group-active:border-muted-foreground/50",
    )}>
      {active && <Check size={14} className="text-primary-foreground" strokeWidth={3} />}
    </div>
  </button>
);

const DailyCheckin = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { profile: athlete } = useAthleteProfile();
  const why = athlete?.i_am?.trim();
  const queryClient = useQueryClient();

  // The user's personalized habit selection (or the classic default set).
  const { keys: habitKeys, isCustomized, save: saveHabits, saving: savingHabits } = useCheckinConfig();
  const chosenHabits = useMemo(() => resolveCheckinHabits(habitKeys), [habitKeys]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // First-run habit onboarding: prompt once to pick habits (non-blocking).
  const onboardKey = user?.id ? `w_checkin_onboarded_${user.id}` : "w_checkin_onboarded";
  const [onboardDismissed, setOnboardDismissed] = useState<boolean>(
    () => { try { return !!localStorage.getItem(onboardKey); } catch { return false; } },
  );
  const showOnboard = !isCustomized && !onboardDismissed;
  const dismissOnboard = () => {
    try { localStorage.setItem(onboardKey, "1"); } catch { /* private mode */ }
    setOnboardDismissed(true);
  };

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

  // Local-day window + midnight rollover, shared with the home screen so the
  // two can't disagree about when the check-in reopens.
  const { todayStr, canCheckin, timeUntilCheckin } = useCheckinDay(lastCheckin?.checked_in_at);

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

  // Scoring model lives in src/lib/checkin-xp.ts (unit-tested; the server's
  // record_checkin RPC mirrors the same caps and multiplier).
  const { isOptimalSleep, isChronicOversleep, oversleepCount, sleepMultiplier, sleepPenaltyLabel } = useMemo(
    () => assessSleep(sleep, recentSleep || []),
    [sleep, recentSleep],
  );

  const done = (key: string) => !!completed[key];
  const toggle = (key: string) => setCompleted((c) => ({ ...c, [key]: !c[key] }));

  const checkinState = { sleepOptimal: isOptimalSleep, workout, hydration, completed };
  const habitDone = (h: CheckinHabit): boolean => isHabitDone(h, checkinState);

  const { baseXp, totalXp, completedCount } = computeCheckinXp({
    habits: chosenHabits,
    state: checkinState,
    sportXp: selectedSport.xp,
    hasProof: !!proofFile,
    sleepMultiplier,
    questBonusXp,
  });
  const maxCount = chosenHabits.length;

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
      let hadNetworkError = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const resp = await supabase.rpc("record_checkin", rpcArgs);
        result = resp.data;
        rpcError = resp.error;
        if (!rpcError) break;
        if (rpcError.message?.includes("ALREADY_CHECKED_IN_TODAY")) break;
        if (isNetworkError(rpcError)) hadNetworkError = true;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          await supabase.auth.getSession().catch(() => {});
        }
      }

      // Reconstruct the success screen from the DB when the RPC's own response
      // can't be trusted (a prior attempt committed then the response dropped).
      const showFromDb = async () => {
        try {
          const [{ data: lastCk }, { data: prof }] = await Promise.all([
            supabase.from("daily_checkins").select("xp_earned").eq("user_id", user.id)
              .order("checked_in_at", { ascending: false }).limit(1).maybeSingle(),
            supabase.from("profiles").select("xp, level, streak").eq("user_id", user.id).maybeSingle(),
          ]);
          const xp = (prof as any)?.xp ?? 0; const lvl = (prof as any)?.level ?? 1;
          const xpIntoLevel = xp - (lvl - 1) * 500;
          setSummary({
            xpEarned: (lastCk as any)?.xp_earned ?? 0, newTotalXp: xp, oldLevel: lvl, newLevel: lvl,
            xpToNextLevel: 500 - xpIntoLevel, levelProgressPct: Math.round((xpIntoLevel / 500) * 100),
            newStreak: (prof as any)?.streak ?? 0, streakBroken: false, completedCount, maxCount,
          });
        } catch { /* summary is best-effort */ }
        setSubmitted(true);
        setSubmitting(false);
        try { hapticNotification("success"); triggerGust(0.95); } catch { /* cosmetic */ }
        queryClient.invalidateQueries({ queryKey: ["last-checkin"] });
        try { await refreshProfile(); } catch { /* non-critical */ }
      };

      if (rpcError) {
        if (rpcError.message?.includes("ALREADY_CHECKED_IN_TODAY")) {
          if (hadNetworkError) {
            // A prior attempt committed, then its response was lost — the check-in
            // DID save. Show success, not a false "already checked in" error.
            await showFromDb();
          } else {
            toast.error("You've already checked in today. Come back tomorrow 💪");
            queryClient.invalidateQueries({ queryKey: ["last-checkin"] });
            hapticNotification("error");
            setSubmitting(false);
          }
          return;
        }
        if (isNetworkError(rpcError)) {
          queueCheckin(rpcArgs as any);
          toast.success("Saved offline 📶", {
            description: "No connection right now — we'll log this check-in automatically when you're back online.",
            duration: 6000,
          });
          // Lock the form so it reads as done (optimistic summary; the real values
          // land on reconnect via the offline replay).
          const xp = (profile as any)?.xp ?? 0; const lvl = (profile as any)?.level ?? 1;
          const xpIntoLevel = xp - (lvl - 1) * 500;
          setSummary({
            xpEarned: totalXp, newTotalXp: xp + totalXp, oldLevel: lvl, newLevel: lvl,
            xpToNextLevel: 500 - xpIntoLevel, levelProgressPct: Math.round((xpIntoLevel / 500) * 100),
            newStreak: (profile?.streak ?? 0) + 1, streakBroken: false, completedCount, maxCount,
          });
          setSubmitted(true);
          setSubmitting(false);
          try { hapticNotification("success"); } catch { /* cosmetic */ }
          return;
        }
        console.error("record_checkin failed after retries:", rpcError);
        toast.error("Couldn't save your check-in.", {
          description: friendlyError(rpcError, "Check your connection and try again — your day is saved locally."),
          duration: 6000,
        });
        hapticNotification("error");
        setSubmitting(false);
        return;
      }

      const r = result as {
        checkin_id: string; xp_earned: number; new_xp: number; old_level: number;
        new_level: number; old_streak: number; new_streak: number; streak_broken: boolean;
        shield_used?: number; shield_earned?: boolean; shields_remaining?: number;
      };
      const newCheckinId = r.checkin_id;

      if (r.new_level > r.old_level) { setNewLevelReached(r.new_level); setShowLevelUp(true); }
      if ((r.shield_used ?? 0) > 0) {
        toast(`🛡️ Streak shield used — your ${r.new_streak}-day streak is safe.`, {
          description: `${r.shields_remaining ?? 0} shield${(r.shields_remaining ?? 0) === 1 ? "" : "s"} left.`,
          duration: 5000,
        });
      } else if (r.streak_broken && r.old_streak > 0) {
        toast.error(`💀 Streak lost! Your ${r.old_streak}-day streak was reset.`, { duration: 5000 });
      }
      if (r.shield_earned) {
        toast(`🛡️ Streak shield earned! (${r.shields_remaining ?? 0}/3)`, {
          description: "A missed day will cost a shield instead of your streak.",
          duration: 5000,
        });
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

      // Activation funnel: every completed check-in, plus streak milestones.
      void track(FUNNEL.checkinCompleted, {
        xp: r.xp_earned, streak: r.new_streak, completed: completedCount, max: maxCount,
      });
      if ([7, 30, 100, 365].includes(r.new_streak)) {
        void track(FUNNEL.streakMilestone, { streak: r.new_streak });
      }

      // HealthKit verification — fire-and-forget. Awards the bonus XP + badge.
      if (newCheckinId && healthKit.available) {
        healthKit.syncToday().then(async (snap) => {
          try {
            // Pass the LOCAL snapshot date so verify matches the row we just stored.
            const vr = await healthKit.verifyCheckin(newCheckinId, snap?.date);
            if (vr.verified) {
              void track(FUNNEL.checkinVerified);
              const n = Object.keys(vr.signals ?? {}).filter((k) => (vr.signals as any)[k]?.matched).length;
              toast.success("Verified ✓", {
                description: `Apple Health confirmed ${n} habit${n === 1 ? "" : "s"} — bonus XP added.`,
                duration: 4500,
              });
            }
          } catch (err) { console.warn("verify_checkin failed", err); captureException(err, { where: "checkin.verify" }); }
        }).catch((err) => { console.warn("HK sync failed", err); captureException(err, { where: "checkin.hkSync" }); });
      }

      void (async () => {
        try { await syncStreakWarningNotification({ lastCheckinAt: checkinTimestamp, streak: r.new_streak }); } catch (e) { console.warn("streak notif", e); captureException(e, { where: "checkin.streakNotif" }); }
        try { await supabase.rpc("update_status_tier", { target_user_id: user.id }); } catch (e) { console.warn("tier update", e); captureException(e, { where: "checkin.tierUpdate" }); }
        try {
          const newBadge = await checkAndAwardBadges(user.id);
          if (newBadge?.isNew) setUnlockedBadge(newBadge.badge);
        } catch (e) { console.warn("badge award", e); captureException(e, { where: "checkin.badgeAward" }); }
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
            const { error: postErr } = await supabase.from("feed_posts").insert({ user_id: user.id, content, image_url: proof_photo_url });
            if (postErr) throw postErr;
          }
        } catch (e) { console.warn("feed post", e); captureException(e, { where: "checkin.feedPost" }); }
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
      <div className="min-h-full flex flex-col items-center justify-center px-6 text-center pb-4">
        <div className="animate-reveal">
          <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
            <Moon size={36} className="text-muted-foreground" />
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight mb-2">Already Logged Today</h1>
          <p className="text-muted-foreground text-sm mb-2">You can only check in once per day.</p>
          <p className="text-gold font-display text-lg font-bold mb-8">Next check-in in {timeUntilCheckin}</p>
          <Button variant="gold-outline" size="lg" onClick={() => navigate("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <ErrorBoundary
        fallback={
          <div className="min-h-full flex flex-col items-center justify-center px-6 text-center">
            <div className="h-20 w-20 rounded-full bg-xp-green/15 flex items-center justify-center mx-auto mb-5">
              <Check size={40} className="text-xp-green" />
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight mb-2">Checked in ✓</h1>
            <p className="text-muted-foreground text-sm mb-8">Your day is locked in. Nice work.</p>
            <Button variant="ember" size="lg" onClick={() => navigate("/")}>Back to Dashboard</Button>
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
    <div className="min-h-full pb-4 px-4 pt-0">
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

      {/* The "why" anchor — reframes the whole check-in from "earn XP" to
          "become who I said I'd become." Quiet, non-gold, only shown once the
          user has authored their identity statement. */}
      {why && (
        <div className="mt-2 mb-1 rounded-2xl border border-border/50 bg-card/40 px-4 py-2.5">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            Today's discipline is for
          </p>
          <p className="text-[13px] font-bold leading-snug text-foreground/90 mt-0.5">
            {why}
          </p>
        </div>
      )}

      <CheckinHabitPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedKeys={habitKeys}
        onSave={saveHabits}
        saving={savingHabits}
      />

      {/* First-run onboarding — make personalization obvious (non-blocking). */}
      {showOnboard && (
        <div className="mt-3 mb-4 rounded-2xl border border-gold/35 bg-gradient-to-b from-gold/10 to-gold/[0.03] p-4 text-center animate-reveal">
          <p className="text-2xl mb-1">✨</p>
          <p className="font-display text-lg font-black tracking-tight">Make it yours</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3 max-w-[280px] mx-auto">
            Pick the habits you'll actually track every day. Sleep, workout, water &amp; meditation
            stay in — add whatever matters to you.
          </p>
          <Button variant="ember" size="lg" className="w-full" onClick={() => { hapticSelection(); setPickerOpen(true); }}>
            <SlidersHorizontal size={16} /> Choose my habits
          </Button>
          <button onClick={dismissOnboard} className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-foreground transition-colors py-1">
            Use the defaults for now
          </button>
        </div>
      )}

      {/* Habits header + prominent Customize button */}
      <div className="mt-3 mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-black tracking-[0.16em] uppercase text-gold/80">
          Your habits · tap what you did
        </p>
        <button
          onClick={() => { hapticSelection(); setPickerOpen(true); }}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gradient-to-r from-gold/15 to-gold/[0.06] px-3.5 py-2 text-xs font-black uppercase tracking-wide text-gold transition-all active:scale-[0.96] hover:from-gold/20 shadow-[0_2px_10px_-3px_hsl(var(--gold)/0.4)]"
        >
          <SlidersHorizontal size={14} /> Customize
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
      <div className={cn(
        "rounded-2xl border p-4 mb-3 transition-all duration-200",
        isOptimalSleep
          ? "border-gold/45 bg-gradient-to-r from-gold/[0.10] to-gold/[0.03] shadow-[0_0_0_1px_hsl(var(--gold)/0.12),0_4px_14px_-6px_hsl(var(--gold)/0.3)]"
          : "border-border bg-card",
      )}>
        <div className="flex items-center gap-3 mb-3">
          <div className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl shrink-0 transition-colors",
            isOptimalSleep ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground",
          )}><Moon size={20} /></div>
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
            "flex items-center gap-3 w-full rounded-2xl border p-3.5 transition-all duration-200 text-left active:scale-[0.98]",
            workout
              ? "border-gold/45 bg-gradient-to-r from-gold/[0.12] to-gold/[0.04] shadow-[0_0_0_1px_hsl(var(--gold)/0.15),0_4px_14px_-6px_hsl(var(--gold)/0.35)]"
              : "border-border bg-card hover:bg-secondary/50",
          )}
        >
          <div className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl shrink-0 transition-colors",
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
          <div className="mt-1.5 rounded-2xl border border-border bg-card overflow-hidden">
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
        <div className={cn(
          "rounded-2xl border p-4 mb-3 transition-all duration-200",
          hydration >= 3
            ? "border-gold/45 bg-gradient-to-r from-gold/[0.10] to-gold/[0.03] shadow-[0_0_0_1px_hsl(var(--gold)/0.12),0_4px_14px_-6px_hsl(var(--gold)/0.3)]"
            : "border-border bg-card",
        )}>
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl shrink-0 transition-colors",
              hydration >= 3 ? "bg-gold/15 text-gold" : "bg-teal/10 text-teal",
            )}><Droplets size={20} /></div>
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

      {/* Extras — collapsed to keep the daily flow short. Quests stay MOUNTED
          (hidden when closed) so their bonus XP keeps counting toward the total. */}
      <div className="mt-1 mb-4">
        <button
          onClick={() => { hapticSelection(); setMoreOpen((o) => !o); }}
          className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left active:scale-[0.99]"
        >
          <span className="text-sm font-semibold flex items-center gap-2">
            <Plus size={16} className="text-gold" />
            Bonus quests &amp; proof photo
            {questBonusXp > 0 && <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">+{questBonusXp} XP</span>}
          </span>
          <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", moreOpen && "rotate-180")} />
        </button>

        <div className={cn("mt-3 space-y-4", !moreOpen && "hidden")}>
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

          {/* Proof photo — available to everyone (all app users are paid) */}
          <div>
            <label className="flex items-center gap-3 w-full rounded-xl border border-dashed border-gold/30 p-4 hover:bg-gold/5 transition-colors active:scale-[0.97] cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold"><Camera size={20} /></div>
              <div className="text-left flex-1">
                <p className="font-semibold text-sm">Take proof photo (live only)</p>
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
        </div>
      </div>

      {/* Honesty — the discipline wedge. "You can't grind with lies." */}
      <div className={cn(
        "mb-4 rounded-2xl border p-4 transition-all duration-200",
        honest === true
          ? "border-gold/45 bg-gradient-to-b from-gold/[0.08] to-transparent"
          : honest === false
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-card",
      )}>
        <p className="font-bold text-[15px] flex items-center gap-1.5">Were you honest? <span>🤝</span></p>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          Answer truthfully — <span className="text-foreground/80 font-semibold">you can't grind with lies.</span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => { hapticSelection(); setHonest(true); }}
            className={cn(
              "flex-1 rounded-xl border p-3 text-sm font-black transition-all active:scale-[0.97]",
              honest === true
                ? "border-gold/50 bg-gold/12 text-gold shadow-[0_0_14px_-4px_hsl(var(--gold)/0.5)]"
                : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80",
            )}
          >Yes ✅</button>
          <button
            onClick={() => { hapticSelection(); setHonest(false); }}
            className={cn(
              "flex-1 rounded-xl border p-3 text-sm font-black transition-all active:scale-[0.97]",
              honest === false
                ? "border-destructive/50 bg-destructive/12 text-destructive"
                : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80",
            )}
          >No ❌</button>
        </div>
        {honest === false && (
          <p className="text-xs text-destructive mt-2.5 font-medium">Be honest with yourself. Go back and fix your answers.</p>
        )}
      </div>

      {/* Submit */}
      <div className="mt-6">
        <Button variant="ember" size="xl" className="w-full" onClick={handleSubmit} disabled={submitting || honest !== true}>
          <Zap size={20} />
          {submitting ? "Submitting..." : `Submit Day — Earn ${totalXp} XP`}
        </Button>
        {honest === null && !submitting ? (
          // Close the loop on the greyed button so it doesn't read as broken.
          // Only when UNANSWERED — after "No" the red guidance above owns the
          // message; showing this too read as "flip it to Yes to proceed".
          <p className="mt-2 text-center text-[11px] font-semibold text-gold/85">
            Confirm “Were you honest?” above to submit
          </p>
        ) : (
          <p className="mt-2 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1">
            <Sparkles size={12} className="text-gold" /> {maxCount} habits · your personal standard
          </p>
        )}
      </div>
    </div>
  );
};

export default DailyCheckin;
