// App Store Connect API client shared by the scripts/asc-*.mjs tools.
// Zero deps: ES256 JWT via node:crypto. Auth from --key/--key-id/--issuer
// flags or ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY (PEM content).
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

export const APP_ID = "6761115803";

export const authFromArgs = (args) => {
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const keyId = flag("--key-id") ?? process.env.ASC_KEY_ID;
  const issuer = flag("--issuer") ?? process.env.ASC_ISSUER_ID;
  const pem = flag("--key") ? readFileSync(flag("--key"), "utf8") : process.env.ASC_PRIVATE_KEY;
  if (!keyId || !issuer || !pem) {
    console.error("Need --key <path> --key-id <id> --issuer <uuid>, or ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY");
    process.exit(1);
  }
  return { keyId, issuer, pem };
};

export const makeAsc = ({ keyId, issuer, pem }) => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  let token = null, tokenExp = 0;
  const jwt = () => {
    const now = Math.floor(Date.now() / 1000);
    if (token && now < tokenExp - 60) return token;
    const unsigned = `${b64({ alg: "ES256", kid: keyId, typ: "JWT" })}.${b64({ iss: issuer, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" })}`;
    const sig = sign("sha256", Buffer.from(unsigned), { key: createPrivateKey(pem), dsaEncoding: "ieee-p1363" }).toString("base64url");
    token = `${unsigned}.${sig}`; tokenExp = now + 1200;
    return token;
  };
  const API = "https://api.appstoreconnect.apple.com";
  const call = async (method, path, body, attempt = 1) => {
    const r = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${jwt()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    // ASC returns a transient 500 now and then on writes; one retry has always been enough.
    if ((r.status === 500 || r.status === 503 || r.status === 429) && attempt < 3) {
      await new Promise((res) => setTimeout(res, 800 * attempt));
      return call(method, path, body, attempt + 1);
    }
    if (!r.ok) throw new Error(`${r.status} ${method} ${path}: ${text.slice(0, 400)}`);
    return text ? JSON.parse(text) : null;
  };
  const get = (p) => call("GET", p);
  const getAll = async (p) => { const out = []; let next = p; while (next) { const page = await get(next); out.push(...page.data); out.included = [...(out.included ?? []), ...(page.included ?? [])]; next = page.links?.next ?? null; } return out; };
  return { call, get, getAll };
};
