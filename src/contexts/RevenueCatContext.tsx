import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";
import { Purchases as CapPurchases } from "@revenuecat/purchases-capacitor";
import { pushIosDebugLog, updateRevenueCatDebug } from "@/lib/ios-debug";
import { MONTHLY_PRODUCT_IDS, YEARLY_PRODUCT_IDS } from "@/lib/products";

// ─── Constants ──────────────────────────────────────────
const RC_API_KEY_APPLE = "appl_qgpDFJEtyXTeNTJZxBoHzxzgiTr";
const ENTITLEMENT = "The W Tracker Pro";
// The products the paywall can buy — the one list shared with the webhook
// (src/lib/products.ts mirrors supabase/functions/_shared/products.ts).
const PRODUCT_IDS = [...MONTHLY_PRODUCT_IDS, ...YEARLY_PRODUCT_IDS] as const;
const PRIMARY_PRODUCT_ID = "WhealthFactory499";

// ─── Types ──────────────────────────────────────────────
/**
 * A purchase call resolves in three ways, and the caller has to tell them
 * apart: bought, failed (throws), or CANCELLED. Cancellation used to be
 * swallowed here as a normal resolve — so the Paywall spun for 8 s "verifying"
 * a purchase that never happened and then told the user "Payment confirmed but
 * we couldn't verify access". Its own userCancelled branch was unreachable,
 * which is why `purchase_cancelled` had zero rows in production.
 */
export interface PurchaseOutcome {
  cancelled: boolean;
  /**
   * Ask to Buy (a child account) and SCA both park the payment: StoreKit sent
   * the request to whoever approves it and will answer later. RevenueCat
   * rejects with PAYMENT_PENDING_ERROR, which read as a failure here — the
   * user was told the purchase failed while it was sitting in a parent's
   * approval queue, and nothing said their membership starts on approval.
   */
  pending?: boolean;
  /** true = App Store sandbox, false = money, null = no active entitlement / cancelled. */
  sandbox?: boolean | null;
}

/**
 * The subscriptions carry an App Store introductory free trial (two weeks,
 * scripts/asc-intro-offer.mjs). What the paywall says about it comes from the
 * store, never from a constant: the offer's length rides on the product
 * (`introPrice`), and whether THIS Apple ID still qualifies is
 * `checkTrialOrIntroductoryPriceEligibility` — one trial per Apple ID across
 * the group, so a member who used it on another account is ineligible.
 */
export interface StoreTrialOffer {
  /** "14 days" / "1 month" — the store's own period, humanised. */
  label: string;
  days: number;
  /** null while the store has not answered; Apple's sheet is authoritative either way. */
  eligible: boolean | null;
}

/** The member's own subscription state, from the entitlement RevenueCat holds. */
export interface StoreSubscription {
  /** In the introductory free trial right now. */
  inTrial: boolean;
  /** Trial (or paid period) ends here; null when unknown. */
  expiresAt: Date | null;
  willRenew: boolean | null;
}

