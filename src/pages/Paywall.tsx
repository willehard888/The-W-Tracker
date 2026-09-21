import { Block } from "@/components/skeletons/PageSkeleton";
import { fmtDate } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { getIosDebugState } from "@/lib/ios-debug";
import { HARNESS_KEY, shouldForcePaywall } from "@/lib/paywall-harness";
import { readSession, removeSession, writeSession } from "@/lib/storage";
import { isCancellation, isPaymentPending, useRevenueCat } from "@/contexts/RevenueCatContext";
import { useNavigate } from "react-router-dom";
import { friendlyError } from "@/lib/error-copy";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
import { FlaskConical, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/platform";
import { backOr } from "@/lib/nav";
import PremiumHero from "@/components/paywall/PremiumHero";
import PilotCodeRedeem from "@/components/paywall/PilotCodeRedeem";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { track, FUNNEL } from "@/lib/analytics";

// ONE subscription covering all content, billed monthly or yearly — not two
// tiers. The live store label wins on native; these are the web fallbacks and
// must match App Store Connect exactly, because showing one number and
// charging another is what eroded trust the last time they drifted apart.
const PREMIUM_YEARLY_FALLBACK = "89,99 €";
const PREMIUM_MONTHLY_FALLBACK = "8,99 €";

type PurchaseStatus = "idle" | "purchasing" | "verifying" | "pending" | "error";

/** The quiet 44 pt text button the footer is made of. */
const quiet = "press min-h-11 px-3 text-meta text-muted-foreground";

const Paywall = () => {
  const { user, isElite, isPremium, checkSubscription, profile, subscriptionLoading } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const {
    purchasePremiumPlan, restorePurchases,
    rcLoading, rcReady,
    monthlyPriceLabel, yearlyPriceLabel, yearlyAvailable,
  } = useRevenueCat();
  const navigate = useNavigate();
  const isNative = isNativePlatform();

  // Single state machine for the whole purchase flow
  const [status, setStatus] = useState<PurchaseStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wasMemberRef = useRef(isElite);

  // Live prices from the store (native); web uses the configured fallbacks.
  const monthlyLabel = (isNative && monthlyPriceLabel) || PREMIUM_MONTHLY_FALLBACK;
  const yearlyLabel = (isNative && yearlyPriceLabel) || PREMIUM_YEARLY_FALLBACK;
  // On native, only offer yearly if the store actually has an annual
  // package — otherwise we'd advertise a plan we can't fulfill.
  const showYearly = !isNative || yearlyAvailable;

  // Top of the monetization funnel — record paywall exposure once per mount.
  useEffect(() => {
    track(FUNNEL.paywallViewed, { native: isNative });
    // What the store handed the app, next to the view that showed it: product
    // ids, package ids, labels, last errors. Seven failed purchases in
    // production carried no diagnosable reason; this row is that reason.
    if (isNative) {
      const rc = getIosDebugState().revenuecat;
      track(FUNNEL.storeDiag, {
        loaded: rc.loadedProductIds, packages: rc.offeringPackageIds, products: rc.offeringProductIds,
        monthly: rc.monthlyPriceLabel,
        offeringError: rc.lastOfferingError, productError: rc.lastProductFetchError,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  // Welcome toast on transition into membership (once per session)
  useEffect(() => {
    if (isElite && !wasMemberRef.current) {
      if (readSession("w_welcome_toast_shown") !== "1") {
        writeSession("w_welcome_toast_shown", "1");
        toast.success("Welcome to Premium. Full access unlocked.");
      }
    }
    wasMemberRef.current = isElite;
  }, [isElite]);

  // The harness keeps an admin on the offer screen even as a member, so a
  // sandbox purchase can be driven again after the last one expired.
  const forced = shouldForcePaywall({
    dev: import.meta.env.DEV,
    isAdmin,
    param: null,
    sticky: readSession(HARNESS_KEY) === "1",
  });

  // Once Premium is active, leave the paywall behind
  useEffect(() => {
    if (!isPremium || forced) return;
    navigate("/", { replace: true });
  }, [isPremium, forced, navigate]);

  // The way out. Under the harness the route guard sends every screen back
  // here, so leaving the page must also drop the harness — the founder was
  // trapped on the first sandbox run: back arrow, tab bar, all roads led here.
  const leave = () => {
    if (forced) removeSession(HARNESS_KEY);
    backOr(navigate, "/");
  };

  // ─── Verify membership by polling checkSubscription ──────────
  // NOTE: this useCallback MUST sit above the `if (isElite) return ...`
  // early-return below. Previously it lived after the early return, which
  // caused React's "Rendered fewer hooks than expected" error the moment a
  // user's membership flipped on (the hook count differed across renders).
  const pollVerification = useCallback(async (timeoutMs = 8000): Promise<boolean> => {
    const start = Date.now();
    // The effect above navigates away the moment membership flips; the loop
    // must stop with the screen instead of polling an unmounted paywall.
    while (aliveRef.current && Date.now() - start < timeoutMs) {
      try {
        await checkSubscription();
        // checkSubscription updates AuthContext; we read isElite via closure.
        // Re-read from supabase as a safety net so we don't rely on async state.
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("is_elite, is_premium")
            .eq("user_id", user.id)
            .maybeSingle();
          if (data?.is_premium || data?.is_elite) return true;
        }
      } catch {
        /* swallow & retry */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }, [checkSubscription]);

  // ─── Already a member ────────────────────────────────────────
  if (isElite && !forced) {
    return (
      <div className="min-h-full">
        <PageBar onBack={leave} />
        <div className="home-rise px-4 pt-3 pb-6">
          <h1 className="font-display font-black text-beat leading-[1.04] tracking-tight">You're in.</h1>
          <p className="mt-1.5 text-dense text-muted-foreground">
            Full access, new content every week. Your price stays locked.
          </p>
          {/* Subscriptions are App Store-only — same management page on
              every platform. The bar's back is the other way out. */}
          <Button
            variant="outline"
            size="lg"
            className="mt-5 w-full"
            onClick={() => window.open("https://apps.apple.com/account/subscriptions", "_blank")}
          >
            Manage in App Store
          </Button>
        </div>
      </div>
    );
  }

  const creditsUntilRaw: string | null = profile?.membership_credits_until ?? null;
  const creditsActive = creditsUntilRaw && new Date(creditsUntilRaw).getTime() > Date.now();
  const creditsUntilLabel = creditsActive ? fmtDate(creditsUntilRaw as string) : null;

  // ─── Native purchase handler ─────────────────────────────────
  const handleNativePurchase = async (plan: "monthly" | "yearly") => {
    if (!rcReady) {
      setStatus("error");
      setErrorMessage("Store not ready yet — please try again in a moment.");
      return;
    }
    setErrorMessage(null);
    hapticImpact("medium");
    setStatus("purchasing");
    track(FUNNEL.purchaseStarted, { plan, platform: "native" });

    try {
      const outcome = await purchasePremiumPlan(plan);
      if (outcome?.cancelled) {
        // The StoreKit sheet was dismissed. Nothing to verify, nothing to
        // apologise for — back to the offer.
        track(FUNNEL.purchaseCancelled, { plan, platform: "native" });
        setStatus("idle");
        return;
      }
      if (outcome?.pending) {
        // Ask to Buy / SCA: the request left the device and is waiting on
        // someone else. Nothing to verify and nothing went wrong.
        track(FUNNEL.purchasePending, { plan, platform: "native" });
        hapticNotification("warning");
        setStatus("pending");
        return;
      }
      setStatus("verifying");
      const ok = await pollVerification(8000);
      if (ok) {
        track(FUNNEL.purchaseCompleted, { plan, platform: "native", sandbox: outcome?.sandbox ?? null });
        hapticNotification("success");
        // The effect above navigates home when isPremium flips true. Under
        // the harness it does not, so the button must not stay on
        // "Confirming access…" — say it landed and return to the offer.
        if (forced) {
          setStatus("idle");
          toast.success(outcome?.sandbox ? "Sandbox purchase confirmed." : "Membership confirmed.");
        }
      } else {
        setStatus("error");
        // This screen has no pull-to-refresh — it never did, and telling
        // someone to perform a gesture that does nothing reads as the app
        // blaming them for its own delay. Restore is the button that works.
        setErrorMessage(
          "Payment went through but access hasn't landed yet. Give it a moment, then tap Restore purchases.",
        );
        hapticNotification("warning");
      }
    } catch (e: any) {
      // Both outcomes normally come back as an outcome, not a throw; this is
      // the net for any path that throws instead. Same predicates as the
      // context, so a cancel can never be classified two different ways.
      if (isCancellation(e)) {
        track(FUNNEL.purchaseCancelled, { plan, platform: "native" });
        setStatus("idle");
        return;
      }
      if (isPaymentPending(e)) {
        track(FUNNEL.purchasePending, { plan, platform: "native" });
        hapticNotification("warning");
        setStatus("pending");
        return;
      }
      // The reason alone was not diagnosable: every failure in production so
      // far recorded a message with a null code, so nobody could tell a
      // StoreKit refusal from a backend 500. RevenueCat puts the useful part
      // in `code` / `underlyingErrorMessage`.
      track(FUNNEL.purchaseFailed, {
        plan,
        platform: "native",
        reason: e?.message?.toString().slice(0, 120),
        code: e?.code != null ? String(e.code) : null,
        underlying: e?.underlyingErrorMessage?.toString().slice(0, 120) ?? null,
        readable: e?.readableErrorCode?.toString() ?? null,
      });
      hapticNotification("error");
      setStatus("error");
      setErrorMessage(friendlyError(e, "Purchase failed. Please try again."));
    }
  };

  // ─── Web: purchases are App Store-only ───────────────────────
  // The dormant Stripe checkout was removed with its edge functions — web
  // visitors get sent to the app, where the real purchase flow lives.
  const handleWebPurchase = async (_plan: "monthly" | "yearly") => {
    track(FUNNEL.purchaseStarted, { plan: _plan, platform: "web_to_appstore" });
    window.open("https://apps.apple.com/app/id6761115803", "_blank");
  };

  const handleRestore = async () => {
    hapticImpact("light");
    setErrorMessage(null);
    try {
      const { restored } = await restorePurchases();
      await checkSubscription();
      if (!restored) {
        // A successful call with nothing in it — the normal outcome for an
        // Apple ID that never bought. Not a green toast.
        toast("No purchase found on this Apple ID.", {
          description: "Restore only brings back a membership bought with the Apple ID signed in on this iPhone.",
        });
        hapticNotification("warning");
        return;
      }
      track(FUNNEL.purchaseRestored);
      toast.success("Purchases restored.");
      hapticNotification("success");
    } catch {
      toast.error("Couldn't restore purchases.");
      hapticNotification("error");
    }
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-full">
      {/* The bar's back is the escape hatch — the bottom nav and brand header
          are hidden on /paywall, so without it the page is a hard dead end. */}
      <PageBar onBack={leave} />

      <div className="px-4 pt-3 pb-6">
        {/* BEAT: what this buys, or how long it is already free. */}
        <header className="home-rise">
          <h1 className="font-display font-black text-beat leading-[1.04] tracking-tight">
            {creditsActive ? `Free until ${creditsUntilLabel}.` : "Everything the ritual unlocks."}
          </h1>
          <p className="mt-1.5 text-dense text-muted-foreground">
            {creditsActive
              ? "The app stays fully unlocked until then. Premium keeps it that way."
              : "Fuel, training, recovery, the coach and the climb. One membership."}
          </p>
          {subscriptionLoading && (
            <p className="mt-2 flex items-center gap-2 text-meta text-muted-foreground">
              <Loader2 size={14} className="animate-spin" aria-hidden />
              Verifying membership…
            </p>
          )}
        </header>

        {forced && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => { removeSession(HARNESS_KEY); navigate("/", { replace: true }); }}
          >
            <FlaskConical aria-hidden size={14} /> Exit test mode
          </Button>
        )}

        {/* HERO: the plan card, then what it unlocks. */}
        <div className="home-rise home-rise-1 mt-4">
          {isNative && rcLoading ? (
            <Block height={236} className="!rounded-2xl" />
          ) : (
            <PremiumHero
              monthlyPriceLabel={monthlyLabel}
              yearlyPriceLabel={yearlyLabel}
              yearlyAvailable={showYearly}
              native={isNative}
              status={status}
              errorMessage={errorMessage}
              onDismissError={() => {
                setStatus("idle");
                setErrorMessage(null);
              }}
              onCta={isNative ? handleNativePurchase : handleWebPurchase}
            />
          )}
        </div>

        {/* FOOTER: restore, the pilot door, and the two links App Review
            requires (Terms of Use / EULA and Privacy Policy). All 44 pt. */}
        <div className="home-rise home-rise-2 mt-5">
          <div className="flex items-center justify-center">
            <button type="button" onClick={handleRestore} className={quiet}>Restore purchases</button>
            <button type="button" onClick={() => navigate("/terms")} className={quiet}>Terms of Use</button>
            <button type="button" onClick={() => navigate("/privacy")} className={quiet}>Privacy Policy</button>
          </div>
          {/* Pilot testers redeem free access here instead of purchasing, so the
              paywall and the real store flow stay live during the pilot. */}
          <PilotCodeRedeem />
        </div>
      </div>
    </div>
  );
};

export default Paywall;
