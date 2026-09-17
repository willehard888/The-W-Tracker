// App Store listing — the store page as text, in the repo. Prints the diff
// against App Store Connect by default; `--apply` writes it. Only ever touches
// the editable (unsubmitted) version; it never submits anything.
//
//   node scripts/asc-listing.mjs            --key <p8> --key-id <id> --issuer <uuid>
//   node scripts/asc-listing.mjs --apply    [same auth flags]
//
// Left to a person on purpose: screenshots, the App Privacy form (not in the
// API), the reviewer's demo account, pressing Submit.
import { APP_ID, authFromArgs, makeAsc } from "./asc-client.mjs";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const { call, get } = makeAsc(authFromArgs(args));

const SITE = "https://www.whealthfactory.com"; // the apex answers 308 to www
// The support page must be a real page, not the app shell answering 200.
// public/support.html + the /support rewrite in vercel.json ship with the
// release, so verify this URL returns the support page before --apply — the
// old thewtracker.store page it replaces is being retired.
const SUPPORT_URL = `${SITE}/support`;

const EN_DESCRIPTION = `Whealth Factory turns discipline into something you can see.

One check-in a day locks in your sleep, training, food and habits. Every day you show up builds your streak, your XP and your rank. Every day you skip shows too.

YOUR DAY, LOCKED IN
• A daily check-in that takes under a minute
• Streaks, XP, levels and status tiers you earn, never buy
• Seasons and leaderboards with your friends and the whole community

A COACH THAT KNOWS YOUR WEEK
• An AI coach that reads your check-ins, training logs and Apple Health sleep before it answers
• A morning brief and a plan for the day
• A weekly review of what moved and what to change

TRAINING THAT BENDS TO THE DAY
• Pick the muscles, the minutes and how hard: today's session builds itself
• Or have your whole week built from your profile, equipment and injuries
• Build your own program from 260+ illustrated exercises
• Swap any movement, turn any day into rest, log every set. Loads follow what you lift

NUTRITION WITHOUT THE SPREADSHEET
• A food diary with search, barcode scanning and photo logging
• Targets for calories, protein, carbs and fat
• Nordic and international food data

THE VAULT
• 80+ short lessons on training, recovery, nutrition, sleep, the nervous system, mindset and longevity, each with an evidence rating, references and a practice to run the same day
• The ideas of 21 thinkers, from the Stoics to modern performance science

SQUAD
• Tribes, a proof feed, direct messages and 1v1 battles with friends
• Report and block on every surface. No tolerance for abuse

APPLE HEALTH
• Optional. Reads sleep, steps and active energy to verify your day and inform your coach. You choose what to share

MEMBERSHIP
Full access is free for 14 days, with no payment details. After that, Whealth Factory Premium is an auto-renewing subscription: Premium Monthly (1 month) or Premium Yearly (1 year). Prices are shown in the app before you buy and vary by region. Payment is charged to your Apple Account at confirmation of purchase. The subscription renews automatically unless it is cancelled at least 24 hours before the end of the current period. Manage or cancel it any time in your Apple Account settings.

Whealth Factory is not a medical device and does not give medical advice.

Terms of Use: ${SITE}/terms
Privacy Policy: ${SITE}/privacy`;

