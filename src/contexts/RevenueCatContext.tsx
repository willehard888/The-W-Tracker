import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";
import { Purchases as CapPurchases } from "@revenuecat/purchases-capacitor";
import { pushIosDebugLog, updateRevenueCatDebug } from "@/lib/ios-debug";

// ─── Constants ──────────────────────────────────────────
const RC_API_KEY_APPLE = "appl_qgpDFJEtyXTeNTJZxBoHzxzgiTr";
const ELITE_ENTITLEMENT = "The W Tracker Pro";
const APEX_ENTITLEMENT = "apex_subscriber";

const ELITE_PRODUCT_IDS = ["elitemonthly499", "com.app.elitemonthly499"] as const;
const APEX_PRODUCT_IDS = ["apexmonthly1599", "com.app.apexmonthly1599"] as const;
const ALL_PRODUCT_IDS = [...ELITE_PRODUCT_IDS, ...APEX_PRODUCT_IDS] as const;

const PRIMARY_ELITE_PRODUCT_ID = "elitemonthly499";
const PRIMARY_APEX_PRODUCT_ID = "apexmonthly1599";

// ─── Types ──────────────────────────────────────────────
interface RevenueCatContextType {
  rcElite: boolean;
  rcApex: boolean;
  rcLoading: boolean;
  rcReady: boolean;
  monthlyPriceLabel: string | null;
  apexPriceLabel: string | null;
  packages: any[];
  purchase: (pkg: any) => Promise<void>;
  purchaseProduct: (productId: string) => Promise<void>;
  purchaseApex: () => Promise<void>;
  restorePurchases: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(
  undefined,
);

export const useRevenueCat = () => {
  const ctx = useContext(RevenueCatContext);
  if (!ctx)
    throw new Error("useRevenueCat must be used within RevenueCatProvider");
  return ctx;
};

// ─── Helpers ────────────────────────────────────────────

function hasEntitlement(info: any, entitlement: string): boolean {
  return !!info?.entitlements?.active?.[entitlement];
}

function storeProduct(value: any) {
  return value?.product ?? value?.storeProduct ?? value ?? null;
}

function productId(value: any): string | null {
  return value?.identifier ?? value?.productIdentifier ?? value?.id ?? null;
}

function isKnownProductId(id: string | null): boolean {
  return !!id && (ALL_PRODUCT_IDS as readonly string[]).includes(id);
}

function isElitePid(id: string | null): boolean {
  return !!id && (ELITE_PRODUCT_IDS as readonly string[]).includes(id);
}

function isApexPid(id: string | null): boolean {
  return !!id && (APEX_PRODUCT_IDS as readonly string[]).includes(id);
}

function priceLabel(value: any): string | null {
  if (typeof value?.priceString === "string" && value.priceString) return value.priceString;
  if (typeof value?.priceFormatted === "string" && value.priceFormatted) return value.priceFormatted;
  if (typeof value?.price === "number") {
    try {
      return new Intl.NumberFormat("fi-FI", {
        style: "currency",
        currency: value.currencyCode || "EUR",
      }).format(value.price);
    } catch {
      return `${value.price}`;
    }
  }
  return null;
}

function isCancellation(e: any): boolean {
  return e?.code === "1" || e?.code === 1 || !!e?.userCancelled;
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// ─── Provider ───────────────────────────────────────────

export const RevenueCatProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [rcElite, setRcElite] = useState(false);
  const [rcApex, setRcApex] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [rcLoading, setRcLoading] = useState(true);
  const [rcReady, setRcReady] = useState(false);
  const [monthlyPriceLabel, setMonthlyPriceLabel] = useState<string | null>(null);
  const [apexPriceLabel, setApexPriceLabel] = useState<string | null>(null);

  /** Sync subscription flags to database. */
  const syncEntitlements = useCallback(
    async (elite: boolean, apex: boolean) => {
      if (!user) return;
      // Elite covers both; Apex implies elite
      await supabase.rpc("set_elite_status", {
        target_user_id: user.id,
        elite: elite || apex,
      });
      // Apex flag updated via webhook in production; this is a best-effort
      // direct write so the UI reflects state immediately on native devices.
      if (apex) {
        await supabase
          .from("profiles")
          .update({ is_apex_subscriber: true })
          .eq("user_id", user.id);
      }
    },
    [user],
  );

  /** Update entitlement state from RevenueCat customer info. */
  const applyEntitlements = useCallback(
    async (info: any) => {
      const elite = hasEntitlement(info, ELITE_ENTITLEMENT);
      const apex = hasEntitlement(info, APEX_ENTITLEMENT);
      setRcElite(elite || apex);
      setRcApex(apex);
      updateRevenueCatDebug({
        entitlement: apex
          ? APEX_ENTITLEMENT
          : elite
          ? ELITE_ENTITLEMENT
          : null,
      });
      await syncEntitlements(elite, apex);
    },
    [syncEntitlements],
  );

  /** Load product prices for both tiers. */
  const loadPrices = useCallback(async () => {
    try {
      const { products } = await CapPurchases.getProducts({
        productIdentifiers: [...ALL_PRODUCT_IDS],
      });
      const loadedProductIds = (products ?? [])
        .map((x: any) => productId(x))
        .filter((id: string | null): id is string => Boolean(id));

      const eliteP =
        products?.find((x: any) => productId(x) === PRIMARY_ELITE_PRODUCT_ID) ??
        products?.find((x: any) => isElitePid(productId(x)));
      if (eliteP) {
        const label = priceLabel(eliteP);
        if (label) setMonthlyPriceLabel(label);
      }

      const apexP =
        products?.find((x: any) => productId(x) === PRIMARY_APEX_PRODUCT_ID) ??
        products?.find((x: any) => isApexPid(productId(x)));
      if (apexP) {
        const label = priceLabel(apexP);
        if (label) setApexPriceLabel(label);
      }

      updateRevenueCatDebug({
        loadedProductIds,
        monthlyPriceLabel: eliteP ? priceLabel(eliteP) : null,
        lastProductFetchError: null,
      });
      pushIosDebugLog("RevenueCat", "Products loaded", { loadedProductIds });
    } catch (e) {
      console.warn("[RC] Could not load products:", e);
      const message = toMessage(e);
      updateRevenueCatDebug({
        loadedProductIds: [],
        lastProductFetchError: message,
      });
    }
  }, []);

  // ─── Init (native only) ─────────────────────────────
  useEffect(() => {
    if (!user) {
      setRcElite(false);
      setRcApex(false);
      setPackages([]);
      setMonthlyPriceLabel(null);
      setApexPriceLabel(null);
      setRcLoading(false);
      setRcReady(false);
      updateRevenueCatDebug({ appUserId: null, entitlement: null });
      return;
    }

    if (!isNativePlatform()) {
      setRcLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await CapPurchases.configure({ apiKey: RC_API_KEY_APPLE, appUserID: user.id });
        if (cancelled) return;
        setRcReady(true);
        updateRevenueCatDebug({
          appUserId: user.id,
          entitlement: null,
          lastOfferingError: null,
          lastProductFetchError: null,
        });

        const { customerInfo } = await CapPurchases.getCustomerInfo();
        if (cancelled) return;
        await applyEntitlements(customerInfo);

        try {
          const { current } = await CapPurchases.getOfferings();
          if (cancelled) return;
          if (current?.availablePackages) {
            setPackages(current.availablePackages);
          }
        } catch (e) {
          console.log("[RC] No offerings configured:", e);
        }

        await loadPrices();
      } catch (e) {
        console.error("[RC] Init error:", e);
      } finally {
        if (!cancelled) setRcLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, applyEntitlements, loadPrices]);

  // ─── Purchase via package ───────────────────────────
  const purchase = useCallback(
    async (pkg: any) => {
      try {
        const { customerInfo } = await CapPurchases.purchasePackage({ aPackage: pkg });
        await applyEntitlements(customerInfo);
      } catch (e: any) {
        if (isCancellation(e)) return;
        const message = toMessage(e);
        updateRevenueCatDebug({ lastPurchaseError: message });
        throw e;
      }
    },
    [applyEntitlements],
  );

  // ─── Purchase via product ID (fallback) ─────────────
  const purchaseProduct = useCallback(
    async (id: string) => {
      try {
        const fallbackIds = ALL_PRODUCT_IDS.filter((pid) => pid !== id);
        const requestedIds = [id, ...fallbackIds];
        const { products } = await CapPurchases.getProducts({ productIdentifiers: requestedIds });

        const selectedProduct =
          products?.find((p: any) => productId(p) === id) ??
          products?.find((p: any) => isKnownProductId(productId(p))) ??
          null;

        if (!selectedProduct) {
          throw new Error(`Tuotetta "${id}" ei löydy.`);
        }

        const { customerInfo } = await CapPurchases.purchaseStoreProduct({
          product: selectedProduct,
        });
        await applyEntitlements(customerInfo);
      } catch (e: any) {
        if (isCancellation(e)) return;
        const message = toMessage(e);
        updateRevenueCatDebug({ lastPurchaseError: message });
        throw e;
      }
    },
    [applyEntitlements],
  );

  /** Convenience wrapper to purchase Apex Instant. */
  const purchaseApex = useCallback(async () => {
    // Try package first (offering), fall back to direct product
    const apexPkg = packages.find((pkg: any) => {
      const pid = productId(storeProduct(pkg));
      return isApexPid(pid);
    });
    if (apexPkg) {
      await purchase(apexPkg);
    } else {
      await purchaseProduct(PRIMARY_APEX_PRODUCT_ID);
    }
  }, [packages, purchase, purchaseProduct]);

  // ─── Restore ────────────────────────────────────────
  const restorePurchases = useCallback(async () => {
    try {
      const { customerInfo } = await CapPurchases.restorePurchases();
      await applyEntitlements(customerInfo);
    } catch (e) {
      const message = toMessage(e);
      updateRevenueCatDebug({ lastRestoreError: message });
      throw e;
    }
  }, [applyEntitlements]);

  return (
    <RevenueCatContext.Provider
      value={{
        rcElite,
        rcApex,
        rcLoading,
        rcReady,
        monthlyPriceLabel,
        apexPriceLabel,
        packages,
        purchase,
        purchaseProduct,
        purchaseApex,
        restorePurchases,
      }}
    >
      {children}
    </RevenueCatContext.Provider>
  );
};
