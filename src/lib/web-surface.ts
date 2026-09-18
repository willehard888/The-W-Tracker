/**
 * There is no web version of Whealth Factory. The public website serves a static
 * page about the product and the company, and borrows the React app for exactly
 * three pages that must work in a browser: the Privacy Policy and the Terms (the
 * App Store links to both, and App Review opens them), and password reset (a
 * recovery email can never open the app directly — it finishes on the web).
 *
 * vercel.json already refuses every other path, but a page that is served can
 * still navigate inside the browser without asking the server: the back button
 * on /privacy went to "/", which led to the landing page, sign-up and the whole
 * app. This is the second lock, on the client.
 *
 * Only the production hosts are locked. The native shell (capacitor/app://
 * localhost), local development and preview deployments are left alone.
 */
export const WEB_ROUTES: ReadonlySet<string> = new Set(["/privacy", "/terms", "/reset-password"]);

export const WEB_EXIT = "/waitlist";

export const isPublicWebHost = (hostname: string): boolean => /(^|\.)whealthfactory\.com$/i.test(hostname);

/** Where the browser must go instead, or null when this page may render. */
export function webExitFor(hostname: string, pathname: string, native: boolean): string | null {
  if (native || !isPublicWebHost(hostname)) return null;
  const path = pathname.replace(/\/+$/, "") || "/";
  return WEB_ROUTES.has(path) ? null : WEB_EXIT;
}
