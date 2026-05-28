import { useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  requestStreakNotificationPermission,
  syncStreakWarningNotification,
} from "@/lib/streak-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";

export const usePushNotifications = () => {
  const { user } = useAuth();

  const syncStreakWarning = useCallback(async () => {
    if (!user) return;

    const [{ data: lastCheckin }, { data: profile }] = await Promise.all([
      supabase
        .from("daily_checkins")
        .select("checked_in_at")
        .eq("user_id", user.id)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("streak")
        .eq("user_id", user.id)
        .maybeSingle(),
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
      { onConflict: "user_id,token" }
    );
  }, [user]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;

    const setup = async () => {
      const [pushPermission, localPermissionGranted] = await Promise.all([
        PushNotifications.requestPermissions(),
        requestStreakNotificationPermission(),
      ]);

      // Whitelisted in-app routes that notifications may navigate to.
      // Anything outside this list is silently ignored — defends against
      // a notification payload trying to open external URLs / arbitrary
      // attacker-controlled destinations.
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
      // Use history.pushState so React Router picks up the change instead
      // of a full-page reload (window.location.href reboots the WebView).
      const safeNavigate = (route: string) => {
        if (!isSafeRoute(route)) return;
        window.history.pushState({}, "", route);
        window.dispatchEvent(new PopStateEvent("popstate"));
      };

      if (pushPermission.receive === "granted") {
        await PushNotifications.register();

        PushNotifications.addListener("registration", (token) => {
          registerToken(token.value);
        });

        PushNotifications.addListener("registrationError", (err) => {
          console.error("Push registration error:", err);
        });

        PushNotifications.addListener("pushNotificationReceived", () => {
          // Foreground delivery — no-op. The native push payload is shown
          // to the user automatically when the app is backgrounded.
        });

        PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const route = action.notification.data?.route;
          safeNavigate(typeof route === "string" ? route : "");
        });
      }

      if (localPermissionGranted) {
        await syncStreakWarning();
      }

      LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
        const route = event.notification.extra?.route;
        safeNavigate(typeof route === "string" ? route : "");
      });
    };

    setup();

    return () => {
      PushNotifications.removeAllListeners();
      LocalNotifications.removeAllListeners();
    };
  }, [user, registerToken, syncStreakWarning]);
};
