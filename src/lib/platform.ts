import { Capacitor } from "@capacitor/core";

/**
 * Returns true when running inside a native Capacitor shell (iOS / Android).
 * Returns false for web / PWA.
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

export const getPlatform = (): "ios" | "android" | "web" => {
  const p = Capacitor.getPlatform();
  if (p === "ios") return "ios";
  if (p === "android") return "android";
  return "web";
};
