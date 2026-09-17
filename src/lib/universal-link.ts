/**
 * The app's one public web address, and which of its links the native app
 * claims as universal links.
 *
 * `www` on purpose: the apex answers 308 to www, and Apple never follows a
 * redirect when it fetches the association file, so only www links can open
 * the app. Inside the native shell `window.location.origin` is
 * `app://localhost`: any link built from it (a share link, an auth email's
 * redirect) was an address nobody could open.
 */
export const WEB_ORIGIN = "https://www.whealthfactory.com";

const WEB_HOSTS = new Set(["www.whealthfactory.com", "whealthfactory.com"]);

/** Where auth emails send people back to: this page on the web, the public site from the app. */
export const authRedirectOrigin = (): string =>
  typeof window !== "undefined" && /^https?:$/.test(window.location.protocol) ? window.location.origin : WEB_ORIGIN;

const CLAIMED: RegExp[] = [/^\/reset-password\/?$/, /^\/u\/[^/]+\/?$/, /^\/tribes\/[^/]+\/?$/];

/**
 * The in-app route for a universal link, or null when the URL is not one of
 * ours. Only the paths in the association file, only https, only our hosts:
 * this is fed straight into the router. Query and hash ride along (a recovery
 * link carries its tokens in the hash, and ResetPassword applies them itself).
 */
export const universalLinkRoute = (raw: string): string | null => {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:" || !WEB_HOSTS.has(url.hostname)) return null;
  if (!CLAIMED.some((re) => re.test(url.pathname))) return null;
  return `${url.pathname}${url.search}${url.hash}`;
};
