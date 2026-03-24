import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform, getPlatform } from "@/lib/platform";

// Native SDK
import { Purchases as CapPurchases } from "@revenuecat/purchases-capacitor";

// Web SDK
import { Purchases as WebPurchases } from "@revenuecat/purchases-js";
import type { CustomerInfo as WebCustomerInfo, Package as WebPackage } from "@revenuecat/purchases-js";

const RC_API_KEY_APPLE = "appl_YOUR_REVENUECAT_APPLE_API_KEY"; // Replace with your Apple API key from RevenueCat
const RC_API_KEY_GOOGLE = "goog_YOUR_REVENUECAT_GOOGLE_API_KEY"; // Replace with your Google API key from RevenueCat
const RC_API_KEY_WEB = "test_kCEnAIbFZcOhMhYfZnVXSERwGVp";
const ENTITLEMENT_ID = "The W Tracker Pro";

interface RevenueCatContextType {
  rcElite: boolean;
  packages: any[];
  rcLoading: boolean;
  purchase: (pkg: any) => Promise<void>;
  restorePurchases: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

export const useRevenueCat = () => {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) throw new Error("useRevenueCat must be used within RevenueCatProvider");
  return ctx;
};

export const RevenueCatProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [rcElite, setRcElite] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [rcLoading, setRcLoading] = useState(true);
  const [webInstance, setWebInstance] = useState<WebPurchases | null>(null);

  const syncEliteStatus = useCallback(async (elite: boolean) => {
    if (!user || !elite) return;
    await supabase.from("profiles").update({ is_elite: true }).eq("user_id", user.id);
  }, [user]);

  const checkEntitlements = (entitlements: any) => {
    return !!entitlements?.active?.[ENTITLEMENT_ID];
  };

  // ─── Native init (Capacitor plugin) ───
  const initNative = useCallback(async (userId: string) => {
    try {
      await CapPurchases.configure({
        apiKey: RC_API_KEY_APPLE,
        appUserID: userId,
      });

      const { customerInfo } = await CapPurchases.getCustomerInfo();
      const elite = checkEntitlements(customerInfo.entitlements);
      setRcElite(elite);
      await syncEliteStatus(elite);

      try {
        const offeringsResult = await CapPurchases.getOfferings();
        if (offeringsResult.current) {
          setPackages(offeringsResult.current.availablePackages);
        }
      } catch (e) {
        console.log("No offerings configured yet:", e);
      }
    } catch (e) {
      console.error("RevenueCat native init error:", e);
    } finally {
      setRcLoading(false);
    }
  }, [syncEliteStatus]);

  // ─── Web init (JS SDK) ───
  const initWeb = useCallback(async (userId: string) => {
    try {
      const purchases = WebPurchases.configure(RC_API_KEY_WEB, userId);
      setWebInstance(purchases);

      const info = await purchases.getCustomerInfo();
      const elite = checkEntitlements(info.entitlements);
      setRcElite(elite);
      await syncEliteStatus(elite);

      try {
        const offerings = await purchases.getOfferings();
        if (offerings.current) {
          setPackages(offerings.current.availablePackages);
        }
      } catch (e) {
        console.log("No offerings configured yet:", e);
      }
    } catch (e) {
      console.error("RevenueCat web init error:", e);
    } finally {
      setRcLoading(false);
    }
  }, [syncEliteStatus]);

  useEffect(() => {
    if (!user) {
      setRcElite(false);
      setPackages([]);
      setRcLoading(false);
      setWebInstance(null);
      return;
    }

    if (isNativePlatform()) {
      initNative(user.id);
    } else {
      // Web: skip RC init, Stripe handles payments
      setRcLoading(false);
    }
  }, [user, initNative, initWeb]);

  // ─── Native purchase ───
  const purchaseNative = async (pkg: any) => {
    try {
      const { customerInfo } = await CapPurchases.purchasePackage({ aPackage: pkg });
      const elite = checkEntitlements(customerInfo.entitlements);
      setRcElite(elite);
      await syncEliteStatus(elite);
    } catch (e: any) {
      if (e.code === "1" || e.userCancelled) return; // User cancelled
      throw e;
    }
  };

  // ─── Web purchase ───
  const purchaseWeb = async (pkg: WebPackage) => {
    if (!webInstance) return;
    try {
      const { customerInfo } = await webInstance.purchase({ rcPackage: pkg });
      const elite = checkEntitlements(customerInfo.entitlements);
      setRcElite(elite);
      await syncEliteStatus(elite);
    } catch (e: any) {
      if (e.userCancelled) return;
      throw e;
    }
  };

  const purchase = async (pkg: any) => {
    if (isNativePlatform()) {
      await purchaseNative(pkg);
    } else {
      await purchaseWeb(pkg);
    }
  };

  const restorePurchases = async () => {
    try {
      if (isNativePlatform()) {
        const { customerInfo } = await CapPurchases.restorePurchases();
        const elite = checkEntitlements(customerInfo.entitlements);
        setRcElite(elite);
        await syncEliteStatus(elite);
      } else if (webInstance) {
        const info = await webInstance.getCustomerInfo();
        const elite = checkEntitlements(info.entitlements);
        setRcElite(elite);
        await syncEliteStatus(elite);
      }
    } catch (e) {
      console.error("Restore purchases error:", e);
      throw e;
    }
  };

  return (
    <RevenueCatContext.Provider value={{ rcElite, packages, rcLoading, purchase, restorePurchases }}>
      {children}
    </RevenueCatContext.Provider>
  );
};
