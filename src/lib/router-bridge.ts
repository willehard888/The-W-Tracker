import type { NavigateFunction } from "react-router-dom";

/**
 * navigate() for code that lives outside React: native listeners (a push tap
 * can arrive before the router has mounted on a cold start). A raw
 * `history.pushState({}, …)` here used to drop the router's `idx`, after
 * which `backOr` fell to its fallback for the rest of the session.
 */
let nav: NavigateFunction | null = null;
let pending: string | null = null;

export const setNavigator = (fn: NavigateFunction): void => {
  nav = fn;
  if (pending) {
    const route = pending;
    pending = null;
    fn(route);
  }
};

/** Navigates now, or as soon as the router mounts. */
export const navigateSafely = (route: string): void => {
  if (nav) nav(route);
  else pending = route;
};
