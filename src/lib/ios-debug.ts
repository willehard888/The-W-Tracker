import { onIdle } from "@/lib/idle";

export interface OAuthDebugState {
  // SECURITY: never store raw callback/deep-link URLs here — they carry the
  // access + refresh tokens in the hash, and this state is persisted to
  // localStorage in plaintext. Only presence booleans + non-secret metadata.
  callbackAt: string | null;
  redirectUri: string | null;
  sentState: string | null;
  returnedState: string | null;
  error: string | null;
  errorDescription: string | null;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  sessionApplied: boolean | null;
}

export interface RevenueCatDebugState {
  appUserId: string | null;
  entitlement: string | null;
  loadedProductIds: string[];
  offeringPackageIds: string[];
  offeringProductIds: string[];
  monthlyPriceLabel: string | null;
  lastProductFetchError: string | null;
  lastOfferingError: string | null;
  lastPurchaseError: string | null;
  lastRestoreError: string | null;
  lastPurchasedProductId: string | null;
  lastUpdatedAt: string | null;
}

export interface IosDebugLog {
  at: string;
  source: string;
  message: string;
  payload?: string;
}

export interface IosDebugState {
  updatedAt: string;
  oauth: OAuthDebugState;
  revenuecat: RevenueCatDebugState;
  logs: IosDebugLog[];
}

const STORAGE_KEY = "w_ios_debug_v1";
const MAX_LOGS = 120;

// Log collection is opt-in outside dev: every pushIosDebugLog used to
// serialize + persist the whole state synchronously on the boot path.
// Flip it on a device with `localStorage.wf_debug = "1"` (Safari inspector).
const LOGS_ON = (() => {
  if (import.meta.env.DEV) return true;
  try { return localStorage.getItem("wf_debug") === "1"; } catch { return false; }
})();

const defaultState: IosDebugState = {
  updatedAt: new Date(0).toISOString(),
  oauth: {
    callbackAt: null,
    redirectUri: null,
    sentState: null,
    returnedState: null,
    error: null,
    errorDescription: null,
    hasAccessToken: false,
    hasRefreshToken: false,
    sessionApplied: null,
  },
  revenuecat: {
    appUserId: null,
    entitlement: null,
    loadedProductIds: [],
    offeringPackageIds: [],
    offeringProductIds: [],
    monthlyPriceLabel: null,
    lastProductFetchError: null,
    lastOfferingError: null,
    lastPurchaseError: null,
    lastRestoreError: null,
    lastPurchasedProductId: null,
    lastUpdatedAt: null,
  },
  logs: [],
};

type Listener = (state: IosDebugState) => void;

const listeners = new Set<Listener>();

function canUseStorage() {
  return typeof window !== "undefined";
}

function parseStoredState(raw: string | null): IosDebugState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      oauth: { ...defaultState.oauth, ...(parsed?.oauth ?? {}) },
      revenuecat: { ...defaultState.revenuecat, ...(parsed?.revenuecat ?? {}) },
      logs: Array.isArray(parsed?.logs) ? parsed.logs.slice(-MAX_LOGS) : [],
    } as IosDebugState;
  } catch {
    return null;
  }
}

function loadInitialState(): IosDebugState {
  if (!canUseStorage()) return defaultState;
  const stored = parseStoredState(window.localStorage.getItem(STORAGE_KEY));
  return stored ?? defaultState;
}

let state: IosDebugState = loadInitialState();

let pendingPersist: (() => void) | null = null;

function persistAndNotify() {
  state = { ...state, updatedAt: new Date().toISOString() };
  listeners.forEach((listener) => listener(state));
  // Coalesced: one idle write per burst, always of the latest state.
  if (!canUseStorage() || pendingPersist) return;
  pendingPersist = onIdle(() => {
    pendingPersist = null;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage denied */ }
  }, 1000);
}

function safePayload(payload: unknown): string | undefined {
  if (payload === undefined) return undefined;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

export function getIosDebugState(): IosDebugState {
  return state;
}

export function subscribeIosDebug(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateOauthDebug(patch: Partial<OAuthDebugState>) {
  state = {
    ...state,
    oauth: {
      ...state.oauth,
      ...patch,
    },
  };
  persistAndNotify();
}

export function updateRevenueCatDebug(patch: Partial<RevenueCatDebugState>) {
  state = {
    ...state,
    revenuecat: {
      ...state.revenuecat,
      ...patch,
      lastUpdatedAt: new Date().toISOString(),
    },
  };
  persistAndNotify();
}

export function pushIosDebugLog(source: string, message: string, payload?: unknown) {
  if (!LOGS_ON) return;
  state = {
    ...state,
    logs: [
      ...state.logs,
      {
        at: new Date().toISOString(),
        source,
        message,
        payload: safePayload(payload),
      },
    ].slice(-MAX_LOGS),
  };
  persistAndNotify();
}

export function clearIosDebug() {
  state = {
    ...defaultState,
    updatedAt: new Date().toISOString(),
  };
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  listeners.forEach((listener) => listener(state));
}
