import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useBarcodeScan, type BarcodeScanOutcome } from "@/hooks/use-barcode-scan";

/**
 * The hook owns one decision: what a raw native read becomes. Pins the new
 * outcomes — no camera, a GTIN-14 symbology, a QR that is not a GS1 link.
 */
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
const native = vi.hoisted(() => ({ scanBarcode: vi.fn() }));
vi.mock("@/lib/native/barcode-scan", () => ({
  isBarcodeScanSupported: async () => true,
  checkCameraPermission: async () => "granted",
  openAppSettings: vi.fn(),
  scanBarcode: native.scanBarcode,
}));

const scanWith = async (result: unknown): Promise<BarcodeScanOutcome | undefined> => {
  native.scanBarcode.mockResolvedValue(result);
  const { result: hook } = renderHook(() => useBarcodeScan());
  await waitFor(() => expect(hook.current.supported).toBe(true));
  let out: BarcodeScanOutcome | undefined;
  await act(async () => {
    out = await hook.current.scan();
  });
  return out;
};

describe("useBarcodeScan", () => {
  it("reports a missing camera as unavailable", async () => {
    expect(await scanWith({ barcode: null, unavailable: true })).toEqual({ kind: "unavailable" });
  });

  it("normalises an ITF-14 to the consumer-unit EAN-13", async () => {
    expect(await scanWith({ barcode: { rawValue: "14006381333938", format: "ITF_14" } })).toEqual({
      kind: "code",
      code: "4006381333931",
      raw: "14006381333938",
      format: "ITF_14",
    });
  });

  it("calls a QR without a GS1 Digital Link unreadable", async () => {
    expect(await scanWith({ barcode: { rawValue: "https://example.com", format: "QR_CODE" } })).toEqual({
      kind: "unreadable",
      raw: "https://example.com",
    });
  });
});
