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
const PREMIUM_ENTITLEMENT = "premium";

// Monthly products
const ELITE_PRODUCT_IDS = ["elitemonthly499", "com.app.elitemonthly499"] as const;
// Premium replaces Apex purchase. Existing Apex product IDs are kept as
// fallback so legacy subscribers keep working seamlessly.
const PREMIUM_PRODUCT_IDS = [
  "premiummonthly1799",
  "com.app.premiummonthly1799",
  "Apex888",
  "com.app.Apex888",
  "apexmonthly1599",
  "com.app.apexmonthly1599",
] as const;
const APEX_PRODUCT_IDS = ["Apex888", "com.app.Apex888", "apexmonthly1599", "com.app.apexmonthly1599"] as const;

// Yearly products. Update IDs in App Store Connect to match.
const ELITE_YEARLY_PRODUCT_IDS = ["eliteyearly4999", "com.app.eliteyearly4999"] as const;
const PREMIUM_YEARLY_PRODUCT_IDS = [
  "premiumyearly17299",
  "com.app.premiumyearly17299",
  "apexyearly17299",
  "com.app.apexyearly17299",
] as const;
const APEX_YEARLY_PRODUCT_IDS = ["apexyearly17299", "com.app.apexyearly17299"] as const;

const ALL_PRODUCT_IDS = [
  ...ELITE_PRODUCT_IDS,
  ...PREMIUM_PRODUCT_IDS,
  ...APEX_PRODUCT_IDS,
  ...ELITE_YEARLY_PRODUCT_IDS,
  ...PREMIUM_YEARLY_PRODUCT_IDS,
  ...APEX_YEARLY_PRODUCT_IDS,
] as const;

const PRIMARY_ELITE_PRODUCT_ID = "elitemonthly499";
const PRIMARY_PREMIUM_PRODUCT_ID = "premiummonthly1799";
const PRIMARY_APEX_PRODUCT_ID = "Apex888";
const PRIMARY_ELITE_YEARLY_PRODUCT_ID = "eliteyearly4999";
const PRIMARY_PREMIUM_YEARLY_PRODUCT_ID = "premiumyearly17299";
const PRIMARY_APEX_YEARLY_PRODUCT_ID = "apexyearly17299";

