/**
 * Batch-scaling for recipe shopping lists (1×–5×).
 * Extracted from Recipes.tsx so the math users shop from is unit-tested.
 */

/** Scale a base (1-serving) quantity by the batch size and format cleanly. */
export const fmtQty = (qty: number | undefined, batch: number): string => {
  if (qty == null) return "";
  const v = Math.round(qty * batch * 100) / 100;
  return String(v);
};
