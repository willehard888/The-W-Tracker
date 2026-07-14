import { createPortal } from "react-dom";
import type { ReactNode } from "react";

/**
 * Render children into <body>, escaping the app's scroll container.
 *
 * On iOS WKWebView a `position: fixed` element that lives inside an
 * `overflow: auto` scroller is confined to that scroller's box (it can't cover
 * the sticky header or the bottom nav that sit outside it). Every full-screen
 * overlay rendered from within a page must portal to <body> so it's truly
 * viewport-fixed. Chrome doesn't have the quirk, so this only bites on device.
 *
 * SPA-only (no SSR) → document.body always exists at render, so we portal
 * directly without a mount guard (keeps AnimatePresence enter animations intact).
 */
export const Portal = ({ children }: { children: ReactNode }) => {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
};

export default Portal;
