#!/usr/bin/env node
// The yearly plan inside the Whealth Factory subscription group. Apple cannot
// move a subscription between groups, and eliteyearly4799 was created in
// "Elite Monthly" — so monthly and yearly were unrelated products (no
// upgrade/downgrade, both could be held at once). This creates
// WhealthFactoryYearly next to WhealthFactory499 and configures it fully:
// localization, 89,99 € in Finland + Apple's equalization everywhere,
// availability everywhere, the review screenshot. Idempotent per step.
//
//   node scripts/asc-create-yearly.mjs --screenshot <png> --key … --key-id … --issuer …
import { authFromArgs, makeAsc, priceEverywhere, setAvailabilityEverywhere, uploadReviewScreenshot } from "./asc-client.mjs";

const GROUP_ID = "22140122"; // "Whealth Factory" — holds WhealthFactory499
const PRODUCT_ID = "WhealthFactoryYearly";
const NAME = "Whealth Factory Yearly";
const DESCRIPTION = "Full access to Whealth Factory, billed yearly.";
const BASE = { territory: "FIN", price: "89.99" };

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const asc = makeAsc(authFromArgs(args));

// 1. The subscription itself, created once.
const members = await asc.get(`/v1/subscriptionGroups/${GROUP_ID}/subscriptions?limit=20`);
let sub = members.data.find((s) => s.attributes.productId === PRODUCT_ID);
if (!sub) {
  const created = await asc.call("POST", "/v1/subscriptions", {
    data: {
      type: "subscriptions",
      attributes: { name: NAME, productId: PRODUCT_ID, subscriptionPeriod: "ONE_YEAR", familySharable: false, groupLevel: 1 },
      relationships: { group: { data: { type: "subscriptionGroups", id: GROUP_ID } } },
    },
  });
  sub = created.data;
  console.log(`created ${PRODUCT_ID} (${sub.id}) in group ${GROUP_ID}, level 1`);
} else {
  console.log(`${PRODUCT_ID} exists (${sub.id}) · state ${sub.attributes.state}`);
}

// 2. Localization.
const locs = await asc.get(`/v1/subscriptions/${sub.id}/subscriptionLocalizations`);
if (!locs.data.some((l) => l.attributes.locale === "en-US")) {
  await asc.call("POST", "/v1/subscriptionLocalizations", {
    data: { type: "subscriptionLocalizations", attributes: { locale: "en-US", name: NAME, description: DESCRIPTION }, relationships: { subscription: { data: { type: "subscriptions", id: sub.id } } } },
  });
  console.log("localization en-US added");
} else console.log("localization en-US present");

// 3. Prices.
const prices = await asc.getAll(`/v1/subscriptions/${sub.id}/prices?include=subscriptionPricePoint&limit=200`);
if (prices.length < 175) {
  const { done, failed } = await priceEverywhere(asc, sub.id, BASE.territory, BASE.price);
  console.log(`prices set in ${done} territories${failed.length ? `, failed: ${failed.join(",")}` : ""}`);
} else console.log(`prices present in ${prices.length} territories`);

// 4. Availability.
const av = await asc.get(`/v1/subscriptions/${sub.id}/subscriptionAvailability`).catch(() => null);
if (!av) console.log(`availability set for ${await setAvailabilityEverywhere(asc, sub.id)} territories`);
else console.log("availability present");

// 5. Review screenshot.
const shot = await asc.get(`/v1/subscriptions/${sub.id}/appStoreReviewScreenshot`).catch(() => null);
if (!shot?.data && flag("--screenshot")) { await uploadReviewScreenshot(asc, sub.id, flag("--screenshot")); console.log("review screenshot uploaded"); }
else console.log(shot?.data ? "review screenshot present" : "review screenshot skipped (no --screenshot)");

// 6. Where it stands.
const final = await asc.get(`/v1/subscriptions/${sub.id}`);
const sample = await asc.getAll(`/v1/subscriptions/${sub.id}/prices?include=subscriptionPricePoint&limit=200`);
const pts = new Map((sample.included ?? []).filter((i) => i.type === "subscriptionPricePoints").map((p) => [p.id, p.attributes.customerPrice]));
const priceOf = (t) => { const row = sample.find((r) => r.relationships?.territory?.data?.id === t); return row ? pts.get(row.relationships.subscriptionPricePoint.data.id) : "-"; };
console.log(`\n${PRODUCT_ID}: ${final.data.attributes.state} · FIN ${priceOf("FIN")} · USA ${priceOf("USA")} · DEU ${priceOf("DEU")} · SWE ${priceOf("SWE")} · territories priced ${sample.length}`);
