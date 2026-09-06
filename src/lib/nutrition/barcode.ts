// Barcode normalisation — one of THREE MIRRORS that must agree (SQL
// `normalize_barcode(text)`, supabase/functions/nutrition-lookup/map.ts, this):
// digits only, UPC-A (12) → EAN-13 with a leading 0, GTIN-14 → its consumer-unit
// GTIN-13 (indicator 9 = variable measure → invalid), a 00000-padded 13 → EAN-8,
// GS1 mod-10 must hold. Client-only extras: UPC-E expansion, and digging the
// GTIN out of a Code 128 AI (01) or GS1 Digital Link (QR / Data Matrix) payload
// — the scanner tells us the symbology; the server only ever sees digits.

export type BarcodeFormat = "EAN_8" | "EAN_13" | "UPC_A" | "UPC_E" | "ITF_14" | "CODE_128" | "QR_CODE" | "DATA_MATRIX";

export type NormalizeResult = { ok: true; code: string } | { ok: false; reason: "invalid" };

const INVALID: NormalizeResult = { ok: false, reason: "invalid" };

/** GS1 check digit for `body` (the code without its check digit). */
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += Number(body[body.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

/** True for an 8/12/13/14-digit GTIN whose mod-10 check digit holds. */
export function isValidGs1(code: string): boolean {
  if (!/^(?:\d{8}|\d{12,14})$/.test(code)) return false;
  return gs1CheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

/** UPC-E (6/7/8 digits) → UPC-A (12 digits) via the five last-digit patterns; null when malformed. */
export function expandUpcE(digits: string): string | null {
  let ns = "0";
  let data: string;
  let check: string | null = null;
  if (digits.length === 6) data = digits;
  else if (digits.length === 7) { ns = digits[0]; data = digits.slice(1); }
  else if (digits.length === 8) { ns = digits[0]; data = digits.slice(1, 7); check = digits[7]; }
  else return null;
  if (ns !== "0" && ns !== "1") return null;
  const [d1, d2, d3, d4, d5, d6] = data;
  let body: string;
  if (d6 === "0" || d6 === "1" || d6 === "2") body = `${ns}${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === "3") body = `${ns}${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === "4") body = `${ns}${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${ns}${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  const computed = String(gs1CheckDigit(body));
  if (check !== null && check !== computed) return null;
  return body + computed;
}

/**
 * The GTIN a scan carries: AI (01) for Code 128, the `/01/` path segment of a
 * GS1 Digital Link for QR / Data Matrix; every other symbology IS the GTIN.
 * Null when the payload has none (a Wi-Fi QR, a shipping label).
 */
export function extractGtin(raw: string, format?: BarcodeFormat | string): string | null {
  if (format === "CODE_128") return /^01(\d{14})/.exec(raw)?.[1] ?? null;
  if (format === "QR_CODE" || format === "DATA_MATRIX") return /\/01\/(\d{8}|\d{12,14})(?=[/?#]|$)/.exec(raw)?.[1] ?? null;
  return raw;
}

/** Any scanned/typed code → the EAN-8/EAN-13 key used by `food_barcodes`, or invalid. */
export function normalizeBarcode(raw: string, format?: BarcodeFormat | string): NormalizeResult {
  const gtin = extractGtin(raw, format);
  if (gtin === null) return INVALID;
  let digits = gtin.replace(/\D/g, "");
  if (format === "UPC_E") {
    const upcA = expandUpcE(digits);
    if (!upcA) return INVALID;
    digits = upcA;
  }
  if (digits.length === 14) {
    // GTIN-14: the indicator digit is packaging level, not identity — the
    // consumer unit is digits 2-13 with a fresh check digit. 9 = variable
    // measure (priced by weight), which has no single consumer code.
    if (digits[0] === "9" || !isValidGs1(digits)) return INVALID;
    const body = digits.slice(1, 13);
    digits = body + gs1CheckDigit(body);
  }
  if (digits.length === 12) digits = `0${digits}`;
  if (digits.length === 13 && digits.startsWith("00000")) digits = digits.slice(5); // zero-padded EAN-8
  if (digits.length !== 8 && digits.length !== 13) return INVALID;
  return isValidGs1(digits) ? { ok: true, code: digits } : INVALID;
}
