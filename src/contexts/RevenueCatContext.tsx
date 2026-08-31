import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";
import { Purchases as CapPurchases } from "@revenuecat/purchases-capacitor";
import { pushIosDebugLog, updateRevenueCatDebug } from "@/lib/ios-debug";
import { toast } from "sonner";

// ─── Constants ──────────────────────────────────────────
const RC_API_KEY_APPLE = "appl_qgpDFJEtyXTeNTJZxBoHzxzgiTr";
const ENTITLEMENT = "The W Tracker Pro";
// Must match the App Store Connect product + the revenuecat-webhook
// PREMIUM_PRODUCT_IDS.
//
// The list price is now 8,99 €/mo. The trailing digits in these ids encode the
// OLD price, which leaves two valid store configurations — both are accepted
// here so the app works either way:
//   a) keep the existing WhealthFactory499 product and change its price in
//      App Store Connect (no migration for existing subscribers; the id just
//      reads as a misnomer forever), or
//   b) create WhealthFactory899 and make it the offering's monthly package.
// If you take (b), move PRIMARY_PRODUCT_ID to it as well. PRIMARY is only the
// direct-purchase fallback for when no offering package resolves.
const PRODUCT_IDS = [
  "WhealthFactory899", "com.app.WhealthFactory899",
  "WhealthFactory499", "com.app.WhealthFactory499",
  "elitemonthly499", "com.app.elitemonthly499",
] as const;
const PRIMARY_PRODUCT_ID = "WhealthFactory499";

// ─── Types ──────────────────────────────────────────────
interface RevenueCatContextType {
  rcElite: boolean;
  rcLoading: boolean;
  rcReady: boolean;
  monthlyPriceLabel: string | null;
  yearlyPriceLabel: string | null;
  /** True only when the store actually has an annual package available. */
  yearlyAvailable: boolean;
  packages: any[];
  purchase: (pkg: any) => Promise<void>;
  purchaseProduct: (productId: string) => Promise<void>;
  /**
   * Purchase the Premium plan for the requested billing cadence.
   * Honors an annual offering package when one exists; otherwise falls back
   * to the directly-configured monthly product.
   */
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

const ELITE_CACHE_PREFIX = "rc_elite_v1_";

/** Last-known entitlement state, per user, to avoid a paywall flash on cold
 *  start before the live RevenueCat check resolves. */
function readEliteCache(userId: string): boolean {
  try {
    return localStorage.getItem(ELITE_CACHE_PREFIX + userId) === "1";
  } catch {
    return false;
  }
}

function writeEliteCache(userId: string, elite: boolean): void {
  try {
    localStorage.setItem(ELITE_CACHE_PREFIX + userId, elite ? "1" : "0");
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/** Run an async op with a few backoff retries (transient store/network blips). */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts) await new Promise((r) => setTimeout(r, i * 800));
    }
  }
  throw lastErr;
}

/** Check whether a customerInfo has our entitlement active. */
function hasElite(info: any): boolean {
  return !!info?.entitlements?.active?.[ENTITLEMENT];
}

/** Unwrap the store product from a package or raw product. */
function storeProduct(value: any) {
  return value?.product ?? value?.storeProduct ?? value ?? null;
}

/** Get the product identifier string. */
function productId(value: any): string | null {
  return value?.identifier ?? value?.productIdentifier ?? value?.id ?? null;
}

function isKnownMonthlyId(id: string | null): boolean {
  return !!id && PRODUCT_IDS.includes(id as (typeof PRODUCT_IDS)[number]);
}

/** Get a formatted price string. */
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

/** True when product matches our monthly subscription. */
function isMonthly(value: any): boolean {
  return isKnownMonthlyId(productId(storeProduct(value)));
}

/** True when a package looks like an annual/yearly subscription. */
function isAnnualPackage(pkg: any): boolean {
  const type = (pkg?.packageType ?? "").toString().toUpperCase();
  const id = (pkg?.identifier ?? "").toString().toLowerCase();
  const pid = (productId(storeProduct(pkg)) ?? "").toLowerCase();
  return (
    type === "ANNUAL" ||
    id.includes("annual") || id.includes("year") || id === "$rc_annual" ||
    pid.includes("annual") || pid.includes("year")
  );
}

