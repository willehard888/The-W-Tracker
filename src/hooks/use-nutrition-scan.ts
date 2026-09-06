import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downscaleImage } from "@/lib/downscale-image";
import { blobToDataUrl, validateFile } from "@/lib/moderation-preflight";
import { parseScanResponse, type ScanResponse } from "@/lib/nutrition/scan-types";
import type { MealSlot } from "@/lib/nutrition/types";

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
  slot?: MealSlot;
  /** Second angle of the same meal — refines portions, never adds items. */
  sidePhoto?: File;
  /** The user's dinner-plate diameter (cm); the strongest size reference we have. */
  plateCm?: number;
}

/** 1024 px keeps a fork's tines and a label's small print legible at one or two model tiles. */
const SCAN_EDGE_PX = 1024;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const CLIENT_TIMEOUT_MS = 45_000;

const REASON_BY_CODE: Record<string, ScanFailureReason> = {
  ai_timeout: "timeout",
  invalid_ai_response: "invalid_response",
  scan_limit: "scan_limit",
  bad_image: "bad_image",
};

const byStatus = (status: number | undefined): ScanFailure => {
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

/** The function's own `{error, retryable}` body wins over the status map when present. */
const failureFor = (status: number | undefined, code: string | undefined, retryable: boolean | undefined): ScanFailure => {
  const fallback = byStatus(status);
  const reason = status === 403 ? "membership_required" : (code && REASON_BY_CODE[code]) || fallback.reason;
  return { reason, retryable: retryable ?? fallback.retryable };
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const localTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** One encode per photo: HEIC → JPEG, 1024 px, orientation baked in. Null when the result is not a JPEG the function accepts. */
async function encode(file: File): Promise<File | null> {
  const shrunk = await downscaleImage(file, { maxDim: SCAN_EDGE_PX, quality: 0.85, skipUnder: 0 });
  return shrunk.type === "image/jpeg" && shrunk.size <= MAX_IMAGE_BYTES ? shrunk : null;
}

/**
 * Photo → `nutrition-scan` → typed, estimated items. Each image is encoded
 * ONCE on the device (the same JPEG is what "Keep the photo" uploads), sent
 * as a data URL, and the answer is validated before it reaches the review
 * screen; a malformed answer is a failure, never a half-parsed meal. Nothing
 * here writes to the diary — saving happens only after the user confirms.
 */
export const useNutritionScan = () => {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [failure, setFailure] = useState<ScanFailure | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const encoded = useRef<File | null>(null);

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
      let b64Two: string | undefined;
      try {
        const main = await encode(file);
        if (!main) return fail({ reason: "bad_image", retryable: false });
        encoded.current = main;
        b64 = await blobToDataUrl(main);
        if (opts.sidePhoto) {
          const side = await encode(opts.sidePhoto);
          if (!side) return fail({ reason: "bad_image", retryable: false });
          b64Two = await blobToDataUrl(side);
        }
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
            body: {
              image_b64: b64,
              image_b64_2: b64Two,
              hint: opts.hint?.slice(0, 200),
              locale: opts.locale,
              country: opts.country,
              slot: opts.slot,
              local_time: localTime(),
              plate_cm: opts.plateCm,
            },
          }),
          timedOut,
        ]);
        if (race === "timeout") return fail({ reason: "timeout", retryable: true });
        const { data, error } = race;
        if (error) {
          // FunctionsHttpError carries the Response on `context` (same reading as use-daily-plan).
          const ctx = (error as { context?: { status?: number; json?: () => Promise<unknown> } }).context;
          let code: string | undefined;
          let retryable: boolean | undefined;
          try {
            const body = await ctx?.json?.();
            if (isRecord(body)) {
              if (typeof body.error === "string") code = body.error;
              if (typeof body.retryable === "boolean") retryable = body.retryable;
            }
          } catch {
            /* no JSON body — the status map decides */
          }
          return fail(failureFor(ctx?.status, code, retryable));
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
    encoded.current = null;
    setStatus("idle");
    setResult(null);
    setFailure(null);
  }, []);

  return { status, result, failure, scan, cancel, reset, encoded };
};
