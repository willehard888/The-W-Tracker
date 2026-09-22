#!/usr/bin/env node
// Free trial on the subscriptions — an App Store introductory offer.
//
//   node scripts/asc-intro-offer.mjs --key ~/Desktop/AuthKey_XXXX.p8 --key-id XXXX --issuer <uuid> [--duration TWO_WEEKS] [--dry]
//
// Apple's trial lengths are fixed (THREE_DAYS, ONE_WEEK, TWO_WEEKS, ONE_MONTH,
// TWO_MONTHS, THREE_MONTHS, SIX_MONTHS, ONE_YEAR). ASC wants one offer row per
// territory (a POST without `territory` is refused with 409), so this loops
// the territories the way priceEverywhere() does and skips the ones already
// covered. Both subscriptions live in one group, so Apple grants the trial
// once per Apple ID across monthly and yearly.
import { allTerritories, authFromArgs, makeAsc } from "./asc-client.mjs";

const SUBS = [
  { name: "WhealthFactory499 (monthly)", id: "6777661588" },
  { name: "WhealthFactoryYearly", id: "6812406763" },
];

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const duration = flag("--duration", "TWO_WEEKS");
const dry = args.includes("--dry");
const asc = makeAsc(authFromArgs(args));

const territories = await allTerritories(asc);
console.log(`${territories.length} territories`);

const coveredTerritories = async (subId) => {
  const rows = await asc.getAll(`/v1/subscriptions/${subId}/introductoryOffers?include=territory&limit=200`);
  const covered = new Set();
  for (const o of rows) {
    const a = o.attributes;
    if (a.offerMode === "FREE_TRIAL" && a.duration === duration && !a.endDate) covered.add(o.relationships?.territory?.data?.id);
  }
  return { rows, covered };
};

for (const sub of SUBS) {
  const { rows, covered } = await coveredTerritories(sub.id);
  console.log(`${sub.name}: ${rows.length} intro offer row(s), ${covered.size} territories already FREE_TRIAL ${duration}`);
  const todo = territories.filter((t) => !covered.has(t));
  if (!todo.length) { console.log("  nothing to do"); continue; }
  if (dry) { console.log(`  would create FREE_TRIAL ${duration} in ${todo.length} territories`); continue; }
  let n = 0, failed = [];
  for (const territory of todo) {
    const body = {
      data: {
        type: "subscriptionIntroductoryOffers",
        attributes: { duration, offerMode: "FREE_TRIAL", numberOfPeriods: 1 },
        relationships: {
          subscription: { data: { type: "subscriptions", id: sub.id } },
          territory: { data: { type: "territories", id: territory } },
        },
      },
    };
    try { await asc.call("POST", "/v1/subscriptionIntroductoryOffers", body); n++; }
    catch (e) { failed.push(`${territory}: ${String(e.message).slice(0, 120)}`); }
    if (n % 25 === 0 && n) console.log(`  ${n}/${todo.length}`);
  }
  console.log(`  created ${n}; failed ${failed.length}${failed.length ? "\n  " + failed.slice(0, 5).join("\n  ") : ""}`);
}

for (const sub of SUBS) {
  const { covered } = await coveredTerritories(sub.id);
  console.log(`verify ${sub.name}: FREE_TRIAL ${duration} in ${covered.size}/${territories.length} territories`);
}
