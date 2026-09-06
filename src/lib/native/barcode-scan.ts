// Retail barcode scanning (EAN-8 / EAN-13 / UPC-E, plus ITF-14, Code 128 and
// GS1 Digital Link QR / Data Matrix) via our in-house AVFoundation plugin
// (ios/App/App/BarcodeScan.swift) — replaced @capacitor-mlkit, whose pods
// exclude arm64 simulators. UPC-A comes back as EAN_13 with a leading 0; the
// raw payload is returned as read, normalizeBarcode() digs the GTIN out.
// iOS-native only; every helper is fail-open (never throws to callers).
import { registerPlugin, Capacitor } from "@capacitor/core";

export type BarcodeFormat = "EAN_8" | "EAN_13" | "UPC_E" | "ITF_14" | "CODE_128" | "QR_CODE" | "DATA_MATRIX";
export type PermissionState = "granted" | "denied" | "prompt";
export interface ScanResult {
  barcode: { rawValue: string; format: BarcodeFormat } | null;
  cancelled?: boolean;
  denied?: boolean;
  /** No capture device right now (simulator, or the camera is held by another app). */
  unavailable?: boolean;
}

interface BarcodeScanPlugin {
  isSupported(): Promise<{ supported: boolean }>;
  checkPermissions(): Promise<{ camera: PermissionState }>;
  requestPermissions(): Promise<{ camera: PermissionState }>;
  openSettings(): Promise<void>;
  /** Presents the full-screen scanner; rejects with "camera_unavailable" when there is no camera. */
  scan(options?: { formats?: BarcodeFormat[] }): Promise<ScanResult>;
}

// No web impl → calls reject on web, which we catch (fail-open).
export const BarcodeScan = registerPlugin<BarcodeScanPlugin>("BarcodeScan");

const isNative = () => Capacitor.isNativePlatform();

/** True when a video capture device exists (false on web and in the simulator). */
export async function isBarcodeScanSupported(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return !!(await BarcodeScan.isSupported()).supported;
  } catch {
    return false;
  }
}

/** Current camera permission; "denied" off-native or on error. */
export async function checkCameraPermission(): Promise<PermissionState> {
  if (!isNative()) return "denied";
  try {
    return (await BarcodeScan.checkPermissions()).camera ?? "denied";
  } catch {
    return "denied";
  }
}

/** Prompts for camera access (no-op if already decided) and returns the resulting state. */
export async function requestCameraPermission(): Promise<PermissionState> {
  if (!isNative()) return "denied";
  try {
    return (await BarcodeScan.requestPermissions()).camera ?? "denied";
  } catch {
    return "denied";
  }
}

/** Opens the app's page in iOS Settings so the user can re-enable the camera. */
export async function openAppSettings(): Promise<void> {
  if (!isNative()) return;
  try {
    await BarcodeScan.openSettings();
  } catch {
    /* fail-open */
  }
}

/** Opens the scanner and resolves with the first code read; `{ barcode: null, cancelled: true }` on cancel/off-native, `unavailable` when there is no camera. */
export async function scanBarcode(formats?: BarcodeFormat[]): Promise<ScanResult> {
  if (!isNative()) return { barcode: null, cancelled: true };
  try {
    const r = await BarcodeScan.scan(formats?.length ? { formats } : undefined);
    return r?.barcode !== undefined ? r : { barcode: null, cancelled: true };
  } catch (e) {
    return { barcode: null, unavailable: /camera_unavailable/.test(String((e as Error)?.message ?? e)) };
  }
}
