

# Suunnitelma: Tee statuksesta oikeasti koukuttava

Statussysteemi on jo olemassa (7 tieriä, RankPressureCard, TierPromotionCelebration, RoadToElite). Mutta se ei vielä **koukuta** — käyttäjä ei tiedä *milloin* hän putoaa, *kuka* on hengittämässä niskaan, eikä saa **mikrovoittoja** päivittäin. Korjataan nämä viidellä uudella mekanismilla + bugi.

---

## 0. Bugikorjaus (pakollinen)
`src/pages/Index.tsx` rivit 104–107 sisältävät irrallista JSX:ää funktion rungossa ennen `if (!profile) return null` -lausetta. Tämä rikkoo buildin. Poistetaan duplikaatti — `<RoadToElite compact />` renderöidään uudessa paikassa returnin sisällä alla kuvatun layoutin osana.

---

## 1. Tier Demotion Risk — "you're about to lose your status"
**Mikä koukuttaa:** menettämisen pelko on vahvempi kuin saavuttamisen halu.

Uusi hook `src/hooks/use-tier-risk.ts`:
- Laskee `daysUntilDemotion` perustuen `streak`-deadlineen ja viimeiseen check-iniin.
- Vertaa nykyistä `rank_score`a tier-kynnykseen → palauttaa `pointsAboveCutoff`.
- Tila: `safe` / `pressure` (alle 20% marginaali) / `danger` (< 24h streak deadline TAI alle 5 pistettä cutoffista).

Uusi komponentti `src/components/TierRiskBanner.tsx`:
- Näytetään `Index`-sivun yläosassa kun status `pressure` tai `danger`.
- `danger`-tilassa: pulssaava punainen reuna, countdown-timer, "Lose **Performer** in 4h 32m" + CTA "Save your status".
- `pressure`-tilassa: kullanvärinen, "Only **3.2 pts** above demotion line".

## 2. Live Rivals — "kuka on perässäsi ja edessäsi"
**Mikä koukuttaa:** konkreettiset ihmiset, ei abstrakti %-luku.

Uusi komponentti `src/components/LiveRivals.tsx` (Index + Profile):
- Hakee `profiles`-taulusta 1 käyttäjä rank-asteikolla yläpuolella + 1 alapuolella.
- Näyttää: `StatusAvatar` + username + delta ("3.4 pts ahead" / "1.2 pts behind").
- Alapuolella oleva korostetaan punaisella varjostuksella + "🔥 catching up" jos delta < 5.
- Tap → `/u/:username` (jo olemassa).
- Päivittyy joka kerta kun Index ladataan + react-query 30s staleTime.

## 3. Daily Status Pulse — mikrokoukku
**Mikä koukuttaa:** päivittäinen "miten suoriuduin tänään?" -palkinto.

Uusi komponentti `src/components/DailyStatusPulse.tsx`:
- Yksi rivi Index:n yläosassa: "**+2 ranks today** · 12 users behind you now"
- Lasketaan `rank_score_history`-pohjalta (jos olemassa) tai snapshotataan profiilissa `last_rank_snapshot` -kenttään.
- Käyttää nuolikuvaketta + väripaletteja: vihreä nousu, punainen lasku, harmaa staattinen.
- Tap → Leaderboard.

**DB:** Lisätään `profiles.last_rank_snapshot` (jsonb: `{rank, score, timestamp}`) + päivittäinen päivitys kun Index ladataan ensimmäisen kerran päivässä.

## 4. Tier Progress Vault — "näe missä olet kokonaiskartalla"
**Mikä koukuttaa:** visuaalinen progressio kaikkien 7 tierin yli.

Uusi komponentti `src/components/TierLadder.tsx` (Profile-sivulle):
- Vertikaalinen "tikapuu" Recruit → Legend, oma tier korostettuna kullalla.
- Jokainen ylempi tier näyttää **mitä se vaatii** (rank %, streak, active days) + **kuinka monta käyttäjää siellä on**.
- Lukitut tierit harmaina lukko-ikonilla, saavutetut kullalla checkmarkilla.
- Avaa modaalin jokaiselle tierille → "Unlocks: Elite Feed posting, 2× XP, Crown badge…"

## 5. Status Streak Combo — kerro mitä menetät
**Mikä koukuttaa:** kasaantuva sijoitus.

Päivitetään `RankPressureCard`:
- Lisätään pieni rivi: "🔱 **8 days at Performer** — longest at this tier"
- Jos pudottaa: TierPromotionCelebration-vastine "Lost Performer after 8 days" -tummalla animaatiolla (ei juhlaa).

## 6. Index-layout uudelleenjärjestys
Uusi prioriteettijärjestys (kriittisin ensin):
```text
1. TierRiskBanner          (vain jos pressure/danger)
2. DailyStatusPulse        (yksi rivi, päivittäinen kick)
3. RankPressureCard        (jo olemassa, päivitetty §5)
4. LiveRivals              (1 yllä + 1 alla)
5. RoadToElite compact     (jo olemassa, korjattu paikalleen)
6. CoachNudge / Briefing   (jo olemassa)
7. Level / XP card
8. Streak + Quests + CTA
9. Recent Badges
```

## 7. Profile-sivun lisäykset
- `TierLadder` ennen `BadgeVault`a.
- `LiveRivals` Road to Elite -kortin alle.

---

## Tekniset yksityiskohdat

**Uudet tiedostot:**
- `src/hooks/use-tier-risk.ts` — lasketaan demotion-riski
- `src/hooks/use-live-rivals.ts` — hakee rank-naapurit
- `src/hooks/use-daily-pulse.ts` — vertailee snapshot vs nykyinen
- `src/components/TierRiskBanner.tsx`
- `src/components/LiveRivals.tsx`
- `src/components/DailyStatusPulse.tsx`
- `src/components/TierLadder.tsx`

**Muokattavat:**
- `src/pages/Index.tsx` — bugin korjaus + uusi layout
- `src/pages/Profile.tsx` — TierLadder + LiveRivals
- `src/components/RankPressureCard.tsx` — "X days at this tier" -rivi
- `src/lib/status-tiers.ts` — lisätään `unlocks: string[]` jokaiseen tieriin (TierLadderia varten)

**DB-migraatio:**
- `profiles.last_rank_snapshot jsonb` (nullable)
- Optional: SQL-funktio `get_rank_neighbors(p_user_id uuid, p_above int default 1, p_below int default 1)` — palauttaa user_idit + score-deltat. Suorituskykyparannus, mutta voidaan tehdä myös client-side kahdella kyselyllä (`gt`/`lt` rank_scoreen + limit 1, order asc/desc).

**Muistipäivitykset:**
- `mem://features/status-hierarchy` — lisätään 5 uutta koukku-mekanismia
- Uusi `mem://features/status-addiction-loops` — dokumentoi demotion risk, live rivals, daily pulse, tier ladder

**Konservatiivinen scope:**
- Ei muutoksia status_tier-laskentalogiikkaan, RLS:ään, paywalliin tai onboardingiin.
- Ei uusia push-notifikaatioita (tehdään myöhemmässä iteraatiossa).
- Kaikki uudet komponentit puhtaita, käyttävät olemassa olevia design-tokeneita (gold, glass-card, gradient-gold, animate-reveal).
- Käyttävät jo olemassa olevia kuvioita: `StatusAvatar`, `getTierConfig`, `useAuth`, react-query.

