import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import { Button } from "@/components/ui/button";
import { Check, Lock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { captureException } from "@/lib/observability";
import { downscaleImage } from "@/lib/downscale-image";
import { track, FUNNEL } from "@/lib/analytics";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import BadgeUnlockModal from "@/components/BadgeUnlockModal";
import { checkAndAwardBadges } from "@/lib/badge-awards";
import ConfettiBurst from "@/components/ConfettiBurst";
import LevelUpCelebration from "@/components/LevelUpCelebration";
import { syncStreakWarningNotification } from "@/lib/streak-notifications";
import { useModeration } from "@/hooks/use-moderation";
import ModerationGate from "@/components/ModerationGate";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { triggerGust } from "@/lib/wind";
import { useHealthKit } from "@/hooks/use-healthkit";
import { queueCheckin, isNetworkError, localDateStr } from "@/lib/offline-checkin";
import { checkinReactionKey, fetchCheckinReaction } from "@/lib/checkin-reaction";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import EmptyState from "@/components/ui/empty-state";
import { useCheckinConfig } from "@/hooks/use-checkin-config";
import { useCheckinDay } from "@/hooks/use-checkin-day";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";
import CheckinHabitPicker from "@/components/checkin/CheckinHabitPicker";
import CheckinHeader from "@/components/checkin/CheckinHeader";
import CoreFour, { type WorkoutChoice } from "@/components/checkin/CoreFour";
import ExtrasSection from "@/components/checkin/ExtrasSection";
import HonestyGate from "@/components/checkin/HonestyGate";
import CheckinSummary, { type CheckinSummaryData } from "@/components/checkin/CheckinSummary";
import { resolveCheckinHabits, type CheckinHabit, type VerifySignal } from "@/lib/checkin-habits";
import { assessSleep, isHabitDone, computeCheckinXp } from "@/lib/checkin-xp";
import { SPORT_CATALOG, buildForYou } from "@/lib/sports";
import { useRecentSports } from "@/hooks/use-recent-sports";
import { loadCheckinDraft, saveCheckinDraft, clearCheckinDraft } from "@/lib/checkin-draft";

const STREAK_MILESTONES = [7, 30, 100, 365];

/** "Streak ends at midnight — 2h 14m left" — only inside the last 3 hours. */
const deadlineLineFor = (streak: number): string | null => {
  if (streak < 1) return null;
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const ms = midnight.getTime() - now.getTime();
  if (ms > 3 * 3600_000) return null;
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return `Streak ends at midnight — ${h > 0 ? `${h}h ` : ""}${m}m left`;
};

/**
 * Daily check-in — the app's one daily action.
 * Structure teaches the model: THE CORE 4 (logged every day, done or not) →
 * YOUR EXTRAS (optional, one +40 pool) → Honest log → Lock my day.
 */
const DailyCheckin = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { profile: athlete } = useAthleteProfile();
  const why = athlete?.i_am?.trim();
  const queryClient = useQueryClient();

  // The user's personalized habit selection (core is always included).
  const { keys: habitKeys, isCustomized, save: saveHabits, saving: savingHabits } = useCheckinConfig();
  const chosenHabits = useMemo(() => resolveCheckinHabits(habitKeys), [habitKeys]);
  const coreHabits = useMemo(() => chosenHabits.filter((h) => h.core), [chosenHabits]);
  const extraHabits = useMemo(() => chosenHabits.filter((h) => !h.core), [chosenHabits]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const onboardKey = user?.id ? `w_checkin_onboarded_${user.id}` : "w_checkin_onboarded";
  const [onboardDismissed, setOnboardDismissed] = useState<boolean>(
    () => { try { return !!localStorage.getItem(onboardKey); } catch { return false; } },
  );
  const showFirstRun = !isCustomized && !onboardDismissed;
  const dismissFirstRun = () => {
    try { localStorage.setItem(onboardKey, "1"); } catch { /* private mode */ }
    setOnboardDismissed(true);
  };

  const { data: lastCheckin } = useQuery({
    queryKey: ["last-checkin", user?.id],
    staleTime: 0,
    gcTime: 30 * 60_000,
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

  // Local-day window + midnight rollover, shared with Home so the two can't
  // disagree about when the check-in reopens.
  const { todayStr, canCheckin, timeUntilCheckin } = useCheckinDay(lastCheckin?.checked_in_at);

  // ── Form state ──────────────────────────────────────────────────────────
  const [sleep, setSleep] = useState(8);
  const [workoutChoice, setWorkoutChoice] = useState<WorkoutChoice>(null);
  const [sportCategory, setSportCategory] = useState("none");
  const [hydration, setHydration] = useState(2);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [honest, setHonest] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Draft: restore once per mount, then persist (debounced) — a stray tab tap
  // or a WebView kill no longer loses the day's answers.
  const draftRestored = useRef(false);
  const draftReady = useRef(false);
  useEffect(() => {
    if (!user?.id || draftReady.current) return;
    const d = loadCheckinDraft(user.id);
    if (d) {
      setSleep(d.sleep); setWorkoutChoice(d.workoutChoice); setSportCategory(d.sportCategory);
      setHydration(d.hydration); setCompleted(d.completed); setHonest(d.honest);
      draftRestored.current = true;
    }
    draftReady.current = true;
  }, [user?.id]);
  useEffect(() => {
    if (!user?.id || !draftReady.current || submitted) return;
    const t = setTimeout(() => saveCheckinDraft(user.id, { sleep, workoutChoice, sportCategory, hydration, completed, honest }), 300);
    return () => clearTimeout(t);
  }, [user?.id, sleep, workoutChoice, sportCategory, hydration, completed, honest, submitted]);

  // Day rollover: reset the celebration + refetch so a mounted screen resets.
  const prevDayRef = useRef(todayStr);
  useEffect(() => {
    if (prevDayRef.current === todayStr) return;
    prevDayRef.current = todayStr;
    setSubmitted(false);
    queryClient.invalidateQueries({ queryKey: ["last-checkin", user?.id] });
  }, [todayStr, queryClient, user?.id]);

  // ── Apple Health auto-detect (fail-open, iOS-only) ──────────────────────
  const healthKit = useHealthKit();
  const [detected, setDetected] = useState<Partial<Record<VerifySignal, boolean>>>({});
  const [detectedWorkoutMin, setDetectedWorkoutMin] = useState<number | null>(null);
  const [detectedSportId, setDetectedSportId] = useState<string | null>(null);
  const prefilled = useRef(false);
  const recentSports = useRecentSports();
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
      if (workoutDone && snap.primary_sport) setDetectedSportId(snap.primary_sport);
      // Prefill ONLY when no draft was restored — the user's own answers win.
      if (prefilled.current || draftRestored.current) return;
      prefilled.current = true;
      if (workoutDone && snap.primary_sport) {
        setWorkoutChoice("trained");
        setSportCategory((cur) => (cur === "none" ? snap.primary_sport! : cur));
      }
      if (sleepKnown) setSleep(Math.min(12, Math.max(4, Math.round((snap.sleep_hours as number) * 2) / 2)));
      if (stepsDone) setCompleted((c) => ({ ...c, steps_8k: true }));
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healthKit.available]);

  const isDetected = (h: CheckinHabit): boolean => {
    if (!h.verify) return false;
    return !!detected[h.verify];
  };
  const healthLine = healthKit.available && (detected.workout || detected.steps || detected.mindfulness || detected.sleep)
    ? `Apple Health synced — ${[
        detected.workout && `${detectedWorkoutMin ? `${detectedWorkoutMin}-min ` : ""}workout`,
        detected.steps && "8k+ steps",
        detected.mindfulness && "meditation",
        detected.sleep && "sleep",
      ].filter(Boolean).join(", ")} detected.`
    : null;

  // ── Scoring (src/lib/checkin-xp.ts — additive, unit-tested) ────────────
  const workout = workoutChoice === "trained" && sportCategory !== "none";
  const selectedSport = workout ? (SPORT_CATALOG.find((s) => s.id === sportCategory) ?? null) : null;
  const forYou = buildForYou(detectedSportId, athlete?.sports, recentSports);
  const { isOptimalSleep, label: sleepLabel } = useMemo(() => assessSleep(sleep), [sleep]);
  const done = (key: string) => !!completed[key];
  const toggle = (key: string) => setCompleted((c) => ({ ...c, [key]: !c[key] }));
  const checkinState = { sleepOptimal: isOptimalSleep, workout, hydration, completed };
  const habitDone = (h: CheckinHabit): boolean => isHabitDone(h, checkinState);
  const xp = computeCheckinXp({ habits: chosenHabits, state: checkinState, sportXp: selectedSport?.xp ?? 0, hasProof: !!proofFile });
  const { totalXp, completedCount, coreDone, coreTotal, extrasDone } = xp;
  const maxCount = chosenHabits.length;
  const habitXp = (key: string) => coreHabits.find((h) => h.key === key)?.xp ?? 0;

  // ── Celebrations: at most one overlay at a time (LevelUp first, then badge) ─
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevelReached, setNewLevelReached] = useState(0);
  const [unlockedBadge, setUnlockedBadge] = useState<any>(null);
  const pendingBadge = useRef<any>(null);
  const [confetti, setConfetti] = useState(false);
  const [summary, setSummary] = useState<CheckinSummaryData | null>(null);
  const addNote = useCallback((note: string) => {
    setSummary((s) => (s && !s.notes.includes(note) ? { ...s, notes: [...s.notes, note] } : s));
  }, []);
  const queueBadge = (badge: any) => {
    if (showLevelUp) pendingBadge.current = badge;
    else setUnlockedBadge(badge);
  };
  const moderation = useModeration();

  const handleSubmit = async () => {
    if (!user || submitting || !canCheckin || !honest) return;
    hapticImpact("medium");
    setSubmitting(true);

    // Warm the summary: coach reaction (parallel with the RPC) + plan row.
    void queryClient.prefetchQuery({
      queryKey: checkinReactionKey(user.id),
      staleTime: Infinity,
      queryFn: () =>
        fetchCheckinReaction({
          xp_earned: totalXp,
          tasks_done: completedCount,
          tasks_total: maxCount,
          streak: (profile?.streak ?? 0) + 1,
          done_keys: chosenHabits.filter((h) => habitDone(h)).map((h) => h.key),
          missed_keys: chosenHabits.filter((h) => !habitDone(h)).map((h) => h.key),
        }),
    });
    void queryClient.prefetchQuery({
      queryKey: ["coach-daily-plan", user.id, localDateStr()],
      staleTime: 5 * 60_000,
      queryFn: async () => {
        const { data } = await supabase
          .from("coach_daily_plans").select("*")
          .eq("user_id", user.id).eq("plan_date", localDateStr()).maybeSingle();
        return data ?? null;
      },
    });

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

      // jsonb of completions for habits without a legacy column.
      const habitsJson: Record<string, boolean> = {};
      for (const h of chosenHabits) {
        if (h.core || h.column) continue;
        if (habitDone(h)) habitsJson[h.key] = true;
      }

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
        p_tz_offset_minutes: new Date().getTimezoneOffset(),
        p_habits: habitsJson,
        // undefined (not null) → omitted → SQL default NULL; keeps the generated type happy.
        p_sport: workout ? sportCategory : undefined,
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

      const finishLocally = (s: CheckinSummaryData) => {
        setSummary(s);
        setSubmitted(true);
        setSubmitting(false);
        clearCheckinDraft(user.id);
        try { hapticNotification("success"); triggerGust(0.95); } catch { /* cosmetic */ }
      };

      // Reconstruct the success screen from the DB when the RPC response
      // can't be trusted (a prior attempt committed, then the response dropped).
      const showFromDb = async () => {
        let xpEarned = 0; let newStreak = 0;
        try {
          const [{ data: lastCk }, { data: prof }] = await Promise.all([
            supabase.from("daily_checkins").select("xp_earned").eq("user_id", user.id)
              .order("checked_in_at", { ascending: false }).limit(1).maybeSingle(),
            supabase.from("profiles").select("streak").eq("user_id", user.id).maybeSingle(),
          ]);
          xpEarned = (lastCk as any)?.xp_earned ?? 0;
          newStreak = (prof as any)?.streak ?? 0;
        } catch { /* best-effort */ }
        finishLocally({ xpEarned, newStreak, streakBroken: false, coreDone, coreTotal, extrasDone, notes: [] });
        queryClient.invalidateQueries({ queryKey: ["last-checkin"] });
        try { await refreshProfile(); } catch { /* non-critical */ }
      };

      if (rpcError) {
        if (rpcError.message?.includes("ALREADY_CHECKED_IN_TODAY")) {
          if (hadNetworkError) {
            await showFromDb();
          } else {
            toast.error("You've already checked in today. It opens again at midnight.");
            queryClient.invalidateQueries({ queryKey: ["last-checkin"] });
            hapticNotification("error");
            setSubmitting(false);
          }
          return;
        }
        if (isNetworkError(rpcError)) {
          queueCheckin(rpcArgs as any);
          toast.success("Saved offline", {
            description: "No connection right now — we'll log this check-in automatically when you're back online.",
            duration: 6000,
          });
          finishLocally({
            xpEarned: totalXp, newStreak: (profile?.streak ?? 0) + 1, streakBroken: false,
            coreDone, coreTotal, extrasDone, notes: ["Saved offline — syncs when you're back online."],
          });
          return;
        }
        console.error("record_checkin failed after retries:", rpcError);
        toast.error("Couldn't save your check-in.", {
          description: friendlyError(rpcError, "Check your connection and try again — your answers are saved on this device."),
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
      const streakBroken = r.streak_broken && r.old_streak > 0;

      const notes: string[] = [];
      if ((r.shield_used ?? 0) > 0) {
        notes.push(`Streak shield used — your ${r.new_streak}-day streak is safe (${r.shields_remaining ?? 0} left).`);
      } else if (streakBroken) {
        notes.push(`Streak reset — your ${r.old_streak}-day run ended. Today is day 1.`);
      }
      if (r.shield_earned) notes.push(`Streak shield earned (${r.shields_remaining ?? 0}/3) — a missed day costs a shield, not the streak.`);

      finishLocally({ xpEarned: r.xp_earned, newStreak: r.new_streak, streakBroken, coreDone, coreTotal, extrasDone, notes });

      // Celebrations: confetti only for a full Core 4 or a streak milestone;
      // LevelUp first, badge queued behind it.
      const milestone = STREAK_MILESTONES.includes(r.new_streak);
      setConfetti(coreDone === coreTotal || milestone);
      if (r.new_level > r.old_level) { setNewLevelReached(r.new_level); setShowLevelUp(true); }

      void track(FUNNEL.checkinCompleted, { xp: r.xp_earned, streak: r.new_streak, completed: completedCount, max: maxCount });
      if (milestone) void track(FUNNEL.streakMilestone, { streak: r.new_streak });

      // HealthKit verification — fire-and-forget; lands as a quiet note.
      if (newCheckinId && healthKit.available) {
        healthKit.syncToday().then(async (snap) => {
          try {
            const vr = await healthKit.verifyCheckin(newCheckinId, snap?.date);
            if (vr.verified) {
              void track(FUNNEL.checkinVerified);
              const n = Object.keys(vr.signals ?? {}).filter((k) => (vr.signals as any)[k]?.matched).length;
              addNote(`Apple Health verified ${n} habit${n === 1 ? "" : "s"} — bonus XP added.`);
            }
          } catch (err) { console.warn("verify_checkin failed", err); captureException(err, { where: "checkin.verify" }); }
        }).catch((err) => { console.warn("HK sync failed", err); captureException(err, { where: "checkin.hkSync" }); });
      }

      void (async () => {
        try { await syncStreakWarningNotification({ lastCheckinAt: checkinTimestamp, streak: r.new_streak }); } catch (e) { console.warn("streak notif", e); captureException(e, { where: "checkin.streakNotif" }); }
        try { await supabase.rpc("update_status_tier", { target_user_id: user.id }); } catch (e) { console.warn("tier update", e); captureException(e, { where: "checkin.tierUpdate" }); }
        try {
          const newBadge = await checkAndAwardBadges(user.id);
          if (newBadge?.isNew) queueBadge(newBadge.badge);
        } catch (e) { console.warn("badge award", e); captureException(e, { where: "checkin.badgeAward" }); }
        try {
          // Tribe loopback — the one toast that stays (it carries an action).
          const { data: mems } = await supabase
            .from("tribe_members").select("tribe_id").eq("user_id", user.id).eq("status", "active");
          const tribeIds = ((mems as any) ?? []).map((m: any) => m.tribe_id as string);
          if (tribeIds.length > 0) {
            const { data: myTribes } = await supabase
              .from("tribes").select("id, name, collective_streak")
              .in("id", tribeIds).order("collective_streak", { ascending: false }).limit(1);
            const top = ((myTribes as any) ?? [])[0];
            if (top) {
              toast.success(`${top.name} +1 → ${((top.collective_streak as number) ?? 0) + 1}d`, {
                description: tribeIds.length > 1 ? `You fed ${tribeIds.length} fires today.` : "Your check-in feeds the collective fire.",
                duration: 5000,
                action: { label: "Open", onClick: () => navigate(`/tribes/${top.id}`) },
              });
            }
          }
        } catch { /* non-critical */ }
        try {
          if (proof_photo_url) {
            const sportLabel = selectedSport ? `${selectedSport.emoji} ${selectedSport.label}` : null;
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

  // ── Locked for today ────────────────────────────────────────────────────
  if (!canCheckin && !submitted) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-6 pb-4">
        <EmptyState
          icon={Lock}
          title="Day locked"
          description={`You've checked in today. It opens again at midnight — in ${timeUntilCheckin}.`}
          action={<Button variant="gold-outline" size="lg" onClick={() => navigate("/")}>Back to Today</Button>}
        />
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
            <p className="text-muted-foreground text-sm mb-8">Your day is locked in.</p>
            <Button variant="ember" size="lg" onClick={() => navigate("/")}>Back to Today</Button>
          </div>
        }
      >
        {showLevelUp && (
          <LevelUpCelebration
            newLevel={newLevelReached}
            onComplete={() => {
              setShowLevelUp(false);
              if (pendingBadge.current) { setUnlockedBadge(pendingBadge.current); pendingBadge.current = null; }
            }}
          />
        )}
        <BadgeUnlockModal badge={unlockedBadge} onClose={() => setUnlockedBadge(null)} />
        <ConfettiBurst active={confetti} />
        {summary && (
          <CheckinSummary
            summary={summary}
            onDone={() => navigate("/")}
            onAskCoach={(seed) => navigate(`/coach?seed=${encodeURIComponent(seed)}`)}
          />
        )}
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-full pb-6 px-4 pt-0">
      <ModerationGate
        state={moderation.state}
        message={moderation.message}
        thumbnailUrl={proofPreview}
        onCancel={moderation.cancel}
        onDismiss={moderation.reset}
      />
      <CheckinHeader
        streak={profile?.streak ?? 0}
        xpToday={totalXp}
        coreDone={coreDone}
        coreTotal={coreTotal}
        workoutAnswered={workoutChoice !== null}
        deadlineLine={deadlineLineFor(profile?.streak ?? 0)}
        onBack={() => navigate("/")}
      />

      {/* The "why" anchor — quiet, only once the user has authored it. */}
      {why && (
        <div className="mb-4 surface-card px-4 py-2.5">
          <p className="eyebrow text-muted-foreground/60">Today's discipline is for</p>
          <p className="text-[13px] font-bold leading-snug text-foreground/90 mt-0.5">{why}</p>
        </div>
      )}

      <CheckinHabitPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedKeys={habitKeys}
        onSave={saveHabits}
        saving={savingHabits}
      />

      <CoreFour
        sleep={sleep} onSleep={setSleep} sleepOptimal={isOptimalSleep} sleepLabel={sleepLabel} sleepXp={habitXp("sleep")} sleepDetected={!!detected.sleep}
        workoutChoice={workoutChoice} onWorkoutChoice={(c) => { setWorkoutChoice(c); if (c === "rest") setSportCategory("none"); }}
        selectedSport={selectedSport} onSelectSport={(id) => { setSportCategory(id); setWorkoutChoice("trained"); }}
        forYou={forYou} detectedWorkout={!!detected.workout} detectedSportId={detectedSportId}
        hydration={hydration} onHydration={setHydration} hydrationXp={habitXp("hydration")}
        meditationDone={done("meditation")} onToggleMeditation={() => toggle("meditation")} meditationXp={habitXp("meditation")} meditationDetected={!!detected.mindfulness}
        healthLine={healthLine}
      />

      <ExtrasSection
        habits={extraHabits}
        done={done}
        onToggle={toggle}
        isDetected={isDetected}
        earned={xp.extras.earned}
        cap={xp.extras.cap}
        onCustomize={() => setPickerOpen(true)}
        showFirstRun={showFirstRun}
        onDismissFirstRun={dismissFirstRun}
        proofFile={proofFile}
        proofPreview={proofPreview}
        onProofChange={(file) => {
          setProofFile(file);
          const reader = new FileReader();
          reader.onload = () => setProofPreview(reader.result as string);
          reader.readAsDataURL(file);
        }}
        onProofClear={() => { setProofFile(null); setProofPreview(null); }}
      />

      <div className="mb-3">
        <HonestyGate checked={honest} onChange={setHonest} />
      </div>

      <Button variant="ember" size="xl" className="w-full" onClick={handleSubmit} disabled={submitting || !honest}>
        <Zap size={20} />
        {submitting ? "Locking…" : `Lock my day · +${totalXp} XP`}
      </Button>
      {!honest && !submitting && (
        <p className="mt-2 text-center text-[11px] font-semibold text-muted-foreground">Tick the honest-log box to lock your day.</p>
      )}
    </div>
  );
};

export default DailyCheckin;
