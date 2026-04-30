# Premium-tilaus + Vault-akatemia + sujuvampi IAP-flow

## Mitä rakennetaan

1. **Apex-osto poistuu kokonaan** — Apex säilyy ansaittuna tier-statuksena (top 10%), mutta sitä ei enää voi ostaa. Kaikki Apex-paywall-kortit, dialogit ja CTA:t poistetaan tai uudelleenohjataan Premiumiin.
2. **Premium-tilaus €17.99/kk (+ vuosi €172,99)** — sama hinta kuin nykyinen Apex. Käytännössä Apex-tuoteperhe nimetään uudelleen Premiumiksi niin, että tilaajan oikeudet ovat: kaikki Member-edut + AI Coach + Elite Feed + uusi **Vault**-akatemia + Tribes-luonti (3 kpl).
3. **Vault — Premium-akatemia (rakenne, sisältö myöhemmin)** — uusi `/vault`-reitti, paywall-gate, 5 kategoriaa "Coming Soon" -tilalla:
   - Recipes & Clean Meals
   - Training Programs & Movements
   - Recovery & Sleep
   - Mind & Mood (EFT, EMDR-tyyliset, kehoharjoitteet)
   - Nervous System Reset (Hypnotherapy — kuukausittain uusi ohjattu sessio)
4. **Yhden näytön IAP-flow** — paywall ei naviguoi pois oston aikana. Yksi `purchaseStatus`-state ohjaa kaiken: `idle → purchasing → verifying → success` (animoitu) tai `error` (inline-banner + Try Again / Restore). Kaksoiskutsut estetään, RevenueCatin not-ready-tilassa Buy-nappi disabloidaan eikä toastia näytetä.

## Käyttäjäkokemus

```text
Paywall (yksi näyttö)
┌─────────────────────────────┐
│   PREMIUM HERO              │
│   €17.99 / kk · €172.99 / v │
│   ✓ AI Coach                │
│   ✓ Elite Feed              │
│   ✓ Vault — kurssit & audio │
│   ✓ Tribes (3)              │
│                             │
│   [ Unlock Premium ]        │
│                             │
│   ── verifying ──           │  (sama näyttö, ei navigointia)
│   ── success → /vault       │  (auto-route 1.2s jälkeen)
│   ── error: banner + retry  │  (sama näyttö pysyy)
│                             │
│   Restore · Manage          │
└─────────────────────────────┘
```

Onnistuneen oston jälkeen ensikäynti ohjautuu `/vault`-näkymään (sisältö = arvolupauksen visuaalinen vahvistus) eikä Home-näkymään.

## Tekniset muutokset

### Tietokanta
- Migraatio: lisää `profiles.is_premium boolean default false` (ei riko olemassa olevia `is_elite`/`is_apex_subscriber`-kenttiä; `is_premium = true` aina kun käyttäjä on tilaaja).
- RLS-helper `public.has_premium(uuid)` SECURITY DEFINER — käytetään myöhemmin Vault-sisältötaulujen suojaamiseen.
- Migraatiossa: `UPDATE profiles SET is_premium = true WHERE is_apex_subscriber = true OR is_elite = true;` (säilyttää nykyisten tilaajien pääsyn).

### RevenueCat
- `src/contexts/RevenueCatContext.tsx`: lisätään uusi `PREMIUM_ENTITLEMENT = "premium"` ja primary product `premiummonthly1799` / `premiumyearly17299`. Vanhat Apex-tuotteet pidetään listassa fallbackeina (olemassa olevat tilaukset eivät katoa), mutta `purchaseApex*`-funktiot **deprekoidaan** ja Paywall ei enää kutsu niitä.
- `applyEntitlements`: jos joko Premium- TAI Apex-entitlement on aktiivinen → asetetaan `is_premium = true` ja `is_elite = true`. Apex-flag asetetaan vain jos vanha entitlement on yhä aktiivinen (legacy-tilaajille).
- App Store Connect -tuote `premiummonthly1799` täytyy luoda RevenueCat-konsolissa (käyttäjälle ohje lopussa). Kunnes se on luotu, koodi failoittaa hallitusti vanhalle Apex-tuotteelle (oikeudet pysyvät samoina, hinta sama).

### check-subscription edge function
- Lisätään uusi Stripe-price set `PRICE_IDS.premium` (sama hinta kuin Apex-priceit; käyttäjä luo uuden Stripe-tuotteen myöhemmin tai käytetään olemassa olevia Apex-priceitä premiumina).
- Tilauksen havaitsemisen jälkeen päivitetään `is_premium = hasActiveSub` riippumatta tier-tunnistuksesta.