const FI_DESCRIPTION = `Whealth Factory tekee kurista näkyvää.

Yksi check-in päivässä lukitsee unesi, treenisi, ruokasi ja tapasi. Jokainen päivä, jona olet paikalla, kasvattaa putkeasi, XP:täsi ja sijoitustasi. Myös väliin jäänyt päivä näkyy.

PÄIVÄ LUKKOON
• Päivittäinen check-in alle minuutissa
• Putket, XP, tasot ja statustasot, jotka ansaitaan eikä osteta
• Kaudet ja tulostaulut kavereiden ja koko yhteisön kanssa

KOUTSI, JOKA TUNTEE VIIKKOSI
• Tekoälykoutsi, joka lukee check-inisi, treenikirjauksesi ja Apple Healthin unen ennen kuin vastaa
• Aamun tilannekatsaus ja päivän suunnitelma
• Viikkokatsaus: mikä liikkui ja mitä kannattaa muuttaa

TREENI, JOKA JOUSTAA PÄIVÄN MUKAAN
• Valitse lihakset, minuutit ja rasitus: päivän treeni rakentuu itse
• Tai anna rakentaa koko viikko profiilisi, välineidesi ja vammojesi pohjalta
• Rakenna oma ohjelma yli 260 kuvitetusta liikkeestä
• Vaihda liike, muuta päivä levoksi, kirjaa jokainen sarja. Kuormat seuraavat sitä, mitä nostat

RAVINTO ILMAN TAULUKKOLASKENTAA
• Ruokapäiväkirja haulla, viivakoodilla ja kuvasta kirjaamalla
• Tavoitteet kaloreille, proteiinille, hiilihydraateille ja rasvalle
• Pohjoismainen ja kansainvälinen elintarviketieto

VAULT
• Yli 80 lyhyttä oppia treenistä, palautumisesta, ravinnosta, unesta, hermostosta, mielestä ja pitkäikäisyydestä. Jokaisessa on näytön aste, lähteet ja harjoitus samalle päivälle
• 21 ajattelijan ideat stoalaisista moderniin suorituskykytieteeseen

SQUAD
• Heimot, proof-feed, yksityisviestit ja 1v1-battlet kavereiden kanssa
• Ilmoita ja estä jokaisessa näkymässä. Häirintää ei suvaita

APPLE HEALTH
• Vapaaehtoinen. Lukee unen, askeleet ja aktiivisen energian päiväsi vahvistamiseen ja koutsin tueksi. Sinä päätät, mitä jaat

JÄSENYYS
Kaikki ominaisuudet ovat käytössä ilmaiseksi 14 päivää ilman maksutietoja. Sen jälkeen Whealth Factory Premium on automaattisesti uusiutuva tilaus: Premium Monthly (1 kuukausi) tai Premium Yearly (1 vuosi). Hinnat näkyvät sovelluksessa ennen ostoa ja vaihtelevat alueittain. Maksu veloitetaan Apple-tililtäsi oston vahvistuksen yhteydessä. Tilaus uusiutuu automaattisesti, ellei sitä peruta vähintään 24 tuntia ennen kuluvan jakson päättymistä. Voit hallita tilausta ja perua sen milloin tahansa Apple-tilisi asetuksissa.

Sovellus on englanninkielinen. Whealth Factory ei ole lääkinnällinen laite eikä anna lääketieteellisiä neuvoja.

Käyttöehdot: ${SITE}/terms
Tietosuojaseloste: ${SITE}/privacy`;

const REVIEW_NOTES = `Whealth Factory is a discipline and training app: a daily check-in (habits, sleep, training), an AI coach, training programs with 260+ illustrated exercises, a food diary, a library of short lessons (the Vault) and a social layer (feed, tribes, direct messages, 1v1 battles).

ACCESS AND SUBSCRIPTION
- Every new account gets full access for 14 days with no payment details (an in-app trial, not a store trial). The paywall is reached from the trial pill in the header on Home, and automatically when the trial ends.
- Subscriptions are auto-renewing, in the group "Whealth Factory": WhealthFactory499 (monthly) and WhealthFactoryYearly (yearly). Restore Purchases, Terms of Use and Privacy Policy are on the paywall. There is no other way to pay.
- "Have a free pilot code?" on the paywall redeems complimentary access issued by our team to early testers. Codes are never sold.

SIGN IN
- Sign in with Apple (native) or email and password. The demo account is provided above.

APPLE HEALTH
- Optional. The app reads sleep, steps, active energy and workouts to verify the day's check-in and inform the coach. The two writes (a workout, mindful minutes) are separate opt-ins. Health data is never used for advertising.

AI FEATURES AND CONSENT
- The coach, the daily brief and plan, the weekly review and meal-photo logging send the member's data to AI models from OpenAI and Google through our gateway OpenRouter. The app asks for explicit consent first ("Your coach runs on AI", shown the first time Coach is opened or a meal photo is scanned), names the providers and the data, and the choice can be withdrawn in Profile. Without consent the rest of the app works in full.
- Photos and posts are screened by automated moderation before they are published. This is disclosed in the consent sheet, the Terms and the Privacy Policy.

USER-GENERATED CONTENT
- Report and block: the "..." menu on every feed post, tribe post, comment, direct message thread and profile; blocked members are hidden in both directions. Reports reach our moderation queue and are reviewed within 24 hours; the Terms state zero tolerance for objectionable content.

ACCOUNT DELETION
- Profile > "..." > Delete account (type the username to confirm). It deletes the account and its data in the app, with no support contact needed.

The app is iPhone only and portrait. It is not a medical device and gives no medical advice; health content carries disclaimers and references.`;

