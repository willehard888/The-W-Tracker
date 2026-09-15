#!/usr/bin/env node
// One price everywhere. Reads the Finland price of each sold subscription
// (8,99 € / 89,99 €), asks Apple for the equalized price point in every
// other territory, and sets it there. Read-only by default; `--apply` writes.
//
//   node scripts/asc-subscription-prices.mjs [--apply] --key ~/Desktop/AuthKey_XXXX.p8 --key-id XXXX --issuer <uuid>
import { authFromArgs, makeAsc } from "./asc-client.mjs";

const SUBSCRIPTIONS = [
  { id: "6777661588", productId: "WhealthFactory499", base: "FIN", want: "8.99" },
  { id: "6763488546", productId: "eliteyearly4799", base: "FIN", want: "89.99" },
];
const SAMPLE = ["FIN", "USA", "GBR", "DEU", "SWE", "NOR", "JPN", "AUS"];

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const asc = makeAsc(authFromArgs(args));

/** Current price per territory: { TERRITORY: { pointId, price, currency } } */
const currentPrices = async (subId) => {
  const rows = await asc.getAll(`/v1/subscriptions/${subId}/prices?include=subscriptionPricePoint,territory&limit=200`);
  const points = new Map((rows.included ?? []).filter((i) => i.type === "subscriptionPricePoints").map((p) => [p.id, p]));
  const out = {};
  for (const r of rows) {
    const t = r.relationships?.territory?.data?.id;
    const pid = r.relationships?.subscriptionPricePoint?.data?.id;
    if (!t || !pid) continue;
    const p = points.get(pid);
    // Several rows can exist per territory (scheduled / preserved); the one
    // without a startDate, or the latest, is the live one.
    if (!out[t] || !r.attributes?.startDate) out[t] = { pointId: pid, price: p?.attributes?.customerPrice ?? "?", currency: p?.relationships?.territory?.data?.id ?? t, startDate: r.attributes?.startDate ?? null };
  }
  return out;
};

for (const sub of SUBSCRIPTIONS) {
  const cur = await currentPrices(sub.id);
  const base = cur[sub.base];
  console.log(`\n${sub.productId}: ${Object.keys(cur).length} territories priced`);
  console.log("  sample:", SAMPLE.map((t) => `${t}=${cur[t]?.price ?? "-"}`).join("  "));
  if (!base) { console.log(`  no ${sub.base} price found — nothing to equalize from`); continue; }
  if (base.price !== sub.want) { console.log(`  ${sub.base} is ${base.price}, expected ${sub.want} — refusing to equalize from a wrong base`); continue; }

  const eq = await asc.getAll(`/v1/subscriptionPricePoints/${base.pointId}/equalizations?include=territory&limit=200`);
  const targets = eq.map((p) => ({ territory: p.relationships?.territory?.data?.id, pointId: p.id, price: p.attributes?.customerPrice })).filter((x) => x.territory);
  const todo = targets.filter((t) => cur[t.territory]?.pointId !== t.pointId);
  console.log(`  equalized points: ${targets.length} · already right: ${targets.length - todo.length} · to set: ${todo.length}`);
  console.log("  equalized sample:", SAMPLE.map((t) => `${t}=${targets.find((x) => x.territory === t)?.price ?? (t === sub.base ? base.price : "-")}`).join("  "));
  if (!APPLY) continue;

  let done = 0, failed = 0;
  for (const t of todo) {
    try {
      await asc.call("POST", "/v1/subscriptionPrices", {
        data: {
          type: "subscriptionPrices",
          attributes: { preserveCurrentPrice: false, startDate: null },
          relationships: {
            subscription: { data: { type: "subscriptions", id: sub.id } },
            subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: t.pointId } },
            territory: { data: { type: "territories", id: t.territory } },
          },
        },
      });
      done++;
    } catch (e) { failed++; console.log(`  ${t.territory}: ${String(e.message).slice(0, 160)}`); }
  }
  console.log(`  set ${done}, failed ${failed}`);
  const after = await currentPrices(sub.id);
  console.log("  after:", SAMPLE.map((t) => `${t}=${after[t]?.price ?? "-"}`).join("  "));
}
