import { createContext, useContext, useEffect, useCallback, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/query-client";
import { track, FUNNEL } from "@/lib/analytics";
import { useAuth } from "@/contexts/AuthContext";
import {
  requestStreakNotificationPermission,
  syncStreakWarningNotification,
} from "@/lib/streak-notifications";
import { getNotificationPrefs } from "@/lib/notification-prefs";
import type { ToneId } from "@/hooks/use-athlete-profile";
import { LocalNotifications } from "@capacitor/local-notifications";

// Whitelisted in-app routes that notifications may navigate to. Anything
// outside this list is silently ignored — defends against a payload trying to
// open external URLs / arbitrary attacker-controlled destinations.
const SAFE_ROUTES = new Set<string>([
  "/", "/checkin", "/feed", "/tribes", "/squad", "/messages",
  "/leaderboard",
  "/referrals",
  "/friends",
  "/notifications", "/battles", "/profile", "/coach",
  "/coach/program",
  "/coach/memory", "/coach/goal", "/coach/reflect",
  "/coach/progress", "/coach/profile",
]);
const SAFE_PREFIXES = ["/briefing/", "/chat/", "/tribes/", "/user/"];
export const isSafeRoute = (r: unknown): r is string => {
  if (typeof r !== "string" || !r.startsWith("/")) return false;
  // Match on the pathname only — "/squad?tab=tribes" must pass the "/squad"
  // whitelist entry (query strings used to silently kill the deep link).
  const path = r.split("?")[0];
  return SAFE_ROUTES.has(path) || SAFE_PREFIXES.some((p) => path.startsWith(p));
};
// Use history.pushState so React Router picks up the change instead of a
// full-page reload (window.location.href reboots the WebView).
const safeNavigate = (route: string) => {
  if (!isSafeRoute(route)) return;
  window.history.pushState({}, "", route);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

// Re-prime a dismissed user at most once a week (never nag every launch).
const PRIMING_DISMISS_KEY = "push_priming_dismissed_at";
const REPRIME_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export interface PushNotificationState {
  /** True when we should show the in-app priming sheet BEFORE the OS prompt. */
  needsPriming: boolean;
  /** Call from the priming sheet's primary CTA — fires the real OS prompt. */
  enablePush: () => Promise<void>;
  /** Call from the priming sheet's "Not now" — snoozes for a week. */
  dismissPriming: () => void;
  /** Re-read prefs/tone and reschedule the local streak warning (settings screen). */
  resyncStreakWarning: () => Promise<void>;
}

/**
 * The app mounts usePushNotifications exactly ONCE (AppContent) — it owns the
 * native listeners. Other surfaces that need to trigger the OS prompt (the
 * onboarding push step) consume that single instance through this context
 * instead of instantiating the hook again (which would duplicate listeners).
 */
export const PushControlsContext = createContext<Pick<
  PushNotificationState,
  "enablePush" | "dismissPriming" | "resyncStreakWarning"
> | null>(null);

export const usePushControls = () => useContext(PushControlsContext);

export const usePushNotifications = (): PushNotificationState => {
  const { user } = useAuth();
  const [needsPriming, setNeedsPriming] = useState(false);
  const activatedRef = useRef(false);
  // Retain the exact listener handles we added, so cleanup removes ONLY ours —
  // never a global removeAllListeners() that would also kill listeners other
  // modules registered.
  const handlesRef = useRef<Array<{ remove: () => Promise<void> }>>([]);

  const syncStreakWarning = useCallback(async () => {
    if (!user) return;
    const [{ data: lastCheckin }, { data: profile }, { data: athlete }] = await Promise.all([
      supabase.from("daily_checkins").select("checked_in_at")
        .eq("user_id", user.id).order("checked_in_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("profiles").select("streak, notification_prefs")
        .eq("user_id", user.id).maybeSingle(),
      supabase.from("coach_athlete_profile").select("tone_pref")
        .eq("user_id", user.id).maybeSingle(),
    ]);
    const row = profile;
    const prefs = getNotificationPrefs(row?.notification_prefs);
    await syncStreakWarningNotification({
      lastCheckinAt: lastCheckin?.checked_in_at ?? null,
      streak: row?.streak ?? 0,
      tone: ((athlete as { tone_pref?: ToneId } | null)?.tone_pref) ?? null,
      hour: prefs.reminder_hour,
      enabled: prefs.streak_guard,
    });
  }, [user?.id]);

  const registerToken = useCallback(async (token: string) => {
    if (!user) return;
    const platform = Capacitor.getPlatform();
    await supabase.from("push_tokens").upsert(
      { user_id: user.id, token, platform },
      { onConflict: "user_id,token" },
    );
  }, [user?.id]);

  // Register for pushes + wire navigation listeners. Idempotent (guarded by
  // activatedRef) so it can run either when permission is already granted on
  // mount, or right after the user grants it via the priming sheet.
  const activate = useCallback(async () => {
    if (activatedRef.current) return;
    activatedRef.current = true;

    await PushNotifications.register();
    handlesRef.current.push(
      await PushNotifications.addListener("registration", (token) => registerToken(token.value)),
      await PushNotifications.addListener("registrationError", (err) => console.error("Push registration error:", err)),
      await PushNotifications.addListener("pushNotificationReceived", () => {
        // Foreground: the OS shows the banner; we refresh the bell so the
        // in-app inbox + unread count are already current.
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }),
      await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const route = action.notification.data?.route;
        safeNavigate(typeof route === "string" ? route : "");
      }),
      await LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
        const route = event.notification.extra?.route;
        safeNavigate(typeof route === "string" ? route : "");
      }),
    );

    // Local streak-warning notifications ride the same opt-in moment.
    const localGranted = await requestStreakNotificationPermission().catch(() => false);
    if (localGranted) await syncStreakWarning();
  }, [registerToken, syncStreakWarning]);

  // The user opted in via the priming sheet → NOW fire the real OS prompt.
  const enablePush = useCallback(async () => {
    setNeedsPriming(false);
    try { localStorage.setItem(PRIMING_DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
    try {
      const perm = await PushNotifications.requestPermissions();
      // Opt-in rate is the single biggest lever on every push retention loop.
      void track(FUNNEL.pushPermission, { granted: perm.receive === "granted" });
      if (perm.receive === "granted") await activate();
    } catch (e) {
      console.warn("push permission request failed", e);
    }
  }, [activate]);

  const dismissPriming = useCallback(() => {
    setNeedsPriming(false);
    try { localStorage.setItem(PRIMING_DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;

    let cancelled = false;
    let primeTimer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      // Check — never cold-request. A cold OS prompt that's denied is permanent.
      const perm = await PushNotifications.checkPermissions().catch(() => null);
      if (cancelled || !perm) return;

      if (perm.receive === "granted") {
        // Already granted (returning user) — just wire everything up.
        await activate();
        return;
      }
      if (perm.receive === "denied") return; // can't re-prompt; leave it.

      // 'prompt' / 'prompt-with-rationale' → show OUR rationale first, unless
      // we recently snoozed it. Delay so the user lands in the app before we ask.
      // While onboarding is incomplete the flow owns push priming (it has a
      // dedicated step) — the global sheet must not pop over the first session.
      let onboardingDone = false;
      try { onboardingDone = !!localStorage.getItem("w_onboarding_done"); } catch { /* noop */ }
      if (!onboardingDone) return;
      let snoozedAt = 0;
      try { snoozedAt = Number(localStorage.getItem(PRIMING_DISMISS_KEY) ?? 0); } catch { /* noop */ }
      if (Date.now() - snoozedAt > REPRIME_AFTER_MS) {
        primeTimer = setTimeout(() => { if (!cancelled) setNeedsPriming(true); }, 3500);
      }
    })();

    return () => {
      cancelled = true;
      if (primeTimer) clearTimeout(primeTimer);
      // Remove ONLY the listeners we added (not a global wipe), and reset so a
      // remount can re-activate cleanly.
      handlesRef.current.forEach((h) => { void h.remove(); });
      handlesRef.current = [];
      activatedRef.current = false;
    };
    // Key on user?.id — supabase emits a fresh user object hourly on
    // TOKEN_REFRESHED; without this the whole register/listener cycle churned
    // every hour, dropping a notification tap that landed mid-teardown.
  }, [user?.id, activate]);

  return { needsPriming, enablePush, dismissPriming, resyncStreakWarning: syncStreakWarning };
};
