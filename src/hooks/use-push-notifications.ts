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

      if (pushPermission.receive === "granted") {
        await PushNotifications.register();

        PushNotifications.addListener("registration", (token) => {
          console.log("Push token:", token.value);
          registerToken(token.value);
        });

        PushNotifications.addListener("registrationError", (err) => {
          console.error("Push registration error:", err);
        });

        PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("Push received:", notification);
        });

        PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          console.log("Push action:", action);
          if (action.notification.data?.route) {
            window.location.href = action.notification.data.route;
          }
        });
      }

      if (localPermissionGranted) {
        await syncStreakWarning();
      }

      LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
        const route = event.notification.extra?.route;
        if (typeof route === "string") {
          window.location.href = route;
        }
      });
    };

    setup();

    return () => {
      PushNotifications.removeAllListeners();
      LocalNotifications.removeAllListeners();
    };
  }, [user, registerToken, syncStreakWarning]);
};