### revenuecat-webhook
- `PREMIUM_PRODUCT_IDS = ["premiummonthly1799", "com.app.premiummonthly1799", "premiumyearly17299", ...]`.
- Grant-eventeissä asetetaan `is_premium = true, is_elite = true`. Apex-flag asetetaan vain legacy-Apex-tuotteilla.

### Paywall.tsx (täysremontti)
- Poistetaan `IosApexSecondary`, "Or"-divider, "Earned Apex"-disclaimer, kaksoiskortit.
- Yksi `PremiumHero`-komponentti (uusi `src/components/paywall/PremiumHero.tsx` joka korvaa `IosEntryHero`+`IosApexSecondary`-parin) sekä webissä että natiivissa.
- State-kone:
  ```ts
  type PurchaseStatus = "idle" | "purchasing" | "verifying" | "success" | { error: string };
  ```
- `verifying`-tilassa polletaan `checkSubscription()` 1s välein max 8s; `is_premium=true` → `success`. Timeout → `error: "Couldn't verify purchase"`.
- Inline `<ErrorBanner>` Paywall-näytön yläosassa; ei toasteja paitsi Restore-success.
- Ostonappi disabloituu kun `!rcReady` natiivissa (ei pelkkä toast).
- Onnistumisen jälkeen `navigate("/vault", { replace: true })` 1.2s viiveellä (success-animaatio ehtii näkyä).

### Vault-osio (uusi)
- `src/pages/Vault.tsx` — paywall-gated landing. Jos `!isPremium` → näyttää lukitun preview-kortin + CTA `/paywall`.
- 5 kategoriakorttia, jokainen "Coming Soon" -lipulla mutta visuaalisesti viimeisteltynä (gold-gradient, ikoni, lyhyt kuvaus). Kategoriat ovat staattinen JS-array — ei vielä omaa taulua.
- `src/components/vault/VaultCategoryCard.tsx` + `src/components/vault/VaultLockedPreview.tsx`.
- Reititys: `<Route path="/vault" element={<Vault />} />` `App.tsx`:ssä lazy-loadattuna `route-preload.ts`-listan kanssa.
- BottomNav: korvataan `Tribes`-tabin sijasta **EI** (Tribes on tärkeä) — sen sijaan Vault korvaa tilan vain Premium-käyttäjille; muille pidetään nykyinen layout. Toteutus: `BottomNav.tsx` saa `isPremium`-flagin ja vaihtaa "Battles"-tabin tilalle "Vault"-tabin Premium-käyttäjälle (Battles säilyy reittinä, ohjautuu vain Profile-ylävalikon kautta). Päätös: pidetään BottomNav koskemattomana ja Vault saavutetaan **Home**-näkymästä uudella featured-kortilla + Profile-linkillä — ei ylimääräistä nav-kohinaa.
- Home-näkymään (`src/components/home/CommandDeck.tsx` tai `Index.tsx`) lisätään `<VaultPromoCard />` joka ei-Premiumille on locked-CTA, Premiumille on shortcut.

### Tekstit ja apuosiot
- `src/lib/status-tiers.ts` — Apex-tier-`unlocks` ei enää mainitse "Apex visual effects" osto-kontekstissa; rivi "Tribes — create communities" pysyy (ansaittu Apex saa ne).
- `src/components/paywall/IosApexSecondary.tsx` poistetaan tiedostoreferensseistä (ei käytössä).
- `src/pages/TribeNew.tsx` ja `src/pages/Tribes.tsx`: "Earn it via top 10% rank, or unlock instantly with Apex." → "Earn Apex tier (top 10%) or unlock with Premium."
- `src/components/PaywallTierCard.tsx` `variant="apex"` jätetään koodiin mutta sen instanssit poistetaan; voidaan poistaa myöhemmin.

## Mitä EI muuteta nyt
- Vault-sisältötauluja (recipes, programs, audios) ei luoda. Sisältö lisätään seuraavissa iteraatioissa kun rakenne on hyväksytty.
- Stripe-side: emme luo uutta `premium`-priceä Stripeen tässä loopissa — käytetään olemassa olevia Apex-priceitä premium-tilauksina (sama hinta). Käyttäjä voi halutessaan tehdä uuden tuotteen Stripeen myöhemmin.
- Olemassa olevat Apex-tilaajat säilyvät muuttumattomina (entitlement aktiivinen, `is_apex_subscriber=true`, tier pinnattu apexiin).

## Käyttäjälle tehtävää oston jälkeen
- App Store Connect: luo uusi auto-renewing subscription `premiummonthly1799` (€17.99) ja `premiumyearly17299` (€172.99), liitä RevenueCat-entitlementiin `premium`. Kunnes nämä ovat `Approved`, paywall toimii vanhojen Apex-tuotteiden kautta saman hintaisena.
- `npx cap sync` natiivimuutosten jälkeen.
