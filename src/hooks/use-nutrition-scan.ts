import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downscaleImage } from "@/lib/downscale-image";
import { generateThumbnail, validateFile } from "@/lib/moderation-preflight";
import { parseScanResponse, type ScanResponse } from "@/lib/nutrition/scan-types";

export type ScanStatus = "idle" | "preparing" | "analyzing" | "done" | "error";
export type ScanFailureReason =
  | "offline"
  | "bad_image"
  | "membership_required"
  | "scan_limit"
  | "timeout"
  | "invalid_response"
  | "failed";
export interface ScanFailure {
  reason: ScanFailureReason;
  retryable: boolean;
}
export interface ScanOptions {
  hint?: string;
  locale?: "fi" | "en";
  country?: string;
}

/** 768 px is the last size that costs one or two model tiles and still separates rice from couscous. */
const SCAN_EDGE_PX = 768;
const CLIENT_TIMEOUT_MS = 45_000;

const failureFor = (status: number | undefined): ScanFailure => {
  switch (status) {
    case 400:
      return { reason: "bad_image", retryable: false };
    case 403:
      return { reason: "membership_required", retryable: false };
    case 429:
      return { reason: "scan_limit", retryable: false };
    case 502:
      return { reason: "invalid_response", retryable: true };
    case 504:
      return { reason: "timeout", retryable: true };
    default:
      return { reason: "failed", retryable: true };
  }
};

/**
 * Photo → `nutrition-scan` → typed, estimated items. The image is shrunk on
 * the device (HEIC → JPEG, 768 px, fail-open), sent as a data URL, and the
 * answer is validated before it reaches the review screen; a malformed
 * answer is a failure, never a half-parsed meal. Nothing here writes to the
 * diary — saving happens only after the user confirms.
 */
export const useNutritionScan = () => {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [failure, setFailure] = useState<ScanFailure | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fail = useCallback((f: ScanFailure) => {
    setFailure(f);
    setStatus("error");
    return null;
  }, []);

  const scan = useCallback(
    async (file: File, opts: ScanOptions = {}): Promise<ScanResponse | null> => {
      setFailure(null);
      setResult(null);
      const pre = validateFile(file);
      if (!pre.ok) return fail({ reason: "bad_image", retryable: false });
      if (typeof navigator !== "undefined" && navigator.onLine === false) return fail({ reason: "offline", retryable: true });

      setStatus("preparing");
      let b64: string;
      try {
        const shrunk = await downscaleImage(file, { maxDim: SCAN_EDGE_PX, quality: 0.85 });
        b64 = (await generateThumbnail(shrunk, SCAN_EDGE_PX)).b64;
      } catch {
        return fail({ reason: "bad_image", retryable: false });
      }

      setStatus("analyzing");
      const controller = new AbortController();
      abortRef.current = controller;
      const timedOut = new Promise<"timeout">((resolve) => {
        const t = setTimeout(() => resolve("timeout"), CLIENT_TIMEOUT_MS);
        controller.signal.addEventListener("abort", () => {
          clearTimeout(t);
          resolve("timeout");
        });
      });

      try {
        const race = await Promise.race([
          supabase.functions.invoke("nutrition-scan", {
            body: { image_b64: b64, hint: opts.hint?.slice(0, 200), locale: opts.locale, country: opts.country },
          }),
          timedOut,
        ]);
        if (race === "timeout") return fail({ reason: "timeout", retryable: true });
        const { data, error } = race;
        if (error) {
          // FunctionsHttpError carries the Response on `context` (same reading as use-daily-plan).
          const status = (error as { context?: { status?: number } }).context?.status;
          return fail(failureFor(status));
        }
        const parsed = parseScanResponse(data);
        if (!parsed) return fail({ reason: "invalid_response", retryable: true });
        setResult(parsed);
        setStatus("done");
        return parsed;
      } catch {
        return fail({ reason: controller.signal.aborted ? "timeout" : "failed", retryable: true });
      } finally {
        abortRef.current = null;
      }
    },
    [fail],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setResult(null);
    setFailure(null);
  }, []);

  return { status, result, failure, scan, cancel, reset };
};
