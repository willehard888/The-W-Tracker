---
name: Authentication Methods
description: Native Apple Sign In via custom Capacitor plugin (iOS), managed OAuth on web, username selection enforced for new Apple users
type: feature
---

## Apple Sign In

- **iOS native:** custom Capacitor plugin `NativeAppleAuth` (Swift) → `ASAuthorizationController` → returns identity token + nonce → `supabase.auth.signInWithIdToken({ provider: "apple" })`. No browser, native Face ID / Touch ID sheet.
- **Required iOS setup (CRITICAL):** `App.entitlements` must contain `com.apple.developer.applesignin = ["Default"]` and Xcode build settings must reference it via `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` for both Debug and Release. Without this, `ASAuthorizationError.unknown` is thrown.
- **Web preview / non-prod:** redirect to published `/apple-auth-launch` so Apple accepts the registered domain.
- **Web production:** Lovable Cloud managed OAuth via `lovable.auth.signInWithOAuth("apple", ...)`.
- **Username flow:** new Apple users with generic/missing username are forced through `/apple-username` selection (flag in sessionStorage).

## Email / Password

- Standard `supabase.auth.signUp` + `signInWithPassword` with email confirmation.
- `/reset-password` page handles `type=recovery` hash and calls `updateUser({ password })`.

## UI

- Apple button: black background, SF font stack, 44pt min height, subtle sheen animation, native press scale.
- "APPLE_CANCELLED" error code is silent (no toast).
