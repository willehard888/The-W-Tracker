import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Purchases } from "@revenuecat/purchases-js";
import type { CustomerInfo, Package } from "@revenuecat/purchases-js";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";

const RC_API_KEY = "test_kCEnAIbFZcOhMhYfZnVXSERwGVp";
const ENTITLEMENT_ID = "The W Tracker Pro";

interface RevenueCatContextType {
  rcElite: boolean;
  packages: Package[];
  rcLoading: boolean;
  purchase: (pkg: Package) => Promise<void>;
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
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [rcLoading, setRcLoading] = useState(true);
  const [purchasesInstance, setPurchasesInstance] = useState<Purchases | null>(null);

  const rcElite = !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];

  const syncEliteStatus = useCallback(async (elite: boolean) => {
    if (!user || !elite) return;
    await supabase.from("profiles").update({ is_elite: true }).eq("user_id", user.id);
  }, [user]);

  useEffect(() => {
    // Only initialize RevenueCat on native platforms
    if (!isNativePlatform()) {
      setRcLoading(false);
      return;
    }

    if (!user) {
      setCustomerInfo(null);
      setPackages([]);
      setRcLoading(false);
      setPurchasesInstance(null);
      return;
    }

    const init = async () => {
      try {
        const purchases = Purchases.configure(RC_API_KEY, user.id);
        setPurchasesInstance(purchases);

        const info = await purchases.getCustomerInfo();
        setCustomerInfo(info);
        await syncEliteStatus(!!info.entitlements?.active?.[ENTITLEMENT_ID]);

        try {
          const offerings = await purchases.getOfferings();
          if (offerings.current) {
            setPackages(offerings.current.availablePackages);
          }
        } catch (e) {
          console.log("No offerings configured yet:", e);
        }
      } catch (e) {
        console.error("RevenueCat init error:", e);
      } finally {
        setRcLoading(false);
      }
    };

    init();
  }, [user, syncEliteStatus]);

  const purchase = async (pkg: Package) => {
    if (!purchasesInstance) return;
    try {
      const { customerInfo: updatedInfo } = await purchasesInstance.purchase({ rcPackage: pkg });
      setCustomerInfo(updatedInfo);
      await syncEliteStatus(!!updatedInfo.entitlements?.active?.[ENTITLEMENT_ID]);
    } catch (e: any) {
      if (e.userCancelled) return;
      throw e;
    }
  };

  const restorePurchases = async () => {
    if (!purchasesInstance) return;
    const info = await purchasesInstance.getCustomerInfo();
    setCustomerInfo(info);
    await syncEliteStatus(!!info.entitlements?.active?.[ENTITLEMENT_ID]);
  };

  return (
    <RevenueCatContext.Provider value={{ rcElite, packages, rcLoading, purchase, restorePurchases }}>
      {children}
    </RevenueCatContext.Provider>
  );
};
