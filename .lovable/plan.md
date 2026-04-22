

# Apex Communities + Apex Instant -tilaus (15.99€/kk)

Päivitetty suunnitelma: lisätään Apex-tilaustaso, joka antaa **välittömän Apex-statuksen** maksua vastaan, ja vahvistetaan Apex-tieren visuaalisia efektejä koko sovelluksessa. Tribes-toiminnallisuus pysyy samana kuin edellisessä suunnitelmassa.

---

## 1. Apex Instant -tilaus (15.99€/kk)

Toinen tilaustaso Eliten (4.99€/kk) rinnalle. **Murtaa nykyisen "earned, not bought" -periaatteen** Apexin osalta — tämä on tietoinen monetisaatiopäätös.

### Mitä Apex Instant antaa
- **Välitön `status_tier = 'apex'`** — ei vaadi rank/streak/aktiivisuusvaatimuksia.
- **Apex-tier ei putoa inaktiivisuudesta** niin kauan kuin tilaus on aktiivinen (server-side suoja `update_status_tier`-funktiossa: jos `is_apex_subscriber = true`, älä laske tieriä alle apexin).
- Kaikki Elite-edut (1.25× XP-boost, AI Coach, Elite Feed -postaus, kruunu-aura).
- **Tribes-luonti-oikeus** (max 3 community / käyttäjä).
- **Apex-merkki profiilissa**: erottuva "Founding Apex" -tagi (erotetaan ansainneista Apexeistä pienellä ⚡-ikonilla, ansainneilla 🔥).
- Eksklusiiviset Apex-badget (esim. "Apex Founder").

### DB-muutokset
```text
profiles
  + is_apex_subscriber boolean default false
  + apex_subscription_started_at timestamptz

ALTER FUNCTION has_active_access — pysyy samana (Elite OR trial)
ALTER FUNCTION update_status_tier — jos is_apex_subscriber=true,
  pakota tier vähintään 'apex' (ei laske alle siitä)
```

### Stripe & RevenueCat
- **RevenueCat** (iOS/native): uusi tuote `apexmonthly1599`, entitlement `apex_subscriber`.
- **Stripe** (web): uusi `price_id` 15.99€/kk recurring. Lisätään `create-checkout`-funktioon `tier`-parametri (`elite` | `apex`).
- **`revenuecat-webhook`**: päivitetty käsittelemään `apex_subscriber`-entitlement → `is_apex_subscriber = true` + `is_elite = true` (Apex sisältää Eliten).
- **`check-subscription`**: tunnistaa Apex-product_id:n ja päivittää `is_apex_subscriber`.

### UI
- **`/paywall`** saa kaksi korttia rinnakkain:
  - "Member" (4.99€/kk) — kaikki perusedut, "earned Apex possible".
  - "Apex Instant" (15.99€/kk) — gold + flame -korostus, "Skip the grind. Become Apex now." -CTA, lista eduista. Selkeä disclaimer pienellä: "Earned Apex (top 1%) is still possible at €4.99/mo".
- **`/road-to-elite`**-sivulle pieni alaosa: "Tai hanki Apex heti — 15.99€/kk" → linkki paywalliin.
- **Profile-sivulla** Apex-tilaajalla pieni info-kortti: "Apex Subscriber active — €15.99/mo".

---

## 2. Apex UI-efektien vahvistus

Apex on nyt sekä ansaittu että ostettava huipputaso → visuaalisen erottuvuuden täytyy olla **selvästi voimakkaampi kuin Eliten**.

### `StatusAvatar` (Apex-tier)
- Nykyinen: `aura-large`, oranssi flame-glow.
- **Uusi**: 
  - Pulssaava kaksoisrengas (sisempi gold, ulompi flame-orange `hsl(18 95% 58%)`), animoitu `framer-motion` 2.5s loop.
  - Pieni `⚡` Lucide-Zap-ikoni avatarin yläkulmassa, jatkuva soft-pulse.
  - Hover/active-tilassa: säteittäinen "ember"-particle-efekti (3-4 hiukkasta, käytetään olemassa olevaa `AmbientParticles`-komponenttia kevyellä variantilla).

### `StatusHeader` (Apex-käyttäjälle)
- Headerin gradient-overlay vaihtuu intensiivisempään: `from-[hsl(18_95%_58%)]/35 via-gold/20 to-[hsl(18_95%_58%)]/15`.
- Yläreunan shimmer-viiva muuttuu `from-flame via-gold to-flame`.
- Status-pillin tilalle "APEX"-pilli flame-glowilla, animoitu `box-shadow` pulssi 1.8s (nopeampi kuin Eliten 2.4s).

