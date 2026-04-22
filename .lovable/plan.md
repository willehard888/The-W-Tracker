

# Apex/Founder Badges + Legend Rebrand

Tehd��än Apex-tilan jako näkyväksi (**Founding ⚡** vs **Earned 🔥**) ja brändätään Legend-tier "Founders Circle" -kopiolla menettämättä ansaintaperustaa.

---

## 1. ApexBadge — käytetään olemassa olevaa komponenttia

`ApexBadge.tsx` on jo valmiina mutta ei käytössä missään. Logiikka:
- `isFounding={true}` → ⚡ Zap-ikoni + label "Founding" (käyttäjä on `is_apex_subscriber`)
- `isFounding={false}` → 🔥 Flame-ikoni + label "Earned" (status_tier on apex/legend mutta ei tilaaja)

Sama gold/flame-gradient molemmissa — vain ikoni ja tooltip eroavat. Korjaan tooltipin "Earned"-tilassa lukemaan **"Earned Apex — Top 1%"** ja Founding-tilassa **"Founding Apex — Day-One Member"**, jotta jako on selkeä.

## 2. Legend-rebrand "Founders Circle"

`src/lib/status-tiers.ts`:
- **Säilyy**: `requirements: { percentile: 99.9, activeDays: 30, streak: 30 }` — täysin ansaittu, top 0.1%
- **Muuttuu**:
  - `label: "Founder"` (oli "Legend")
  - `shortLabel: "FDR"` (oli "LGD")
  - `message: "You shaped this"` (oli "Few ever reach this")
  - `pressureMessage: "The Founders Circle is watching"`
  - `unlocks`: lisätään "Founders Circle aura", "Eternal recognition" — säilytetään Hall of Fame ja Tribes
- Visuaali pysyy samana (purple/gold/rose conic gradient — eli "founder" on yhä myyttinen huipputier)

`StatusBadge.tsx`, `TierLadder.tsx` ja muut komponentit lukevat labelin `getTierConfig()`:n kautta → automaattinen rebrändi koko UI:ssa.

## 3. ApexBadgen sijoittelu — vain profiilisivut

Käyttäjän vahvistuksen mukaan badge näkyy **vain Profile + PublicProfile + UserProfile** sivuilla. Ei leaderboardilla, ei tribeissä, ei feedissä — pidetään harvinaisena ja arvokkaana.

Jokaiseen sivuun lisätään ApexBadge tier-pillin viereen kun `status_tier === 'apex'`:

**Profile.tsx (rivi ~342, status pills -rivi)**
- Lisätään `isApex && <ApexBadge isFounding={isApexSubscriber} size="md" />` Elite-pillin perään

**PublicProfile.tsx**
- Lisätään `is_apex_subscriber` SELECT-kenttiin (rivi 23)
- Lisätään tier-pillin viereen `isApex && <ApexBadge isFounding={profile.is_apex_subscriber} />`

**UserProfile.tsx**
- Profile-fetchiin lisätään `is_apex_subscriber` jos puuttuu
- Tier-pill-rivin (rivi ~298) viereen `isApex && <ApexBadge isFounding={profile.is_apex_subscriber} />`

## 4. Founder-merkki Legend-tierille (sama komponentti, eri label)

Laajennetaan `ApexBadge`-komponenttia `tier`-propilla:
- `tier="apex"` (default) → "Founding" / "Earned" Apex (nykyinen logiikka)
- `tier="legend"` → "Founder" -label, Crown-ikoni, purple-gold-rose -gradient

Legend-käyttäjä saa aina **🔱 Founder** -merkin (ansaittu top 0.1%) ilman Founding/Earned-jakoa, koska Legendiin ei voi ostaa pääsyä.

## 5. Memory-päivitykset

- `mem://features/status-hierarchy` — päivitetään Legend → "Founder/Founders Circle" -nimitys, Apex-jako Founding/Earned säilyy
- Core-rivi index.md:ssä ei muutu (7-tier system pysyy)

---

## Tekniset yksityiskohdat

### Edited / created files
- `src/components/ApexBadge.tsx` — lisätään `tier?: "apex" | "legend"` -propi + Crown-render Legendille; tarkennetaan tooltip-tekstit
- `src/lib/status-tiers.ts` — Legend → Founder labels (nimi, viesti, unlocks)
- `src/pages/Profile.tsx` — import ApexBadge, render Apex/Legend-tilanteissa
- `src/pages/PublicProfile.tsx` — lisää `is_apex_subscriber` SELECTiin, render badge
- `src/pages/UserProfile.tsx` — varmistetaan että profile-fetch sisältää `is_apex_subscriber`, render badge
- `.lovable/memory/features/status-hierarchy.md` — päivitys

### Ei muuteta
- DB-skeema, RPC:t, RLS — `update_status_tier` säilyttää Apex-tilauspinnauksen
- Visuaalinen tier-järjestys (Legend pysyy korkeimpana rank=6)
- Tribes/Elite Feed/Leaderboard — badge ei lisätä näihin (käyttäjän pyyntö)
- Ansaintavaatimukset (top 0.1% / 99.9 percentile)

