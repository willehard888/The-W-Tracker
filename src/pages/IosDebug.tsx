import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Trash2 } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { getPlatform } from "@/lib/platform";
import {
  clearIosDebug,
  getIosDebugState,
  IosDebugState,
  subscribeIosDebug,
} from "@/lib/ios-debug";
import { Button } from "@/components/ui/button";

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-[120px_1fr] gap-2 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono break-all">{value}</span>
  </div>
);

const stringify = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "[]";
  return String(value);
};

const asYesNo = (value: boolean | null) =>
  value === null ? "—" : value ? "yes" : "no";

const IosDebug = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<IosDebugState>(() => getIosDebugState());
  const platform = getPlatform();

  useEffect(() => subscribeIosDebug(setState), []);

  const logs = useMemo(() => [...state.logs].reverse().slice(0, 40), [state.logs]);

  return (
    <div className="min-h-full">
      <PageBar title="iOS debug" onBack={() => navigate(-1)} />
      <div className="px-4 pt-4 pb-6 space-y-4">
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setState(getIosDebugState())}
          >
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={clearIosDebug}>
            <Trash2 size={14} /> Clear
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">
          Platform: <span className="font-semibold text-foreground">{platform}</span> • Updated: {state.updatedAt}
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h2 className="font-display text-sm font-bold">Apple OAuth callback</h2>
        <Field label="callbackAt" value={stringify(state.oauth.callbackAt)} />
        <Field label="redirectUri" value={stringify(state.oauth.redirectUri)} />
        <Field label="sentState" value={stringify(state.oauth.sentState)} />
        <Field label="returnedState" value={stringify(state.oauth.returnedState)} />
        <Field label="stateMatch" value={asYesNo(!!state.oauth.sentState && !!state.oauth.returnedState && state.oauth.sentState === state.oauth.returnedState)} />
        <Field label="hasAccessToken" value={asYesNo(state.oauth.hasAccessToken)} />
        <Field label="hasRefreshToken" value={asYesNo(state.oauth.hasRefreshToken)} />
        <Field label="sessionApplied" value={asYesNo(state.oauth.sessionApplied)} />
        <Field label="error" value={stringify(state.oauth.error)} />
        <Field label="errorDescription" value={stringify(state.oauth.errorDescription)} />
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h2 className="font-display text-sm font-bold">RevenueCat products & purchase errors</h2>
        <Field label="appUserId" value={stringify(state.revenuecat.appUserId)} />
        <Field label="entitlement" value={stringify(state.revenuecat.entitlement)} />
        <Field label="monthlyPrice" value={stringify(state.revenuecat.monthlyPriceLabel)} />
        <Field label="loadedProductIds" value={stringify(state.revenuecat.loadedProductIds)} />
        <Field label="offeringPackageIds" value={stringify(state.revenuecat.offeringPackageIds)} />
        <Field label="offeringProductIds" value={stringify(state.revenuecat.offeringProductIds)} />
        <Field label="lastPurchased" value={stringify(state.revenuecat.lastPurchasedProductId)} />
        <Field label="productError" value={stringify(state.revenuecat.lastProductFetchError)} />
        <Field label="offeringError" value={stringify(state.revenuecat.lastOfferingError)} />
        <Field label="purchaseError" value={stringify(state.revenuecat.lastPurchaseError)} />
        <Field label="restoreError" value={stringify(state.revenuecat.lastRestoreError)} />
        <Field label="updatedAt" value={stringify(state.revenuecat.lastUpdatedAt)} />
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-display text-sm font-bold">Recent debug logs</h2>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No logs yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log, index) => (
              <div key={`${log.at}-${index}`} className="rounded-lg border border-border p-2">
                <p className="text-[12px] text-muted-foreground">{log.at} • {log.source}</p>
                <p className="text-xs font-medium break-words">{log.message}</p>
                {log.payload ? (
                  <pre className="mt-1 text-[12px] whitespace-pre-wrap break-all text-muted-foreground font-mono">
                    {log.payload}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
};

export default IosDebug;
