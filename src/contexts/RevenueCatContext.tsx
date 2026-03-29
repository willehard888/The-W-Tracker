import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";

// Native SDK (iOS)
import { Purchases as CapPurchases } from "@revenuecat/purchases-capacitor";

const RC_API_KEY_APPLE = "appl_qgpDFJEtyXTeNTJZxBoHzxzgiTr";
const ENTITLEMENT_ID = "The W Tracker Pro";

interface RevenueCatContextType {
  rcElite: boolean;
  packages: any[];
  rcLoading: boolean;
  rcReady: boolean;
  purchase: (pkg: any) => Promise<void>;
  purchaseProduct: (productId: string) => Promise<void>;
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
  const [rcReady, setRcReady] = useState(false);

  const syncEliteStatus = useCallback(async (elite: boolean) => {
    if (!user || !elite) return;
    await supabase.from("profiles").update({ is_elite: true }).eq("user_id", user.id);
  }, [user]);

  const checkEntitlements = (entitlements: any) => {
    return !!entitlements?.active?.[ENTITLEMENT_ID];
  };

  // ─── Native init (iOS Capacitor plugin) ───
  const initNative = useCallback(async (userId: string) => {
    try {
      await CapPurchases.configure({
        apiKey: RC_API_KEY_APPLE,
        appUserID: userId,
      });
      setRcReady(true);

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
        console.log("No offerings configured yet — purchaseProduct will be used:", e);
      }
    } catch (e) {
      console.error("RevenueCat native init error:", e);
    } finally {
      setRcLoading(false);
    }
  }, [syncEliteStatus]);

  useEffect(() => {
    if (!user) {
      setRcElite(false);
      setPackages([]);
      setRcLoading(false);
      setRcReady(false);
      return;
    }

    if (isNativePlatform()) {
      initNative(user.id);
    } else {
      setRcLoading(false);
    }
  }, [user, initNative]);

  // ─── Purchase via package (if offerings loaded) ───
  const purchase = async (pkg: any) => {
    try {
      console.log("Starting purchase for package:", pkg.identifier);
      const { customerInfo } = await CapPurchases.purchasePackage({ aPackage: pkg });
      console.log("Purchase completed, entitlements:", JSON.stringify(customerInfo.entitlements));
      const elite = checkEntitlements(customerInfo.entitlements);
      setRcElite(elite);
      await syncEliteStatus(elite);
    } catch (e: any) {
      console.error("Purchase error:", JSON.stringify(e));
      if (e.code === "1" || e.code === 1 || e.userCancelled) return;
      throw e;
    }
  };

  // ─── Purchase directly by product ID (fallback when no offerings) ───
  const purchaseProduct = async (productId: string) => {
    try {
      console.log("Purchasing product by ID:", productId);
      const { products } = await CapPurchases.getProducts({ productIdentifiers: [productId] });
      if (!products || products.length === 0) {
        throw new Error(`Product "${productId}" not found in App Store. Make sure the product is created in App Store Connect with status "Ready to Submit" and added to RevenueCat.`);
      }
      const { customerInfo } = await CapPurchases.purchaseStoreProduct({ product: products[0] });
      console.log("Purchase completed, entitlements:", JSON.stringify(customerInfo.entitlements));
      const elite = checkEntitlements(customerInfo.entitlements);
      setRcElite(elite);
      await syncEliteStatus(elite);
    } catch (e: any) {
      console.error("Purchase product error:", JSON.stringify(e));
      if (e.code === "1" || e.code === 1 || e.userCancelled) return;
      throw e;
    }
  };

  const restorePurchases = async () => {
    try {
      const { customerInfo } = await CapPurchases.restorePurchases();
      const elite = checkEntitlements(customerInfo.entitlements);
      setRcElite(elite);
      await syncEliteStatus(elite);
    } catch (e) {
      console.error("Restore purchases error:", e);
      throw e;
    }
  };

  return (
    <RevenueCatContext.Provider value={{ rcElite, packages, rcLoading, rcReady, purchase, purchaseProduct, restorePurchases }}>
      {children}
    </RevenueCatContext.Provider>
  );
};
