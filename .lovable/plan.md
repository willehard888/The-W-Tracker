

# Suunnitelma: Top Inviters -widget + Elite-kerroin 2× → 1.25×

Kaksi muutosta, ei simulaatiota. Molemmat konservatiivisia — ei DB-migraatioita, ei taaksepäin kertyneen XP:n purkamista.

---

## 1. Top Inviters this month -widget

**Data:** RPC `get_top_inviters(p_limit)` on jo olemassa ja palauttaa `user_id, username, avatar_url, status_tier, converted_count, signup_count` tämän kalenterikuukauden ajalta. Hook `useTopInviters` on jo olemassa (`src/hooks/use-referral-stats.ts`).

**Uusi komponentti `src/components/TopInvitersWidget.tsx`:**
- Otsikko: "🏆 Top Inviters This Month" + pieni "Resets 1st of next month" -teksti.
- Top 10 -lista: rank #, `StatusAvatar`, `@username`, rivi "**N paid** · M signups" (converted korostettu kullalla, signups harmaa).
- Oman rivin highlight: kultainen ring + "(you)"-tag jos `profile.user_id` löytyy listalta.
- Jos käyttäjä ei ole top 10:ssä mutta hänellä on signupeja → alapuolelle pieni "You: X signups, Y paid — keep pushing" -rivi (haetaan `useReferralStats`:lla).
- Tyhjätila: "Be the first inviter this month 🚀" + CTA → /referrals.
- Loading: skeleton.
- react-query staleTime 60s (perittynä hookista).

**Sijoitus:**
- `src/pages/Referrals.tsx` — lisätään olemassa olevien rewardsien jälkeen, ennen Recent Invites -listaa.
- `src/pages/Leaderboard.tsx` — oma sektio alareunaan "Top Inviters".

## 2. Elite-kerroin 2× → 1.25×

**Uusi vakio `src/lib/xp-constants.ts`:**
```ts
export const ELITE_XP_MULTIPLIER = 1.25;
```
Yksi totuuden lähde tuleville käyttökohteille.

**`src/pages/DailyCheckin.tsx`:**
- Korvataan `isElite ? baseXp * 2 : baseXp` → `Math.round(isElite ? baseXp * ELITE_XP_MULTIPLIER : baseXp)`.
- Summary-kortissa päivitetään teksti "+100% Elite" / "2×" → "+25% Elite boost" (tekstit haetaan koodista ja päivitetään yhdenmukaisesti).

**Muut tekstit/kopiot (haku + päivitys):**
- Paywall, Onboarding, Elite-markkinointi, Landing — jos löytyy "DOUBLE XP", "2×", "+100%", "x2" → päivitetään "+25% Elite XP boost" / "1.25×".
- Hinta (€4.99/mo) ja kaikki muu Elite-etu säilyy ennallaan.

**Mitä EI tehdä:**
- Ei muutoksia `calculate_rank_score`:een (painotukset 25/20/55 pysyvät).
- Ei tier-kynnysten muutoksia.
- Ei streak/badge/level-muutoksia.
- Ei taaksepäin kertyneen XP:n korjausta — vain tulevat check-inssit käyttävät uutta kerrointa.
- Ei DB-migraatioita.

**Vaikutus:** 7–14 päivän kuluessa Elite-käyttäjien `avg_xp_7d` tasoittuu, leaderboard muuttuu reilummaksi ilman että kukaan menettää jo ansaittua XP:tä.

---

## Tekniset yksityiskohdat

**Uudet tiedostot:**
- `src/components/TopInvitersWidget.tsx`
- `src/lib/xp-constants.ts`

**Muokattavat:**
- `src/pages/DailyCheckin.tsx` — kerroinmuutos + summary-tekstit
- `src/pages/Referrals.tsx` — widget-upotus
- `src/pages/Leaderboard.tsx` — widget-sektio
- Mahdolliset muut tiedostot joissa "2×"/"DOUBLE XP" -kopio (Paywall.tsx, Onboarding.tsx, Landing.tsx, mahdollisesti RevenueCatContext.tsx) — vain tekstit

**Muistipäivitykset:**
- `mem://monetization/elite-subscription` — Elite XP-kerroin on 1.25× (aiemmin 2×).

