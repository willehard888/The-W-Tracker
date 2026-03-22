import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Purchases } from "@revenuecat/purchases-js";
import type { CustomerInfo, Package } from "@revenuecat/purchases-js";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";

const RC_API_KEY = "test_kCEnAIbFZcOhMhYfZnVXSERwGVp";
const ENTITLEMENT_ID = "The W Tracker Pro";

interface RevenueCatContextType {
  isElite: boolean;
  customerInfo: CustomerInfo | null;
  packages: Package[];
  loading: boolean;
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
  const [loading, setLoading] = useState(true);
  const [purchasesInstance, setPurchasesInstance] = useState<Purchases | null>(null);

  const isElite = !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];

  // Sync elite status to Supabase profile — only SET to true, never reset to false
  // (Stripe webhook may have set elite independently)
  const syncEliteStatus = useCallback(async (elite: boolean) => {
    if (!user) return;
    if (elite) {
      await supabase
        .from("profiles")
        .update({ is_elite: true })
        .eq("user_id", user.id);
    }
    // Don't set is_elite: false — Stripe may have granted it separately
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCustomerInfo(null);
      setPackages([]);
      setLoading(false);
      setPurchasesInstance(null);
      return;
    }

    const init = async () => {
      try {
        const purchases = Purchases.configure(RC_API_KEY, user.id);
        setPurchasesInstance(purchases);

        const info = await purchases.getCustomerInfo();
        setCustomerInfo(info);

        const hasElite = !!info.entitlements?.active?.[ENTITLEMENT_ID];
        await syncEliteStatus(hasElite);

        try {
          const offerings = await purchases.getOfferings();
          const current = offerings.current;
          if (current) {
            setPackages(current.availablePackages);
          }
        } catch (e) {
          console.log("No offerings configured yet:", e);
        }
      } catch (e) {
        console.error("RevenueCat init error:", e);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [user, syncEliteStatus]);

  const purchase = async (pkg: Package) => {
    if (!purchasesInstance) return;
    try {
      const { customerInfo: updatedInfo } = await purchasesInstance.purchase({ rcPackage: pkg });
      setCustomerInfo(updatedInfo);
      const hasElite = !!updatedInfo.entitlements?.active?.[ENTITLEMENT_ID];
      await syncEliteStatus(hasElite);
    } catch (e: any) {
      if (e.userCancelled) return;
      throw e;
    }
  };

  const restorePurchases = async () => {
    if (!purchasesInstance) return;
    const info = await purchasesInstance.getCustomerInfo();
    setCustomerInfo(info);
    const hasElite = !!info.entitlements?.active?.[ENTITLEMENT_ID];
    await syncEliteStatus(hasElite);
  };

  return (
    <RevenueCatContext.Provider value={{ isElite, customerInfo, packages, loading, purchase, restorePurchases }}>
      {children}
    </RevenueCatContext.Provider>
  );
};
