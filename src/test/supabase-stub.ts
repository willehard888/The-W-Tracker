// One Supabase double for tests that mount whole pages.
//
// Three query tests already carried their own copy of the thenable chain;
// this is that chain grown to the full surface the pages touch, with a mode
// switch so a page can be shown both what an empty account looks like and
// what a failed load looks like. Supabase never rejects a query — it resolves
// `{ data, error }` — so the error mode resolves too, and pages that check
// `.error` (or throw it into react-query) behave exactly as in production.
import { vi } from "vitest";

export type StubMode = "empty" | "error";
let mode: StubMode = "empty";
export const setMode = (m: StubMode): void => { mode = m; };
export const getMode = (): StubMode => mode;

/** Distinctive so a test can tell "the page logged the load I failed" from a real defect. */
export const STUB_ERROR = "stub: load failed";
const ERROR = { code: "PGRST000", message: STUB_ERROR, details: "", hint: "" };

/** A single-row read comes back null in empty mode; a list comes back []. */
const result = (single: boolean) =>
  mode === "error" ? { data: null, error: ERROR, count: null } : { data: single ? null : [], error: null, count: 0 };

const CHAIN_METHODS = [
  "select", "eq", "neq", "in", "is", "or", "not", "gte", "gt", "lte", "lt", "ilike", "like",
  "order", "limit", "range", "match", "filter", "insert", "update", "upsert", "delete",
  "abortSignal", "contains", "overlaps", "returns", "throwOnError",
] as const;

/** Thenable query builder: every method chains, awaiting resolves by mode. */
export const chain = (override?: unknown) => {
  const b: Record<string, unknown> = {};
  let single = false;
  for (const m of CHAIN_METHODS) b[m] = vi.fn().mockReturnValue(b);
  b.single = vi.fn().mockImplementation(() => { single = true; return b; });
  b.maybeSingle = vi.fn().mockImplementation(() => { single = true; return b; });
  (b as { then?: unknown }).then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
    try { resolve(override ?? result(single)); } catch (e) { reject?.(e); }
  };
  return b;
};

const channel = () => {
  const c: Record<string, unknown> = {};
  c.on = vi.fn().mockReturnValue(c);
  c.subscribe = vi.fn().mockReturnValue(c);
  c.unsubscribe = vi.fn().mockResolvedValue("ok");
  return c;
};

export const fakeUser = { id: "u1", email: "qa@example.test", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-01-01T00:00:00Z" };
export const fakeSession = { user: fakeUser, access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "bearer" };

export const supabase = {
  from: vi.fn(() => chain()),
  rpc: vi.fn(() => chain()),
  channel: vi.fn(channel),
  removeChannel: vi.fn(),
  removeAllChannels: vi.fn(),
  auth: {
    getSession: vi.fn(async () => ({ data: { session: fakeSession }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: fakeUser }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signOut: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ data: { user: fakeUser }, error: null })),
    signInWithIdToken: vi.fn(async () => ({ data: { session: fakeSession, user: fakeUser }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { session: fakeSession, user: fakeUser }, error: null })),
    signUp: vi.fn(async () => ({ data: { session: fakeSession, user: fakeUser }, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    setSession: vi.fn(async () => ({ data: { session: fakeSession }, error: null })),
  },
  storage: {
    from: vi.fn(() => ({
      createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "" }, error: null })),
      createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: "" } })),
      upload: vi.fn(async () => ({ data: { path: "" }, error: null })),
      remove: vi.fn(async () => ({ data: [], error: null })),
    })),
  },
  functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
};
