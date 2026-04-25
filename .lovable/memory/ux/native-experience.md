---
name: Native iOS shell experience
description: initNativeShell + Capacitor StatusBar/Keyboard config, native:resume hook for query invalidation
type: feature
---

`src/lib/native-bootstrap.ts` runs on app boot (before React mount):
- Adds `is-native` + `is-ios` body classes for CSS targeting (safe-area, user-select, font smoothing).
- Configures `@capacitor/status-bar`: dark style + overlay on webview (transparent).
- Configures `@capacitor/keyboard`: resize=None + scroll disabled; we scroll the focused input into view ourselves on `keyboardWillShow` for a smooth iOS-native feel (no jolt).
- Listens to `@capacitor/app` `resume` → re-dispatches `visibilitychange` (re-engages flame/particle rAF loops) and emits `native:resume` window event.

`App.tsx` listens for `native:resume` and invalidates hot React Query caches: leaderboard, messages, profile, streak.

`capacitor.config.json` declares matching defaults (StatusBar overlay + dark style, Keyboard resize=none, SplashScreen 600ms launchShowDuration with `#0a0710` background) so the native shell matches the React splash and there's no flicker.

Plugins: `@capacitor/status-bar`, `@capacitor/keyboard`, `@capacitor/app`, `@capacitor/haptics` already in `BottomNav` and key buttons.