interface RevenueCatContextType {
  rcElite: boolean;
  rcLoading: boolean;
  rcReady: boolean;
  monthlyPriceLabel: string | null;
  yearlyPriceLabel: string | null;
  /** True only when the store actually has an annual package available. */
  yearlyAvailable: boolean;
  /** The free trial on the current offering's monthly package; null = none. */
  trialOffer: StoreTrialOffer | null;
  subscription: StoreSubscription;
  /** Opens the App Store's manage-subscriptions sheet (cancel, change plan). */
  manageSubscriptions: () => Promise<void>;
  packages: any[];
  purchase: (pkg: any) => Promise<PurchaseOutcome>;
  purchaseProduct: (productId: string) => Promise<PurchaseOutcome>;
  /**
   * Purchase the Premium plan for the requested billing cadence.
   * Honors an annual offering package when one exists; otherwise falls back
   * to the directly-configured monthly product.
   */
  purchasePremiumPlan: (plan: "monthly" | "yearly") => Promise<PurchaseOutcome>;
  restorePurchases: () => Promise<{ restored: boolean }>;
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

/** Where the entitlement came from: true for an App Store sandbox purchase,
 *  false for money, null when the entitlement is not active. The ledger keeps
 *  test and revenue apart with it. */
export const purchaseSandboxFlag = (info: { entitlements?: { active?: Record<string, { isSandbox?: boolean }> } } | null | undefined): boolean | null => {
  const ent = info?.entitlements?.active?.[ENTITLEMENT];
  return ent ? ent.isSandbox === true : null;
};

/** Check whether a customerInfo has our entitlement active. */
export function hasElite(info: any): boolean {
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

// The monthly product's ids only. This used to accept every id in
// PRODUCT_IDS, so when the store did not return the monthly product the
// "monthly" fallback picked the yearly one and a tap on 8,99 €/month bought
// 89,99 €/year (2026-09-15, TestFlight). A plan buys its own product or fails.
function isKnownMonthlyId(id: string | null): boolean {
  return !!id && (MONTHLY_PRODUCT_IDS as readonly string[]).includes(id);
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
export function isCancellation(e: any): boolean {
  return e?.code === "1" || e?.code === 1 || !!e?.userCancelled;
}

/** True when the payment is awaiting someone else's approval — Ask to Buy on a
 *  child account, or a bank's SCA step. PURCHASES_ERROR_CODE 20. Not a failure:
 *  the entitlement arrives (via the webhook) if and when it is approved. */
export function isPaymentPending(e: any): boolean {
  return (
    e?.code === "20" || e?.code === 20 || e?.readableErrorCode === "PaymentPendingError"
  );
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
  const [trialOffer, setTrialOffer] = useState<StoreTrialOffer | null>(null);
  const [subscription, setSubscription] = useState<StoreSubscription>({ inTrial: false, expiresAt: null, willRenew: null });
  const managementUrl = useRef<string | null>(null);
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
      const ent = info?.entitlements?.active?.[ENTITLEMENT];
      if (typeof info?.managementURL === "string" && info.managementURL) managementUrl.current = info.managementURL;
      const expires = ent?.expirationDate ? new Date(ent.expirationDate) : null;
      setSubscription({
        inTrial: String(ent?.periodType ?? "").toUpperCase() === "TRIAL",
        expiresAt: expires && Number.isFinite(expires.getTime()) ? expires : null,
        willRenew: typeof ent?.willRenew === "boolean" ? ent.willRenew : null,
      });
    },
    [userId],
  );

  /**
   * The trial on the offering's monthly package, and whether this Apple ID
   * still gets it. Fails open to "unknown": the paywall then shows the trial
   * copy and Apple's sheet says the truth.
   */
  const readTrialOffer = useCallback(async (monthly: any) => {
    const intro = storeProduct(monthly)?.introPrice;
    if (!intro || Number(intro.price) !== 0) {
      setTrialOffer(null);
      updateRevenueCatDebug({ trialOffer: intro ? `intro ${intro.priceString ?? intro.price} ${intro.periodNumberOfUnits} ${intro.periodUnit}` : "none on product" });
      return;
    }
    const units = Number(intro.periodNumberOfUnits) || 0;
    const unit = String(intro.periodUnit ?? "").toUpperCase();
    const days = unit === "DAY" ? units : unit === "WEEK" ? units * 7 : unit === "MONTH" ? units * 30 : unit === "YEAR" ? units * 365 : 0;
    const label = unit === "WEEK" && units === 2 ? "14 days" : unit === "DAY" ? `${units} days` : unit === "WEEK" ? `${units} week${units === 1 ? "" : "s"}` : unit === "MONTH" ? `${units} month${units === 1 ? "" : "s"}` : `${days} days`;
    let eligible: boolean | null = null;
    try {
      const id = productId(storeProduct(monthly));
      if (id) {
        const map = await CapPurchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: [id] });
        const status = Number(map?.[id]?.status);
        // 2 = eligible, 1 = ineligible, 0 = unknown, 3 = no intro offer exists
        eligible = status === 2 ? true : status === 1 ? false : null;
      }
    } catch { /* unknown */ }
    setTrialOffer({ label, days, eligible });
    updateRevenueCatDebug({ trialOffer: `free ${label} · eligible=${eligible === null ? "unknown" : eligible}` });
  }, []);

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
              void readTrialOffer(monthly);
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
  }, [userId, applyElite, loadMonthlyPrice, readTrialOffer]);

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
        return { cancelled: false, sandbox: purchaseSandboxFlag(customerInfo) };
      } catch (e: any) {
        if (isCancellation(e)) return { cancelled: true };
        if (isPaymentPending(e)) {
          pushIosDebugLog("RevenueCat", "Package purchase awaiting approval");
          return { cancelled: false, pending: true, sandbox: null };
        }
        console.error("[RC] Package purchase error:", e);
        const message = toMessage(e);
        updateRevenueCatDebug({ lastPurchaseError: message });
        pushIosDebugLog("RevenueCat", "Package purchase failed", { message });
        // No toast here. The Paywall already renders this failure as an inline
        // alert next to the button that caused it, so a toast on top of it was
        // the same failure said twice. The context reports, the screen speaks.
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

        // Exactly the requested product — never a sibling. If the store did
        // not return it, the honest outcome is the error below, not a
        // different subscription.
        const selectedProduct = products?.find((p: any) => productId(p) === id) ?? null;

        updateRevenueCatDebug({
          loadedProductIds,
          lastProductFetchError: selectedProduct
            ? null
            : `Product not found. Expected one of: ${requestedIds.join(", ")}. Store returned: ${loadedProductIds.join(", ") || "none"}`,
        });

        if (!selectedProduct) {
          throw new Error(
            `Product "${id}" is not available from the store. Check that App Store Connect and RevenueCat use the same product id (${requestedIds.join(" or ")}).`,
          );
        }

        const { customerInfo } = await CapPurchases.purchaseStoreProduct({
          product: selectedProduct,
        });
        await applyElite(customerInfo);
        return { cancelled: false, sandbox: purchaseSandboxFlag(customerInfo) };
      } catch (e: any) {
        if (isCancellation(e)) return { cancelled: true };
        if (isPaymentPending(e)) {
          pushIosDebugLog("RevenueCat", "Direct product purchase awaiting approval");
          return { cancelled: false, pending: true, sandbox: null };
        }
        console.error("[RC] Product purchase error:", e);
        const message = toMessage(e);
        updateRevenueCatDebug({ lastPurchaseError: message });
        pushIosDebugLog("RevenueCat", "Direct product purchase failed", { message });
        // See the package path above: the caller owns the one message.
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
      if (pkg) return purchase(pkg);
      // No matching package — only the monthly product is configured directly.
      // Guard against silently charging monthly for a "yearly" tap.
      if (plan === "yearly") {
        throw new Error("Yearly plan isn't available right now. Please choose monthly.");
      }
      return purchaseProduct(PRIMARY_PRODUCT_ID);
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
      // StoreKit resolves happily for an Apple ID that never bought anything;
      // "restored" has to mean an entitlement actually came back.
      return { restored: hasElite(customerInfo) };
    } catch (e) {
      console.error("[RC] Restore error:", e);
      const message = toMessage(e);
      updateRevenueCatDebug({ lastRestoreError: message });
      pushIosDebugLog("RevenueCat", "Restore purchases failed", { message });
      throw e;
    }
  }, [applyElite]);

  // Apple's subscriptions page (RevenueCat hands the URL on customerInfo);
  // the same door Profile's "Manage subscription" row opens.
  const manageSubscriptions = useCallback(async () => {
    window.open(managementUrl.current ?? "https://apps.apple.com/account/subscriptions", "_blank");
  }, []);

  const value = useMemo<RevenueCatContextType>(
    () => ({
      rcElite,
      rcLoading,
      rcReady,
      monthlyPriceLabel,
      yearlyPriceLabel,
      yearlyAvailable: yearlyPriceLabel !== null,
      trialOffer,
      subscription,
      manageSubscriptions,
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
      trialOffer,
      subscription,
      manageSubscriptions,
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