/** True when a package looks like a monthly subscription. */
function isMonthlyPackage(pkg: any): boolean {
  const type = (pkg?.packageType ?? "").toString().toUpperCase();
  const id = (pkg?.identifier ?? "").toString().toLowerCase();
  return (
    type === "MONTHLY" ||
    id.includes("monthly") || id.includes("month") || id === "$rc_monthly" ||
    isMonthly(pkg)
  );
}

/** True when user cancelled (not a real error). */
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
  // Key ALL RevenueCat effects on the stable user id — the Supabase user OBJECT
  // gets a new identity on every token refresh (~hourly), which re-ran the SDK
  // configure + entitlement sync chain each time (and was the CRIT-1 trigger).
  const userId = user?.id ?? null;
  const [rcElite, setRcElite] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [rcLoading, setRcLoading] = useState(true);
  const [rcReady, setRcReady] = useState(false);
  const [monthlyPriceLabel, setMonthlyPriceLabel] = useState<string | null>(null);
  const [yearlyPriceLabel, setYearlyPriceLabel] = useState<string | null>(null);

  /** Update elite state (local + cache only) — the DB is NEVER written from
   *  the client.
   *
   *  SECURITY: entitlement grants are server-authoritative. The RevenueCat
   *  webhook (verified server-side) writes profiles.is_elite/is_premium on
   *  purchase; set_elite_status is now service-role-only. A client-observed
   *  entitlement here only drives local UI state — writing it to the DB would
   *  let any client self-grant a paid tier for free. (Also closes CRIT-1: a
   *  client-observed *absence* must never revoke a paid Stripe membership.)
   */
  const applyElite = useCallback(
    async (info: any) => {
      const elite = hasElite(info);
      setRcElite(elite);
      if (userId) writeEliteCache(userId, elite);
      updateRevenueCatDebug({
        entitlement: elite ? ENTITLEMENT : null,
      });
    },
    [userId],
  );

  /** Fetch the monthly product directly and set the price label. */
  const loadMonthlyPrice = useCallback(async () => {
    try {
      const { products } = await CapPurchases.getProducts({
        productIdentifiers: [...PRODUCT_IDS],
      });
      const loadedProductIds = (products ?? [])
        .map((x: any) => productId(x))
        .filter((id: string | null): id is string => Boolean(id));

      const p =
        products?.find((x: any) => productId(x) === PRIMARY_PRODUCT_ID) ??
        products?.find((x: any) => isKnownMonthlyId(productId(x)));
      if (p) {
        const label = priceLabel(p);
        if (import.meta.env.DEV) console.log("[RC] Monthly product:", productId(p), label);
        if (label) setMonthlyPriceLabel(label);
        updateRevenueCatDebug({
          loadedProductIds,
          monthlyPriceLabel: label,
          lastProductFetchError: null,
        });
        pushIosDebugLog("RevenueCat", "Monthly product loaded", {
          loadedProductIds,
          priceLabel: label,
        });
      } else {
        const message = `Monthly product missing. Expected one of: ${PRODUCT_IDS.join(", ")}. Store returned: ${loadedProductIds.join(", ") || "none"}`;
        updateRevenueCatDebug({
          loadedProductIds,
          lastProductFetchError: message,
        });
        pushIosDebugLog("RevenueCat", "Monthly product missing from store response", {
          loadedProductIds,
        });
      }
    } catch (e) {
      console.warn("[RC] Could not load monthly product:", e);
      const message = toMessage(e);
      updateRevenueCatDebug({
        loadedProductIds: [],
        lastProductFetchError: message,
      });
      pushIosDebugLog("RevenueCat", "Monthly product fetch failed", { message });
    }
  }, []);

  // ─── Init (native only) ─────────────────────────────
  useEffect(() => {
    if (!userId) {
      setRcElite(false);
      setPackages([]);
      setMonthlyPriceLabel(null);
      setYearlyPriceLabel(null);
      setRcLoading(false);
      setRcReady(false);
      updateRevenueCatDebug({
        appUserId: null,
        entitlement: null,
      });
      return;
    }

    // Optimistically hydrate from the last-known entitlement so a returning
    // subscriber doesn't see a paywall flash before the live check resolves.
    setRcElite(readEliteCache(userId));

    if (!isNativePlatform()) {
      setRcLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // 1. Configure SDK (retry transient failures)
        await withRetry(() =>
          CapPurchases.configure({ apiKey: RC_API_KEY_APPLE, appUserID: userId }),
        );
        if (cancelled) return;
        setRcReady(true);
        updateRevenueCatDebug({
          appUserId: userId,
          entitlement: null,
          lastOfferingError: null,
          lastProductFetchError: null,
        });
        pushIosDebugLog("RevenueCat", "SDK configured", {
          appUserId: userId,
          entitlement: ENTITLEMENT,
          productIds: PRODUCT_IDS,
        });

        // 2. Check entitlements (retry transient failures)
        const { customerInfo } = await withRetry(() => CapPurchases.getCustomerInfo());
        if (cancelled) return;
        await applyElite(customerInfo);

        // 3. Load offerings (for package-based purchase)
        try {
          const { current } = await CapPurchases.getOfferings();
          if (cancelled) return;
          if (current?.availablePackages) {
            setPackages(current.availablePackages);
            const offeringPackageIds = current.availablePackages
              .map((pkg: any) => pkg?.identifier)
              .filter((id: string | undefined): id is string => Boolean(id));
            const offeringProductIds = current.availablePackages
              .map((pkg: any) => productId(storeProduct(pkg)))
              .filter((id: string | null): id is string => Boolean(id));

            const monthly =
              current.availablePackages.find((pkg: any) => productId(storeProduct(pkg)) === PRIMARY_PRODUCT_ID) ??
              current.availablePackages.find(isMonthlyPackage);
            if (monthly) {
              const label = priceLabel(storeProduct(monthly));
              if (label) setMonthlyPriceLabel(label);
              updateRevenueCatDebug({ monthlyPriceLabel: label });
            }

            const annual = current.availablePackages.find(isAnnualPackage);
            if (annual) {
              const yLabel = priceLabel(storeProduct(annual));
              if (yLabel) setYearlyPriceLabel(yLabel);
            }

            updateRevenueCatDebug({
              offeringPackageIds,
              offeringProductIds,
              lastOfferingError: null,
            });
            pushIosDebugLog("RevenueCat", "Offerings loaded", {
              offeringPackageIds,
              offeringProductIds,
            });
          } else {
            updateRevenueCatDebug({
              offeringPackageIds: [],
              offeringProductIds: [],
              lastOfferingError: "No available packages in current offering",
            });
            pushIosDebugLog("RevenueCat", "No available packages in current offering");
          }
        } catch (e) {
          if (import.meta.env.DEV) console.log("[RC] No offerings configured, using direct product:", e);
          const message = toMessage(e);
          updateRevenueCatDebug({
            offeringPackageIds: [],
            offeringProductIds: [],
            lastOfferingError: message,
          });
          pushIosDebugLog("RevenueCat", "Offerings fetch failed", { message });
        }

        // 4. Always fetch the actual product to guarantee correct price
        await loadMonthlyPrice();
      } catch (e) {
        console.error("[RC] Init error:", e);
      } finally {
        if (!cancelled) setRcLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, applyElite, loadMonthlyPrice]);

  // ─── Re-check entitlements when the app returns from background ──────
  // A subscription can be purchased, renewed, expired, or refunded while the
  // app is suspended. native-bootstrap dispatches `native:resume` on resume;
  // we re-pull customerInfo so gating reflects reality without a relaunch.
  useEffect(() => {
    if (!userId || !isNativePlatform()) return;
    const onResume = () => {
      void (async () => {
        try {
          const { customerInfo } = await withRetry(() => CapPurchases.getCustomerInfo());
          await applyElite(customerInfo);
        } catch (e) {
          console.warn("[RC] Resume entitlement re-check failed:", e);
        }
      })();
    };
    window.addEventListener("native:resume", onResume);
    return () => window.removeEventListener("native:resume", onResume);
  }, [userId, applyElite]);

  // ─── Purchase via package ───────────────────────────
  const purchase = useCallback(
    async (pkg: any) => {
      try {
        if (import.meta.env.DEV) console.log("[RC] Purchasing package:", pkg?.identifier);
        updateRevenueCatDebug({
          lastPurchaseError: null,
          lastPurchasedProductId: productId(storeProduct(pkg)),
        });
        pushIosDebugLog("RevenueCat", "Package purchase started", {
          packageId: pkg?.identifier,
          productId: productId(storeProduct(pkg)),
        });

        const { customerInfo } = await CapPurchases.purchasePackage({ aPackage: pkg });
        await applyElite(customerInfo);
      } catch (e: any) {
        if (isCancellation(e)) return;
        console.error("[RC] Package purchase error:", e);
        const message = toMessage(e);
        updateRevenueCatDebug({ lastPurchaseError: message });
        pushIosDebugLog("RevenueCat", "Package purchase failed", { message });
        toast.error("Purchase failed. Please try again.");
        throw e;
      }
    },
    [applyElite],
  );

  // ─── Purchase via product ID (fallback) ─────────────
  const purchaseProduct = useCallback(
    async (id: string) => {
      try {
        if (import.meta.env.DEV) console.log("[RC] Purchasing product:", id);
        updateRevenueCatDebug({
          lastPurchaseError: null,
          lastPurchasedProductId: id,
        });
        pushIosDebugLog("RevenueCat", "Direct product purchase started", {
          productId: id,
        });

        const fallbackIds = PRODUCT_IDS.filter((pid) => pid !== id);
        const requestedIds = [id, ...fallbackIds];
        const { products } = await CapPurchases.getProducts({ productIdentifiers: requestedIds });
        const loadedProductIds = (products ?? [])
          .map((x: any) => productId(x))
          .filter((pid: string | null): pid is string => Boolean(pid));

        const selectedProduct =
          products?.find((p: any) => productId(p) === id) ??
          products?.find((p: any) => isKnownMonthlyId(productId(p))) ??
          null;

        updateRevenueCatDebug({
          loadedProductIds,
          lastProductFetchError: selectedProduct
            ? null
            : `Tuotetta ei löydy. Odotettiin yhtä näistä: ${requestedIds.join(", ")}. Store palautti: ${loadedProductIds.join(", ") || "none"}`,
        });

        if (!selectedProduct) {
          throw new Error(
            `Tuotetta "${id}" ei löydy. Varmista että App Store Connectissa ja RevenueCatissa on sama Product ID (${requestedIds.join(" tai ")}).`,
          );
        }

        const { customerInfo } = await CapPurchases.purchaseStoreProduct({
          product: selectedProduct,
        });
        await applyElite(customerInfo);
      } catch (e: any) {
        if (isCancellation(e)) return;
        console.error("[RC] Product purchase error:", e);
        const message = toMessage(e);
        updateRevenueCatDebug({ lastPurchaseError: message });
        pushIosDebugLog("RevenueCat", "Direct product purchase failed", { message });
        toast.error("Purchase failed. Please try again.");
        throw e;
      }
    },
    [applyElite],
  );

  // ─── Purchase by billing cadence ────────────────────
  // Prefer an offering package matching the requested plan (so an annual
  // package, if configured, is honored). Falls back to the directly-
  // configured monthly product when no matching package exists.
  const purchasePremiumPlan = useCallback(
    async (plan: "monthly" | "yearly") => {
      const pkg =
        plan === "yearly"
          ? packages.find(isAnnualPackage)
          : (packages.find(isMonthlyPackage) ??
             packages.find((p) => productId(storeProduct(p)) === PRIMARY_PRODUCT_ID));
      if (pkg) {
        await purchase(pkg);
        return;
      }
      // No matching package — only the monthly product is configured directly.
      // Guard against silently charging monthly for a "yearly" tap.
      if (plan === "yearly") {
        throw new Error("Yearly plan isn't available right now. Please choose monthly.");
      }
      await purchaseProduct(PRIMARY_PRODUCT_ID);
    },
    [packages, purchase, purchaseProduct],
  );

  // ─── Restore ────────────────────────────────────────
  const restorePurchases = useCallback(async () => {
    try {
      updateRevenueCatDebug({ lastRestoreError: null });
      pushIosDebugLog("RevenueCat", "Restore purchases started");
      const { customerInfo } = await CapPurchases.restorePurchases();
      await applyElite(customerInfo);
    } catch (e) {
      console.error("[RC] Restore error:", e);
      const message = toMessage(e);
      updateRevenueCatDebug({ lastRestoreError: message });
      pushIosDebugLog("RevenueCat", "Restore purchases failed", { message });
      throw e;
    }
  }, [applyElite]);

  const value = useMemo<RevenueCatContextType>(
    () => ({
      rcElite,
      rcLoading,
      rcReady,
      monthlyPriceLabel,
      yearlyPriceLabel,
      yearlyAvailable: yearlyPriceLabel !== null,
      packages,
      purchase,
      purchaseProduct,
      purchasePremiumPlan,
      restorePurchases,
    }),
    [
      rcElite,
      rcLoading,
      rcReady,
      monthlyPriceLabel,
      yearlyPriceLabel,
      packages,
      purchase,
      purchaseProduct,
      purchasePremiumPlan,
      restorePurchases,
    ],
  );

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
};