// ─── Types ──────────────────────────────────────────────
interface RevenueCatContextType {
  rcElite: boolean;
  rcApex: boolean;
  rcPremium: boolean;
  rcLoading: boolean;
  rcReady: boolean;
  monthlyPriceLabel: string | null;
  apexPriceLabel: string | null;
  premiumPriceLabel: string | null;
  eliteYearlyPriceLabel: string | null;
  apexYearlyPriceLabel: string | null;
  premiumYearlyPriceLabel: string | null;
  packages: any[];
  purchase: (pkg: any) => Promise<void>;
  purchaseProduct: (productId: string) => Promise<void>;
  /** @deprecated Use purchasePremiumPlan instead. */
  purchaseApex: () => Promise<void>;
  purchaseElitePlan: (plan: "monthly" | "yearly") => Promise<void>;
  /** @deprecated Use purchasePremiumPlan instead. */
  purchaseApexPlan: (plan: "monthly" | "yearly") => Promise<void>;
  purchasePremiumPlan: (plan: "monthly" | "yearly") => Promise<void>;
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

function isEliteYearlyPid(id: string | null): boolean {
  return !!id && (ELITE_YEARLY_PRODUCT_IDS as readonly string[]).includes(id);
}

function isPremiumPid(id: string | null): boolean {
  return !!id && (PREMIUM_PRODUCT_IDS as readonly string[]).includes(id);
}

function isPremiumYearlyPid(id: string | null): boolean {
  return !!id && (PREMIUM_YEARLY_PRODUCT_IDS as readonly string[]).includes(id);
}

function isApexYearlyPid(id: string | null): boolean {
  return !!id && (APEX_YEARLY_PRODUCT_IDS as readonly string[]).includes(id);
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
  const [rcPremium, setRcPremium] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [rcLoading, setRcLoading] = useState(true);
  const [rcReady, setRcReady] = useState(false);
  const [monthlyPriceLabel, setMonthlyPriceLabel] = useState<string | null>(null);
  const [apexPriceLabel, setApexPriceLabel] = useState<string | null>(null);
  const [premiumPriceLabel, setPremiumPriceLabel] = useState<string | null>(null);
  const [eliteYearlyPriceLabel, setEliteYearlyPriceLabel] = useState<string | null>(null);
  const [apexYearlyPriceLabel, setApexYearlyPriceLabel] = useState<string | null>(null);
  const [premiumYearlyPriceLabel, setPremiumYearlyPriceLabel] = useState<string | null>(null);

  /** Sync subscription flags to database. */
  const syncEntitlements = useCallback(
    async (elite: boolean, apex: boolean, premium: boolean) => {
      if (!user) return;
      const grantElite = elite || apex || premium;
      // set_elite_status now also flips is_premium server-side.
      await supabase.rpc("set_elite_status", {
        target_user_id: user.id,
        elite: grantElite,
      });
      const update: Record<string, any> = {};
      if (apex) update.is_apex_subscriber = true;
      if (premium || apex || elite) update.is_premium = true;
      if (Object.keys(update).length > 0) {
        await supabase
          .from("profiles")
          .update(update)
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
      const premium = hasEntitlement(info, PREMIUM_ENTITLEMENT);
      setRcElite(elite || apex || premium);
      setRcApex(apex);
      setRcPremium(premium || apex);
      updateRevenueCatDebug({
        entitlement: premium
          ? PREMIUM_ENTITLEMENT
          : apex
          ? APEX_ENTITLEMENT
          : elite
          ? ELITE_ENTITLEMENT
          : null,
      });
      await syncEntitlements(elite, apex, premium);
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

      const eliteYearlyP =
        products?.find((x: any) => productId(x) === PRIMARY_ELITE_YEARLY_PRODUCT_ID) ??
        products?.find((x: any) => isEliteYearlyPid(productId(x)));
      if (eliteYearlyP) {
        const label = priceLabel(eliteYearlyP);
        if (label) setEliteYearlyPriceLabel(label);
      }

      const apexYearlyP =
        products?.find((x: any) => productId(x) === PRIMARY_APEX_YEARLY_PRODUCT_ID) ??
        products?.find((x: any) => isApexYearlyPid(productId(x)));
      if (apexYearlyP) {
        const label = priceLabel(apexYearlyP);
        if (label) setApexYearlyPriceLabel(label);
      }

      const premiumP =
        products?.find((x: any) => productId(x) === PRIMARY_PREMIUM_PRODUCT_ID) ??
        products?.find((x: any) => isPremiumPid(productId(x)));
      if (premiumP) {
        const label = priceLabel(premiumP);
        if (label) setPremiumPriceLabel(label);
      }

      const premiumYearlyP =
        products?.find((x: any) => productId(x) === PRIMARY_PREMIUM_YEARLY_PRODUCT_ID) ??
        products?.find((x: any) => isPremiumYearlyPid(productId(x)));
      if (premiumYearlyP) {
        const label = priceLabel(premiumYearlyP);
        if (label) setPremiumYearlyPriceLabel(label);
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
      setEliteYearlyPriceLabel(null);
      setApexYearlyPriceLabel(null);
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

  /** Convenience wrapper to purchase Apex Instant (monthly default). */
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

  /** Purchase Elite tier with selectable billing plan. */
  const purchaseElitePlan = useCallback(
    async (plan: "monthly" | "yearly") => {
      const targetId =
        plan === "yearly" ? PRIMARY_ELITE_YEARLY_PRODUCT_ID : PRIMARY_ELITE_PRODUCT_ID;
      const matcher = plan === "yearly" ? isEliteYearlyPid : isElitePid;
      const pkg = packages.find((p: any) => {
        const pid = productId(storeProduct(p));
        return pid === targetId || matcher(pid);
      });
      if (pkg) {
        await purchase(pkg);
      } else {
        await purchaseProduct(targetId);
      }
    },
    [packages, purchase, purchaseProduct],
  );

  /** Purchase Apex tier with selectable billing plan. */
  const purchaseApexPlan = useCallback(
    async (plan: "monthly" | "yearly") => {
      const targetId =
        plan === "yearly" ? PRIMARY_APEX_YEARLY_PRODUCT_ID : PRIMARY_APEX_PRODUCT_ID;
      const matcher = plan === "yearly" ? isApexYearlyPid : isApexPid;
      const pkg = packages.find((p: any) => {
        const pid = productId(storeProduct(p));
        return pid === targetId || matcher(pid);
      });
      if (pkg) {
        await purchase(pkg);
      } else {
        await purchaseProduct(targetId);
      }
    },
    [packages, purchase, purchaseProduct],
  );

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
        eliteYearlyPriceLabel,
        apexYearlyPriceLabel,
        packages,
        purchase,
        purchaseProduct,
        purchaseApex,
        purchaseElitePlan,
        purchaseApexPlan,
        restorePurchases,
      }}
    >
      {children}
    </RevenueCatContext.Provider>
  );
};
