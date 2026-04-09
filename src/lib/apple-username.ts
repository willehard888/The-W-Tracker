const APPLE_USERNAME_PENDING_KEY = "w_apple_username_pending";

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