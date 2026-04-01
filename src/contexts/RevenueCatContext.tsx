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
const ENTITLEMENT = "The W Tracker Pro";
const PRODUCT_ID = "elitemonthly499";

// ─── Types ──────────────────────────────────────────────
interface RevenueCatContextType {
  rcElite: boolean;
  rcLoading: boolean;
  rcReady: boolean;
  monthlyPriceLabel: string | null;
  packages: any[];
  purchase: (pkg: any) => Promise<void>;
  purchaseProduct: (productId: string) => Promise<void>;
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
  return productId(storeProduct(value)) === PRODUCT_ID;
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
  const [rcElite, setRcElite] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [rcLoading, setRcLoading] = useState(true);
  const [rcReady, setRcReady] = useState(false);
  const [monthlyPriceLabel, setMonthlyPriceLabel] = useState<string | null>(null);

  /** Sync elite status to database. */
  const syncElite = useCallback(
    async (elite: boolean) => {
      if (!user || !elite) return;
      await supabase.from("profiles").update({ is_elite: true }).eq("user_id", user.id);
    },
    [user],
  );

  /** Update elite state + sync to DB. */
  const applyElite = useCallback(
    async (info: any) => {
      const elite = hasElite(info);
      setRcElite(elite);
      updateRevenueCatDebug({
        entitlement: elite ? ENTITLEMENT : null,
      });
      await syncElite(elite);
    },
    [syncElite],
  );

  /** Fetch the monthly product directly and set the price label. */
  const loadMonthlyPrice = useCallback(async () => {
    try {
      const { products } = await CapPurchases.getProducts({
        productIdentifiers: [PRODUCT_ID],
      });
      const loadedProductIds = (products ?? [])
        .map((x: any) => productId(x))
        .filter((id: string | null): id is string => Boolean(id));

      const p = products?.find((x: any) => productId(x) === PRODUCT_ID);
      if (p) {
        const label = priceLabel(p);
        console.log("[RC] Monthly product:", productId(p), label);
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
        const message = `Product ${PRODUCT_ID} not returned by store`;
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
    if (!user) {
      setRcElite(false);
      setPackages([]);
      setMonthlyPriceLabel(null);
      setRcLoading(false);
      setRcReady(false);
      updateRevenueCatDebug({
        appUserId: null,
        entitlement: null,
      });
      return;
    }

    if (!isNativePlatform()) {
      setRcLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // 1. Configure SDK
        await CapPurchases.configure({ apiKey: RC_API_KEY_APPLE, appUserID: user.id });
        if (cancelled) return;
        setRcReady(true);
        updateRevenueCatDebug({
          appUserId: user.id,
          entitlement: null,
          lastOfferingError: null,
          lastProductFetchError: null,
        });
        pushIosDebugLog("RevenueCat", "SDK configured", {
          appUserId: user.id,
          entitlement: ENTITLEMENT,
          productId: PRODUCT_ID,
        });

        // 2. Check entitlements
        const { customerInfo } = await CapPurchases.getCustomerInfo();
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

            const monthly = current.availablePackages.find(isMonthly);
            if (monthly) {
              const label = priceLabel(storeProduct(monthly));
              if (label) setMonthlyPriceLabel(label);
              updateRevenueCatDebug({ monthlyPriceLabel: label });
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
          console.log("[RC] No offerings configured, using direct product:", e);
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
  }, [user, applyElite, loadMonthlyPrice]);

  // ─── Purchase via package ───────────────────────────
  const purchase = useCallback(
    async (pkg: any) => {
      try {
        console.log("[RC] Purchasing package:", pkg?.identifier);
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
        throw e;
      }
    },
    [applyElite],
  );

  // ─── Purchase via product ID (fallback) ─────────────
  const purchaseProduct = useCallback(
    async (id: string) => {
      try {
        console.log("[RC] Purchasing product:", id);
        updateRevenueCatDebug({
          lastPurchaseError: null,
          lastPurchasedProductId: id,
        });
        pushIosDebugLog("RevenueCat", "Direct product purchase started", {
          productId: id,
        });

        const { products } = await CapPurchases.getProducts({ productIdentifiers: [id] });
        const loadedProductIds = (products ?? [])
          .map((x: any) => productId(x))
          .filter((pid: string | null): pid is string => Boolean(pid));

        updateRevenueCatDebug({
          loadedProductIds,
          lastProductFetchError: loadedProductIds.includes(id)
            ? null
            : `Product ${id} not returned by store`,
        });

        if (!products?.length) {
          throw new Error(
            `Tuotetta "${id}" ei löydy. Varmista että se on luotu App Store Connectiin ja lisätty RevenueCatiin.`,
          );
        }

        const { customerInfo } = await CapPurchases.purchaseStoreProduct({
          product: products[0],
        });
        await applyElite(customerInfo);
      } catch (e: any) {
        if (isCancellation(e)) return;
        console.error("[RC] Product purchase error:", e);
        const message = toMessage(e);
        updateRevenueCatDebug({ lastPurchaseError: message });
        pushIosDebugLog("RevenueCat", "Direct product purchase failed", { message });
        throw e;
      }
    },
    [applyElite],
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

  return (
    <RevenueCatContext.Provider
      value={{
        rcElite,
        rcLoading,
        rcReady,
        monthlyPriceLabel,
        packages,
        purchase,
        purchaseProduct,
        restorePurchases,
      }}
    >
      {children}
    </RevenueCatContext.Provider>
  );
};
