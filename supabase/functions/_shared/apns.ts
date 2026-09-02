// Apple Push Notification service (APNs) helper using token-based auth (.p8)
// Uses Web Crypto for ES256 JWT signing — works in Deno edge runtime.

interface CachedToken {
  jwt: string;
  issuedAt: number; // ms epoch
}

let cachedToken: CachedToken | null = null;

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(cleaned);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function importP8Key(p8: string): Promise<CryptoKey> {
  const pkcs8 = pemToArrayBuffer(p8);
  return await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function generateApnsJwt(): Promise<string> {
  const KEY_ID = Deno.env.get("APNS_KEY_ID");
  const TEAM_ID = Deno.env.get("APNS_TEAM_ID");
  const AUTH_KEY = Deno.env.get("APNS_AUTH_KEY");

  if (!KEY_ID || !TEAM_ID || !AUTH_KEY) {
    throw new Error("APNS_KEY_ID, APNS_TEAM_ID, and APNS_AUTH_KEY are required");
  }

  // Reuse JWT for up to ~50 minutes (Apple max is 60).
  if (cachedToken && Date.now() - cachedToken.issuedAt < 50 * 60 * 1000) {
    return cachedToken.jwt;
  }

  const header = { alg: "ES256", kid: KEY_ID };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: TEAM_ID, iat: now };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importP8Key(AUTH_KEY);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    key,
    new TextEncoder().encode(signingInput),
  );

  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
  cachedToken = { jwt, issuedAt: Date.now() };
  return jwt;
}

export interface ApnsPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string;
  /**
   * Notification Center grouping (aps thread-id). Pass the sender's category
   * ("coach", "tribe", "social", …) so a busy morning stacks into tidy groups
   * instead of a wall of loose banners.
   */
  threadId?: string;
  /**
   * apns-collapse-id header: a newer push with the same id replaces the older
   * one on the device. Use for notifications where only the latest state
   * matters (e.g. tribe fire count), not for independent events.
   */
  collapseId?: string;
}

export interface ApnsResult {
  token: string;
  status: number;
  reason?: string;
}

/**
 * Send a push notification to a single iOS device via APNs.
 * Uses production endpoint. Returns status + reason for diagnostics.
 */
export async function sendApnsPush(
  deviceToken: string,
  payload: ApnsPayload,
): Promise<ApnsResult> {
  const BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID");
  if (!BUNDLE_ID) throw new Error("APNS_BUNDLE_ID is required");

  const jwt = await generateApnsJwt();

  const apsBody = {
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: payload.sound ?? "default",
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
      ...(payload.threadId ? { "thread-id": payload.threadId } : {}),
    },
    ...(payload.data ?? {}),
  };

  const url = `https://api.push.apple.com/3/device/${deviceToken}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": `bearer ${jwt}`,
      "apns-topic": BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
      ...(payload.collapseId ? { "apns-collapse-id": payload.collapseId } : {}),
    },
    body: JSON.stringify(apsBody),
  });

  let reason: string | undefined;
  if (!resp.ok) {
    try {
      const json = await resp.json();
      reason = json?.reason ?? JSON.stringify(json);
    } catch {
      reason = await resp.text().catch(() => "unknown");
    }
  }

  return { token: deviceToken, status: resp.status, reason };
}

/**
 * Send same payload to many tokens. Filters to platform === 'ios'.
 */
export async function sendApnsBatch(
  tokens: { token: string; platform: string }[],
  payload: ApnsPayload,
): Promise<ApnsResult[]> {
  const ios = tokens.filter((t) => t.platform === "ios");
  if (ios.length === 0) return [];
  // Chunked delivery — an unbounded Promise.all over every token exhausts the
  // isolate's socket pool once the user base grows (10k tokens = 10k parallel
  // fetches). 100 concurrent keeps APNs happy and the isolate healthy.
  const CHUNK = 100;
  const results: ApnsResult[] = [];
  for (let i = 0; i < ios.length; i += CHUNK) {
    const slice = ios.slice(i, i + CHUNK);
    const settled = await Promise.all(
      slice.map((t) =>
        sendApnsPush(t.token, payload).catch((e) => ({
          token: t.token,
          status: 0,
          reason: e instanceof Error ? e.message : String(e),
        })),
      ),
    );
    results.push(...settled);
  }
  return results;
}
