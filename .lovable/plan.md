

# Apex paywall + helpompi Elite

## Tavoitteet
1. **Apex & Legend lukkojen taakse** TierLadderissa — kun käyttäjä napauttaa Apex- tai Legend-riviä, näytetään **paywall-promo dialogissa** Earned-polun (vaatimukset) lisäksi. Apex saadaan **välittömästi** ostamalla €17,99/kk, Legend on aina ansaittu (Founders Circle).
2. **Helpompi Elite ilman tiukkaa prosenttia** — alennetaan SQL-vaatimuksia niin, että aktiiviset käyttäjät pääsevät Eliteen vaikka kilpailussa ei vielä ole 95-percentile dataa.

## 1. SQL — Elite-helpotus
Päivitetään `update_status_tier` (uusi migraatio):

| Tier | Vanha | Uusi |
|------|-------|------|
| Elite | percentile ≥ 95 **AND** activity_days ≥ 14 **AND** streak ≥ 30 | percentile ≥ 80 **OR** (activity_days ≥ 20 **AND** streak ≥ 21) |
| High Performer | ≥ 90 / 14 / 14 | ≥ 70 **OR** (15 days **AND** 14 streak) |
| Performer | ≥ 75 / 7 / — | ≥ 50 / 7 |
| Operator | ≥ 50 / 7 | ≥ 25 / 5 |
| Apex | ≥ 99 / 30 / 30 | **säilyy ennallaan** (top 1% = harvinainen) |
| Legend | ≥ 99.9 / 30 / 30 | **säilyy ennallaan** |

→ Elite muuttuu **saavutuksesta consistencystä** (3 viikon streak + 20 aktiivipäivää 30 päivän aikana riittää) eikä enää vaadi pakollista 95% percentile -leaderboard sijoitusta. Apex- ja Legend-eksklusiivisuus säilyy.

Migraatio ajaa myös `update_all_status_tiers()` lopuksi, jotta nykyiset käyttäjät päivittyvät heti.

## 2. TierLadder — Apex/Legend lukkoineen
`src/components/TierLadder.tsx`:
- Kun käyttäjä napauttaa Apex-riviä **JA** ei ole vielä Apex-tier/`is_apex_subscriber`:
  - Dialog näyttää **kaksi polkua rinnakkain**:
    - **"Earn it"** — nykyiset vaatimukset (Top 1%, 30 active days, 30 streak)
    - **"Skip the grind"** — €17,99/kk, "Become Apex Now" -CTA → vie `/paywall`
  - Lukon kuvake riveillä korvataan **Crown + 🔒 Premium** -merkillä Apexille
- Legend-rivi näyttää aina vain **"Earned only — Founders Circle"** (ei paywall-CTA:ta, koska Legend on aina ansaittu).
- Lukko-ikoni Apex-rivillä saa kultakehyksen ja "PREMIUM" -tagin steps-away `+N`-merkin tilalle, kun käyttäjä on alle Apexin.

Komponentti tarvitsee uuden propin: `isApexSubscriber: boolean`. Index/Profile välittävät sen `useAuth().isApexSubscriber` -arvosta.

## 3. Paywall-mikrokomponentti dialogiin
Uusi `src/components/TierUnlockPaywallCard.tsx` — pieni, dialogiin sopiva versio Apex-CTA:sta (käyttää samaa kultta-flame -gradienttia kuin `PaywallTierCard`). Sisältää:
- "Apex Instant" -otsikko + €17,99/mo
- 3 keskeistä etua (Tribes, Apex aura, tier-suoja)
- "Become Apex Now" → `navigate("/paywall")` (CTA pysyy yhdessä paikassa, jossa RevenueCat/Stripe on jo)

## 4. Microcopy
- TierLadder Apex-rivi (locked, ei tilaaja): "Earn top 1% — or unlock instantly"
- TierLadder Legend-rivi (locked): "Earned only · Founders Circle"
- Profilen Elite-vaatimukset päivitetään uuteen tekstiin: "Top 20% rank **OR** 20 active days + 21-day streak"

## Tekniset muutokset
- **Uusi migraatio:** `supabase/migrations/<ts>_easier_elite.sql` — `update_status_tier` uudet kynnykset + `update_all_status_tiers()`
- **Uusi:** `src/components/TierUnlockPaywallCard.tsx`
- **Muokattu:** `src/components/TierLadder.tsx` — `isApexSubscriber` prop, lukkokuvakkeet Apex/Legend riveille, paywall-osio dialogiin
- **Muokattu:** `src/lib/status-tiers.ts` — `requirements`-kentät synkkaan SQL:n kanssa (Elite 80 / 20 / 21, HP 70 / 15 / 14, Performer 50 / 7 / 0, Operator 25 / 5 / 0)
- **Muokattu:** `src/pages/Index.tsx`, `src/pages/Profile.tsx` — välittävät `isApexSubscriber` TierLadderille

## Mitä EI muuteta
- Apex/Legend SQL-kynnykset (top 1% / 0.1%) — säilyvät harvinaisuus
- Paywall-sivu (`/paywall`) — toimii jo, Apex-CTA viedään sinne
- RevenueCat/Stripe-integraatio — ei muutoksia