const LISTING = {
  "en-US": {
    info: { name: "Whealth Factory", subtitle: "Discipline, training, AI coach", privacyPolicyUrl: `${SITE}/privacy` },
    version: {
      description: EN_DESCRIPTION,
      keywords: "habit tracker,workout,gym,nutrition,calories,macros,streak,stoic,sleep,fitness,self improvement",
      promotionalText: "Lock in your day, train with a coach that adapts to you, eat to your target and climb the ranks. Discipline you can see. Free for 14 days, no card.",
      supportUrl: SUPPORT_URL,
      marketingUrl: SITE,
    },
  },
  fi: {
    info: { name: "Whealth Factory", subtitle: "Treeni, ravinto, tekoälykoutsi", privacyPolicyUrl: `${SITE}/privacy` },
    version: {
      description: FI_DESCRIPTION,
      keywords: "tavat,treeniohjelma,sali,ravinto,kalorit,makrot,putki,uni,kuntoilu,itsensä kehittäminen,stoalaisuus",
      promotionalText: "Lukitse päiväsi, treenaa sinuun mukautuvan koutsin kanssa, syö tavoitteesi mukaan ja nouse rankingissa. Kuri, jonka näkee. 14 päivää ilmaiseksi, ei korttia.",
      supportUrl: SUPPORT_URL,
      marketingUrl: SITE,
    },
  },
};

const CATEGORIES = { primaryCategory: "HEALTH_AND_FITNESS", secondaryCategory: "LIFESTYLE" };

// The founder is the declarant. There are no ads; battles are not prize
// contests; health topics are discussed, medical treatment is not the subject.
const AGE = { advertising: false, contests: "NONE", medicalOrTreatmentInformation: "INFREQUENT_OR_MILD", healthOrWellnessTopics: true, messagingAndChat: true, userGeneratedContent: true };

const LIMITS = { name: 30, subtitle: 30, keywords: 100, promotionalText: 170, description: 4000, notes: 4000 };
for (const [locale, l] of Object.entries(LISTING)) {
  for (const [k, v] of Object.entries({ ...l.info, ...l.version })) {
    if (LIMITS[k] && v.length > LIMITS[k]) { console.error(`${locale}.${k} is ${v.length} chars, limit ${LIMITS[k]}`); process.exit(1); }
  }
}
if (REVIEW_NOTES.length > LIMITS.notes) { console.error(`review notes ${REVIEW_NOTES.length} > ${LIMITS.notes}`); process.exit(1); }

const short = (s) => (s == null ? "∅" : String(s).length > 70 ? `${String(s).slice(0, 67).replace(/\n/g, " ")}… (${String(s).length})` : String(s).replace(/\n/g, " "));
let changes = 0;
const diff = async (label, current, wanted, write) => {
  const delta = Object.fromEntries(Object.entries(wanted).filter(([k, v]) => (current[k] ?? null) !== v));
  if (Object.keys(delta).length === 0) { console.log(`= ${label}`); return; }
  for (const [k, v] of Object.entries(delta)) console.log(`${APPLY ? "✎" : "~"} ${label}.${k}: ${short(current[k])}  →  ${short(v)}`);
  changes += Object.keys(delta).length;
  if (APPLY) await write(delta);
};

