import { useEffect, useCallback, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  requestStreakNotificationPermission,
  syncStreakWarningNotification,
} from "@/lib/streak-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";

// Whitelisted in-app routes that notifications may navigate to. Anything
// outside this list is silently ignored — defends against a payload trying to
// open external URLs / arbitrary attacker-controlled destinations.
const SAFE_ROUTES = new Set<string>([
  "/", "/checkin", "/feed", "/tribes", "/messages",
  "/leaderboard", "/battles", "/profile", "/coach",
  "/coach/library", "/coach/habits", "/coach/program",
  "/coach/memory", "/coach/goal", "/coach/reflect",
  "/coach/progress", "/coach/profile",
]);
const SAFE_PREFIXES = ["/briefing/", "/chat/", "/tribes/", "/user/"];
const isSafeRoute = (r: unknown): r is string => {
  if (typeof r !== "string" || !r.startsWith("/")) return false;
  if (SAFE_ROUTES.has(r)) return true;
  return SAFE_PREFIXES.some((p) => r.startsWith(p));
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
}

export const usePushNotifications = (): PushNotificationState => {
  const { user } = useAuth();
  const [needsPriming, setNeedsPriming] = useState(false);
  const activatedRef = useRef(false);

  const syncStreakWarning = useCallback(async () => {
    if (!user) return;
    const [{ data: lastCheckin }, { data: profile }] = await Promise.all([
      supabase.from("daily_checkins").select("checked_in_at")
        .eq("user_id", user.id).order("checked_in_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("profiles").select("streak").eq("user_id", user.id).maybeSingle(),
    ]);
    await syncStreakWarningNotification({
      lastCheckinAt: lastCheckin?.checked_in_at ?? null,
      streak: profile?.streak ?? 0,
    });
  }, [user]);

  const registerToken = useCallback(async (token: string) => {
    if (!user) return;
    const platform = Capacitor.getPlatform();
    await supabase.from("push_tokens").upsert(
      { user_id: user.id, token, platform },
      { onConflict: "user_id,token" },
    );
  }, [user]);

  // Register for pushes + wire navigation listeners. Idempotent (guarded by
  // activatedRef) so it can run either when permission is already granted on
  // mount, or right after the user grants it via the priming sheet.
  const activate = useCallback(async () => {
    if (activatedRef.current) return;
    activatedRef.current = true;

    await PushNotifications.register();
    PushNotifications.addListener("registration", (token) => registerToken(token.value));
    PushNotifications.addListener("registrationError", (err) => console.error("Push registration error:", err));
    PushNotifications.addListener("pushNotificationReceived", () => { /* foreground: OS shows it */ });
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const route = action.notification.data?.route;
      safeNavigate(typeof route === "string" ? route : "");
    });

    LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
      const route = event.notification.extra?.route;
      safeNavigate(typeof route === "string" ? route : "");
    });

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
      let snoozedAt = 0;
      try { snoozedAt = Number(localStorage.getItem(PRIMING_DISMISS_KEY) ?? 0); } catch { /* noop */ }
      if (Date.now() - snoozedAt > REPRIME_AFTER_MS) {
        primeTimer = setTimeout(() => { if (!cancelled) setNeedsPriming(true); }, 3500);
      }
    })();

    return () => {
      cancelled = true;
      if (primeTimer) clearTimeout(primeTimer);
      PushNotifications.removeAllListeners();
      LocalNotifications.removeAllListeners();
      activatedRef.current = false;
    };
  }, [user, activate]);

  return { needsPriming, enablePush, dismissPriming };
};
