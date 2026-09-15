#!/usr/bin/env node
// App Store Connect subscriptions — status by default, `--apply` to complete the
// metadata that keeps a product in MISSING_METADATA (review screenshot,
// availability, group-name fix). Zero deps: ES256 JWT via node:crypto, like
// scripts/testflight-distribute.mjs.
//
//   node scripts/asc-subscriptions.mjs [--key ~/Desktop/AuthKey_XXXX.p8 --key-id XXXX --issuer <uuid>]
//   node scripts/asc-subscriptions.mjs --apply --screenshot paywall.png [same auth flags]
//
// Env alternative: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (PEM content).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { APP_ID, authFromArgs, makeAsc } from "./asc-client.mjs";

// The two products the paywall sells (RevenueCat offering `default`).
const SUBSCRIPTIONS = [
  { id: "6777661588", productId: "WhealthFactory499" },
  { id: "6763488546", productId: "eliteyearly4799" },
];
const GROUP_NAME_FIX = { from: "Wealth Factory", to: "Whealth Factory" };

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const APPLY = args.includes("--apply");
const SCREENSHOT = flag("--screenshot");
const { call, get } = makeAsc(authFromArgs(args));

// ── status ─────────────────────────────────────────────────────────────────
const groups = await get(`/v1/apps/${APP_ID}/subscriptionGroups?limit=10`);
const groupLocs = [];
for (const g of groups.data) {
  const gl = await get(`/v1/subscriptionGroups/${g.id}/subscriptionGroupLocalizations`);
  for (const l of gl.data) groupLocs.push({ group: g.attributes.referenceName, id: l.id, locale: l.attributes.locale, name: l.attributes.name, state: l.attributes.state });
}
const status = async (sub) => {
  const s = await get(`/v1/subscriptions/${sub.id}`);
  const loc = await get(`/v1/subscriptions/${sub.id}/subscriptionLocalizations`);
  let shot = null;
  try { shot = (await get(`/v1/subscriptions/${sub.id}/appStoreReviewScreenshot`)).data; } catch { /* none */ }
  let avail = null;
  try { avail = (await get(`/v1/subscriptions/${sub.id}/subscriptionAvailability`)).data; } catch { /* none */ }
  return {
    state: s.data.attributes.state,
    name: s.data.attributes.name,
    locales: loc.data.map((l) => `${l.attributes.locale}:${l.attributes.state}`),
    screenshot: shot ? `${shot.attributes.assetDeliveryState?.state ?? "?"} ${shot.attributes.fileName ?? ""}`.trim() : null,
    availability: avail ? `availableInNewTerritories=${avail.attributes.availableInNewTerritories}` : null,
  };
};
const print = async (label) => {
  console.log(`\n${label}`);
  for (const sub of SUBSCRIPTIONS) {
    const st = await status(sub);
    console.log(`  ${sub.productId}: ${st.state} · locales ${st.locales.join(",")} · screenshot ${st.screenshot ?? "NONE"} · availability ${st.availability ?? "NONE"}`);
  }
  for (const l of groupLocs) console.log(`  group "${l.group}" ${l.locale}: "${l.name}" (${l.state})`);
};
await print("STATUS");
if (!APPLY) process.exit(0);

// ── apply ──────────────────────────────────────────────────────────────────
// 1. Group name typo.
for (const l of groupLocs) {
  if (l.name === GROUP_NAME_FIX.from) {
    await call("PATCH", `/v1/subscriptionGroupLocalizations/${l.id}`, {
      data: { type: "subscriptionGroupLocalizations", id: l.id, attributes: { name: GROUP_NAME_FIX.to } },
    });
    console.log(`group localization ${l.id}: "${l.name}" → "${GROUP_NAME_FIX.to}"`);
  }
}

// 2. Availability: every territory, and new territories as they appear.
const territories = [];
let next = `/v1/territories?limit=200`;
while (next) { const page = await get(next); territories.push(...page.data.map((t) => t.id)); next = page.links?.next ?? null; }
for (const sub of SUBSCRIPTIONS) {
  const st = await status(sub);
  if (st.availability) { console.log(`${sub.productId}: availability already set`); continue; }
  await call("POST", `/v1/subscriptionAvailabilities`, {
    data: {
      type: "subscriptionAvailabilities",
      attributes: { availableInNewTerritories: true },
      relationships: {
        subscription: { data: { type: "subscriptions", id: sub.id } },
        availableTerritories: { data: territories.map((id) => ({ type: "territories", id })) },
      },
    },
  });
  console.log(`${sub.productId}: availability set for ${territories.length} territories`);
}

// 3. Review screenshot: reserve → upload → commit.
if (SCREENSHOT) {
  const bytes = readFileSync(SCREENSHOT);
  const fileName = SCREENSHOT.split("/").pop();
  const md5 = createHash("md5").update(bytes).digest("hex");
  for (const sub of SUBSCRIPTIONS) {
    const st = await status(sub);
    if (st.screenshot) { console.log(`${sub.productId}: screenshot already present (${st.screenshot})`); continue; }
    const reserved = await call("POST", `/v1/subscriptionAppStoreReviewScreenshots`, {
      data: {
        type: "subscriptionAppStoreReviewScreenshots",
        attributes: { fileName, fileSize: bytes.length },
        relationships: { subscription: { data: { type: "subscriptions", id: sub.id } } },
      },
    });
    const ops = reserved.data.attributes.uploadOperations ?? [];
    for (const op of ops) {
      const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
      const r = await fetch(op.url, { method: op.method, headers, body: bytes.subarray(op.offset, op.offset + op.length) });
      if (!r.ok) throw new Error(`upload chunk failed ${r.status}`);
    }
    await call("PATCH", `/v1/subscriptionAppStoreReviewScreenshots/${reserved.data.id}`, {
      data: { type: "subscriptionAppStoreReviewScreenshots", id: reserved.data.id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
    });
    console.log(`${sub.productId}: screenshot uploaded (${ops.length} part${ops.length === 1 ? "" : "s"}, ${bytes.length} bytes)`);
  }
}

await print("AFTER");
