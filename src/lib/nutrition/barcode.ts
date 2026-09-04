// Barcode normalisation — mirrors SQL `normalize_barcode(text)`: digits only,
// UPC-A (12) → EAN-13 with a leading 0, 14-digit GTIN with a leading 0 → 13,
// EAN-8 stays 8, GS1 mod-10 must hold. UPC-E is expanded client-side first
// (the scanner tells us the symbology; the server never sees UPC-E).

export type BarcodeFormat = "EAN_8" | "EAN_13" | "UPC_A" | "UPC_E";

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

/** Any scanned/typed code → the EAN-8/EAN-13 key used by `food_barcodes`, or invalid. */
export function normalizeBarcode(raw: string, format?: BarcodeFormat | string): NormalizeResult {
  let digits = raw.replace(/\D/g, "");
  if (format === "UPC_E") {
    const upcA = expandUpcE(digits);
    if (!upcA) return INVALID;
    digits = upcA;
  }
  if (digits.length === 14 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 12) digits = `0${digits}`;
  if (digits.length !== 8 && digits.length !== 13) return INVALID;
  return isValidGs1(digits) ? { ok: true, code: digits } : INVALID;
}