const version = (await get(`/v1/apps/${APP_ID}/appStoreVersions?filter[appStoreState]=PREPARE_FOR_SUBMISSION,DEVELOPER_REJECTED,REJECTED,METADATA_REJECTED&limit=1`)).data[0];
if (!version) { console.error("No editable App Store version."); process.exit(1); }
console.log(`Version ${version.attributes.versionString} (${version.attributes.appStoreState})\n`);

const appInfo = (await get(`/v1/apps/${APP_ID}/appInfos?limit=1&include=primaryCategory,secondaryCategory`)).data[0];
const infoLocs = (await get(`/v1/appInfos/${appInfo.id}/appInfoLocalizations?limit=50`)).data;
const verLocs = (await get(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`)).data;

for (const [locale, l] of Object.entries(LISTING)) {
  const il = infoLocs.find((x) => x.attributes.locale === locale);
  const vl = verLocs.find((x) => x.attributes.locale === locale);
  if (!il || !vl) { console.log(`! ${locale}: localization missing in App Store Connect, skipped`); continue; }
  await diff(`${locale}.info`, il.attributes, l.info, (attributes) => call("PATCH", `/v1/appInfoLocalizations/${il.id}`, { data: { type: "appInfoLocalizations", id: il.id, attributes } }));
  await diff(`${locale}.version`, vl.attributes, l.version, (attributes) => call("PATCH", `/v1/appStoreVersionLocalizations/${vl.id}`, { data: { type: "appStoreVersionLocalizations", id: vl.id, attributes } }));
}

const currentCats = { primaryCategory: appInfo.relationships?.primaryCategory?.data?.id ?? null, secondaryCategory: appInfo.relationships?.secondaryCategory?.data?.id ?? null };
await diff("categories", currentCats, CATEGORIES, () => call("PATCH", `/v1/appInfos/${appInfo.id}`, {
  data: { type: "appInfos", id: appInfo.id, relationships: Object.fromEntries(Object.entries(CATEGORIES).map(([k, id]) => [k, { data: { type: "appCategories", id } }])) },
}));

const age = (await get(`/v1/appInfos/${appInfo.id}/ageRatingDeclaration`)).data;
await diff("ageRating", age.attributes, AGE, (attributes) => call("PATCH", `/v1/ageRatingDeclarations/${age.id}`, { data: { type: "ageRatingDeclarations", id: age.id, attributes } }));

const review = (await get(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;
await diff("review", review.attributes, { notes: REVIEW_NOTES }, (attributes) => call("PATCH", `/v1/appStoreReviewDetails/${review.id}`, { data: { type: "appStoreReviewDetails", id: review.id, attributes } }));

// --build <number> attaches that processed build to the version (the last step before Submit).
const buildFlag = args.indexOf("--build");
if (buildFlag >= 0) {
  const want = args[buildFlag + 1];
  const attached = await get(`/v1/appStoreVersions/${version.id}/build`).catch(() => null);
  const build = (await get(`/v1/builds?filter[app]=${APP_ID}&filter[version]=${want}&limit=1`)).data[0];
  if (!build) { console.error(`Build ${want} not found.`); process.exit(1); }
  await diff("build", { version: attached?.data?.attributes?.version ?? null }, { version: want }, () => call("PATCH", `/v1/appStoreVersions/${version.id}/relationships/build`, { data: { type: "builds", id: build.id } }));
}

console.log(`\n${changes} field(s) ${APPLY ? "written" : "differ"}.${APPLY ? "" : " Re-run with --apply to write them."}`);
if (APPLY) {
  const after = (await get(`/v1/apps/${APP_ID}/appInfos?limit=1`)).data[0];
  console.log(`Age rating now: ${after.attributes.appStoreAgeRating ?? "—"}`);
}
