import type { NavigateFunction } from "react-router-dom";

/**
 * Back if there is somewhere to go back to. A deep link (a push tap, a share
 * link) or a cold start has no in-app history; `navigate(-1)` there was a
 * dead tap, or bounced the user out of the app. React Router keeps its own
 * index in `history.state.idx`, which is 0 on the entry.
 */
export const backOr = (navigate: NavigateFunction, fallback = "/"): void => {
  const state = window.history.state as { idx?: number } | null;
  if (typeof state?.idx === "number" && state.idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
};
