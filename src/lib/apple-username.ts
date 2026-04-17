const APPLE_USERNAME_PENDING_KEY = "w_apple_username_pending";
const APPLE_AUTH_STARTED_KEY = "w_apple_auth_started";

export function markAppleUsernameSelectionPending() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(APPLE_USERNAME_PENDING_KEY, "1");
}

export function clearAppleUsernameSelectionPending() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(APPLE_USERNAME_PENDING_KEY);
}

export function isAppleUsernameSelectionPending() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(APPLE_USERNAME_PENDING_KEY) === "1";
}

export function markAppleAuthStarted() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(APPLE_AUTH_STARTED_KEY, "1");
}

export function clearAppleAuthStarted() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(APPLE_AUTH_STARTED_KEY);
}

export function isAppleAuthStarted() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(APPLE_AUTH_STARTED_KEY) === "1";
}