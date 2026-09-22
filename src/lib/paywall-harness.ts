/**
 * The paywall harness: `?paywallDev=1` forces the paywall gate CLOSED so the
 * offer screen can be exercised as a member; `?paywallDev=0`
 * releases it. It never opens access — it only shows the paywall to someone
 * who would otherwise pass. Sticky through sessionStorage because SPA
 * navigation drops the query. Live in dev builds and for admin accounts in
 * any build, so sandbox purchases can be driven on the simulator and on
 * TestFlight, where there is no dev server.
 */
export const HARNESS_KEY = "w_paywall_dev";

export const readHarnessParam = (search: string): "on" | "off" | null => {
  const v = new URLSearchParams(search).get("paywallDev");
  if (v === null) return null;
  return v === "0" || v === "false" ? "off" : "on";
};

export const shouldForcePaywall = (o: { dev: boolean; isAdmin: boolean; param: "on" | "off" | null; sticky: boolean }): boolean => {
  if (!o.dev && !o.isAdmin) return false;
  if (o.param === "off") return false;
  return o.param === "on" || o.sticky;
};
