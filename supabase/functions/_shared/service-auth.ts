/**
 * The one gate for functions only cron and the service role may call.
 *
 * Exact service-role key match, nothing else. Five of the ten copies this
 * replaces still carried a fallback that decoded the JWT payload WITHOUT
 * verifying its signature and believed `role: "service_role"`. It is not
 * reachable today because the platform verifies the JWT first, but it is one
 * `verify_jwt = false` in config.toml away from being a full auth bypass —
 * and that line is added for webhooks without anybody re-reading this file.
 *
 * Key rotation stays safe because cron passes the key from the vault, which
 * rotates with it; the fallback never protected anything the vault did not.
 */
export function isServiceRole(token: string, envKey: string): boolean {
  if (!token || !envKey) return false;
  return token === envKey;
}

/** The Authorization header as a bare token. */
export function bearer(req: Request): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
}