### `StatusBadge`-komponentti
- Apex-variantti saa: gradient-tausta `from-[hsl(18_95%_58%)] to-gold`, valkoinen teksti, sisäinen ⚡-ikoni, hienoinen `text-shadow` flame-tinttauksella.

### Tier-aurat (`tier-aura-*` luokat `index.css`:ssä)
- `tier-aura-large` (Apex) → vahvempi `box-shadow` (2 kerrosta: lähikerros 24px gold, ulkokerros 48px flame), keyframe-animaatio `aura-flicker` (subtle 3s opacity-pulssi).

### Sivutason efektit
- **`Profile.tsx`** Apex-käyttäjälle: yläosan hero-sektioon kevyt animoitu flame-overlay (CSS gradient, ei video).
- **`Leaderboard.tsx`**: Apex-rivit saavat erottuvan rivitaustan `bg-gradient-to-r from-[hsl(18_95%_58%)]/8 via-transparent to-gold/8`, hover-tilassa flame-glow vasen reuna.
- **`EliteFeed.tsx`**: Apex-postaukset saavat ohuen 2px flame-bordin ja "APEX"-merkin postaajan nimen vieressä.

### Erottelu: Founder Apex vs Earned Apex
- Apex Instant -tilaaja: ⚡-merkki nimen vieressä + "Founding Apex" -tooltip.
- Ansainnut Apex (top 1% rank): 🔥-merkki + "Earned Apex" -tooltip.
- Molemmat saavat samat UI-efektit, vain pieni erottelumerkki kunnioittaa ansainneita.

---

## 3. Tribes (sama kuin aiemmassa suunnitelmassa)

Tribes-luonti-oikeus = `is_apex_subscriber = true` **TAI** `status_tier IN ('apex','legend')`. Server-RPC `create_tribe` tarkistaa molemmat. Muu logiikka (taulurakenne, jäsenyys, RLS, UI-reitit) pysyy identtisenä.

---

## 4. Tekninen yhteenveto

**Uudet tiedostot:**
- Migraatio: `is_apex_subscriber`, `apex_subscription_started_at`, päivitetty `update_status_tier`, Tribes-taulut + RPC:t.
- `src/components/ApexBadge.tsx` — Founding/Earned-erottelu.
- `src/components/PaywallTierCard.tsx` — refaktoroitu paywallin kortti.
- `src/pages/Tribes.tsx`, `TribeNew.tsx`, `TribeDetail.tsx`.
- `src/components/TribeCard.tsx`, `TribePostComposer.tsx`, `TribePostItem.tsx`.
- `src/hooks/use-my-tribes.ts`, `use-tribe.ts`.

**Muokattavat:**
- `src/pages/Paywall.tsx` — kaksi tier-korttia.
- `src/contexts/RevenueCatContext.tsx` — `apex_subscriber`-entitlement, `purchaseApex()`-metodi.
- `src/contexts/AuthContext.tsx` — lukee `is_apex_subscriber`-kentän.
- `supabase/functions/revenuecat-webhook/index.ts` — Apex-entitlement.
- `supabase/functions/check-subscription/index.ts` — Apex price/product tunnistus.
- `supabase/functions/create-checkout/index.ts` — `tier`-parametri.
- `src/components/StatusAvatar.tsx`, `StatusHeader.tsx`, `StatusBadge.tsx` — Apex-efektit.
- `src/index.css` — `tier-aura-large` vahvistus + `aura-flicker` keyframe.
- `src/components/BottomNav.tsx` — "Tribes"-tabi.
- `src/lib/status-tiers.ts` — Apex-config päivitys (vahvempi `glowClass`, mahdolliset apuolemassaolevat kentät).

**Salaisuudet & secretit:** Stripe-secret on jo olemassa. RevenueCat-tuote `apexmonthly1599` täytyy luoda RevenueCat-konsoliin (manuaalinen step käyttäjälle deploy-vaiheessa).

**Muistipäivitykset:**
- `mem://monetization/membership` — lisää Apex-tier 15.99€/kk.
- `mem://features/status-hierarchy` — Apex voi nyt olla joko ansaittu tai ostettu, tilaus suojaa pudotukselta.
- Uusi `mem://features/tribes` — Communities-järjestelmän kuvaus.

**Mitä EI tehdä:**
- Ei Apex Instantille omaa erillistä trialia (vain Eliten 7-pv trial pysyy).
- Ei automaattista konversiota olemassaoleville Apex-tilaajille — toimii vain uusille ostoksille.
- Ei vaikutusta `calculate_rank_score`:een — Apex-tilaaja näkyy leaderboardilla omilla pisteillään, ei keinotekoisesti nostettuna.

