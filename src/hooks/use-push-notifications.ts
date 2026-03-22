import { useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const usePushNotifications = () => {
  const { user } = useAuth();

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
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== "granted") return;

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
        // Navigate to check-in when notification is tapped
        if (action.notification.data?.route) {
          window.location.href = action.notification.data.route;
        }
      });
    };

    setup();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [user, registerToken]);
};
