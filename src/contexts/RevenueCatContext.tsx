import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";

// Native SDK (iOS)
import { Purchases as CapPurchases } from "@revenuecat/purchases-capacitor";

const RC_API_KEY_APPLE = "appl_qgpDFJEtyXTeNTJZxBoHzxzgiTr";
const ENTITLEMENT_ID = "The W Tracker Pro";
const MONTHLY_PRODUCT_ID = "elitemonthly499";

interface RevenueCatContextType {
  rcElite: boolean;
  packages: any[];
  rcLoading: boolean;
  rcReady: boolean;
  monthlyPriceLabel: string | null;
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
  const [monthlyPriceLabel, setMonthlyPriceLabel] = useState<string | null>(null);
  const displayedPriceRef = useRef<string | null>(null);

  const syncEliteStatus = useCallback(async (elite: boolean) => {
    if (!user || !elite) return;
    await supabase.from("profiles").update({ is_elite: true }).eq("user_id", user.id);
  }, [user]);

  const checkEntitlements = (entitlements: any) => {
    return !!entitlements?.active?.[ENTITLEMENT_ID];
  };

  const getStoreProduct = useCallback((value: any) => {
    return value?.product ?? value?.storeProduct ?? value ?? null;
  }, []);

  const getProductIdentifier = useCallback((value: any) => {
    return value?.identifier ?? value?.productIdentifier ?? value?.id ?? null;
  }, []);

  const getProductPriceLabel = useCallback((value: any) => {
    if (typeof value?.priceString === "string" && value.priceString.length > 0) return value.priceString;
    if (typeof value?.priceFormatted === "string" && value.priceFormatted.length > 0) return value.priceFormatted;
    if (typeof value?.price === "number") {
      try {
        return new Intl.NumberFormat("fi-FI", {
          style: "currency",
          currency: value?.currencyCode || "EUR",
        }).format(value.price);
      } catch {
        return `${value.price}`;
      }
    }
    return null;
  }, []);

  const syncDisplayedProduct = useCallback((value: any) => {
    const product = getStoreProduct(value);
    const productId = getProductIdentifier(product);
    const priceLabel = getProductPriceLabel(product);

    if (!productId && !priceLabel) return;

    console.log("[RC] Active store product:", JSON.stringify({ productId, priceLabel }));

    if (priceLabel && displayedPriceRef.current !== priceLabel) {
      displayedPriceRef.current = priceLabel;
      setMonthlyPriceLabel(priceLabel);
    }
  }, [getProductIdentifier, getProductPriceLabel, getStoreProduct]);

  const isMatchingMonthlyPackage = useCallback((pkg: any) => {
    const product = getStoreProduct(pkg);
    const productId = getProductIdentifier(product);

    return (
      pkg?.identifier === "$rc_monthly" ||
      pkg?.identifier === "monthly" ||
      productId === MONTHLY_PRODUCT_ID
    );
  }, [getProductIdentifier, getStoreProduct]);

  const preloadMonthlyProduct = useCallback(async () => {
    try {
      const { products } = await CapPurchases.getProducts({ productIdentifiers: [MONTHLY_PRODUCT_ID] });
      console.log(
        "[RC] Direct products:",
        JSON.stringify(
          (products || []).map((product: any) => ({
            identifier: getProductIdentifier(product),
            priceLabel: getProductPriceLabel(product),
          }))
        )
      );

      if (products?.[0]) {
        syncDisplayedProduct(products[0]);
      }
    } catch (e) {
      console.warn("[RC] Direct product preload failed:", e);
    }
  }, [getProductIdentifier, getProductPriceLabel, syncDisplayedProduct]);

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
          const availablePackages = offeringsResult.current.availablePackages;
          setPackages(availablePackages);

          console.log(
            "[RC] Available packages:",
            JSON.stringify(
              availablePackages.map((pkg: any) => ({
                identifier: pkg?.identifier,
                productId: getProductIdentifier(getStoreProduct(pkg)),
                priceLabel: getProductPriceLabel(getStoreProduct(pkg)),
              }))
            )
          );

          const monthlyPkg = availablePackages.find(isMatchingMonthlyPackage);
          if (monthlyPkg) {
            syncDisplayedProduct(monthlyPkg);
          }
        }

        if (!displayedPriceRef.current) {
          await preloadMonthlyProduct();
        }
      } catch (e) {
        console.log("No offerings configured yet — purchaseProduct will be used:", e);
        await preloadMonthlyProduct();
      }
    } catch (e) {
      console.error("RevenueCat native init error:", e);
    } finally {
      setRcLoading(false);
    }
  }, [getProductIdentifier, getProductPriceLabel, getStoreProduct, isMatchingMonthlyPackage, preloadMonthlyProduct, syncDisplayedProduct, syncEliteStatus]);

  useEffect(() => {
    if (!user) {
      setRcElite(false);
      setPackages([]);
      setMonthlyPriceLabel(null);
      displayedPriceRef.current = null;
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
      syncDisplayedProduct(pkg);
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
      console.log("[RC] Fetching product by ID:", productId);
      const { products } = await CapPurchases.getProducts({ productIdentifiers: [productId] });
      console.log("[RC] Products returned:", JSON.stringify(products));
      
      if (!products || products.length === 0) {
        // Try alternate product ID formats
        const altIds = [`${productId}`, `com.app.${productId}`, `app.lovable.wtracker.${productId}`];
        console.log("[RC] Primary product not found, trying alternates:", altIds);
        
        for (const altId of altIds) {
          try {
            const altResult = await CapPurchases.getProducts({ productIdentifiers: [altId] });
            if (altResult.products?.length > 0) {
              console.log("[RC] Found product with alt ID:", altId);
              syncDisplayedProduct(altResult.products[0]);
              const { customerInfo } = await CapPurchases.purchaseStoreProduct({ product: altResult.products[0] });
              const elite = checkEntitlements(customerInfo.entitlements);
              setRcElite(elite);
              await syncEliteStatus(elite);
              return;
            }
          } catch { /* skip */ }
        }
        
        throw new Error(`Tuotetta "${productId}" ei löydy App Storesta. Varmista että tuote on luotu App Store Connectiin ja lisätty RevenueCatiin.`);
      }
      
      syncDisplayedProduct(products[0]);
      const { customerInfo } = await CapPurchases.purchaseStoreProduct({ product: products[0] });
      console.log("[RC] Purchase completed, entitlements:", JSON.stringify(customerInfo.entitlements));
      const elite = checkEntitlements(customerInfo.entitlements);
      setRcElite(elite);
      await syncEliteStatus(elite);
    } catch (e: any) {
      console.error("[RC] Purchase product error:", JSON.stringify(e));
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
    <RevenueCatContext.Provider value={{ rcElite, packages, rcLoading, rcReady, monthlyPriceLabel, purchase, purchaseProduct, restorePurchases }}>
      {children}
    </RevenueCatContext.Provider>
  );
};
