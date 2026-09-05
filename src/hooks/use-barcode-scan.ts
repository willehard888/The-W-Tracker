import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  checkCameraPermission,
  isBarcodeScanSupported,
  openAppSettings,
  scanBarcode,
} from "@/lib/native/barcode-scan";
import { normalizeBarcode } from "@/lib/nutrition/barcode";

export type BarcodeScanOutcome =
  | { kind: "code"; code: string; raw: string; format: string }
  | { kind: "cancelled" }
  | { kind: "denied" }
  | { kind: "unreadable"; raw: string }
  | { kind: "unsupported" }
  | { kind: "unavailable" };

/**
 * Native barcode capture, normalised to the EAN-8/EAN-13 the catalog keys on.
 * Deliberately stops at the code: looking it up (catalog → online → "not
 * found, nothing invented") is the search sheet's job, so this hook has no
 * data dependency and is trivially testable.
 */
export const useBarcodeScan = () => {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let alive = true;
    void isBarcodeScanSupported().then((s) => {
      if (alive) setSupported(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const scan = useCallback(async (): Promise<BarcodeScanOutcome> => {
    if (!supported) return { kind: "unsupported" };
    if ((await checkCameraPermission()) === "denied") return { kind: "denied" };
    const r = await scanBarcode();
    if (r.denied) return { kind: "denied" };
    if (r.unavailable) return { kind: "unavailable" };
    if (!r.barcode) return { kind: "cancelled" };
    const n = normalizeBarcode(r.barcode.rawValue, r.barcode.format);
    if (!n.ok) return { kind: "unreadable", raw: r.barcode.rawValue };
    return { kind: "code", code: n.code, raw: r.barcode.rawValue, format: r.barcode.format };
  }, [supported]);

  return { supported, scan, openSettings: openAppSettings };
};
