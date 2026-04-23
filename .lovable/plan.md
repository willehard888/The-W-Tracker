

# Fire & amber STATUS-pinnoille — premium tasolla

Tuodaan tribe-fire-DNA (ember + amber + coal) **status-identiteetin** ytimeen niin, että jokainen status-elementti — header, nameplate, avatar, badge, check-in header, ladder — tuntuu elävältä tulelta sen sijaan, että olisi staattinen merkki. Hierarkia säilyy: ylemmät tierit polttavat kuumemmin.

## Periaate

| Tier | Lämpö | Visuaalinen identiteetti |
|---|---|---|
| Recruit/Operator/Performer | kylmä → lämmin | nykyinen rauhallinen — ei muutoksia |
| **High Performer** | amber-kipinä | uusi: pienet amber-kipinät reunoilla, lämmin alasävy |
| **Elite** | gold + amber loiste | amber-rim sykkii hennon kullan ympärillä |
| **Apex** | täysi tuli | **embers nousevat ylös**, gold-flame-conic-aura, heat-shimmer reunoissa |
| **Legend** | jalokivituli | nykyiset rainbow-elementit + amber-cinder-rain |

## Toteutus

### 1. `src/index.css` — uudet status-tulitokeyframet

Lisätään (kaikki `prefers-reduced-motion`-guardilla, GPU-vain):
- `@keyframes status-ember-rise` — pieni piste nousee 60–80px ylös, fade-in/out, drift-x ±12px
- `@keyframes status-amber-ring-breathe` — reunan opasiteetti 0.55→1→0.55 (5s)
- `@keyframes status-heat-shimmer` — diagonaalinen valokaista pyyhkii nameplaten yli (8s, vain top-tierit)
- `@keyframes status-flame-flicker` — flame-ikoni (Apex/Elite) "lepattaa" subtle-skaalalla 0.96–1.04 + opasiteetti
- `@keyframes status-coal-pulse` — alaosan amber-hehku sykkii sisäänpäin (6s)

### 2. `src/components/StatusNameplate.tsx` — täysi tulilavan päivitys top-tiereille

**Apex:**
- Lisätään 6 kpl ember-pisteitä (`<span>`) jotka käyttävät `status-ember-rise`-animaatiota — pohjasta nousevia kipinöitä, eri viiveillä (0s, 0.7s, 1.4s, 2.1s, 2.8s, 3.5s)
- Reunaviiva: nykyinen `border-[hsl(18_95%_58%)]/55` saa amber-ring-breathe-sykinnän
- Ikonit (`Flame`) saavat `status-flame-flicker` -animaation
- Alalaita: matala `radial-gradient` amber-hehku joka sykkii (`status-coal-pulse`)
- Diagonaalinen heat-shimmer pyyhkii satunnaisesti (8s) kortin yli

**Elite:**
- 3 amber-kipinää (vähemmän kuin Apex, ei samaa intensiteettiä)
- Crown-ikoni saa hennon `status-flame-flicker` -lepattaa
- Gold-borderiin lisätään `status-amber-ring-breathe` (hyvin kevyt)

**High Performer:**
- 2 amber-cinder-pistettä reunalla — uusi yhteys ylempiin tiereihin (sama tulilinja, eri väri ei enää, amber näyttää että "lämpö rakentuu")

**Legend:**
- Säilytetään nykyiset sparkle-aksentit + lisätään 4 amber/gold-cinder-pistettä jotka nousevat hitaammin (status-ember-rise mutta 7s) — antaa "mythic flame"-tunnun
- Conic-gradient sweep nopeutetaan hieman (animoitu `background-position` 12s)

### 3. `src/components/StatusHeader.tsx` — header tulee elävämmäksi

- Apex/Elite-käyttäjien header saa **alaosaan ohuen amber-ember-rivin** (nykyinen `flame-rim-pulse` säilyy + uusi 2 kpl pieniä kipinöitä jotka nousevat 20–30px korkeuteen ja fadetuvat)
- Apex-pillin `Zap`-ikoni → `status-flame-flicker`
- Elite-pillin `Crown` → kevyt `status-flame-flicker`
- Tier-progress-palkki (high tier+) saa hennon amber-glow:n liukuessaan

### 4. `src/components/StatusAvatar.tsx` — avatar polttaa

- Apex: nykyiseen `apex-aura-large` -box-shadowiin lisätään **2 kpl ember-pistettä** rinkulan ympärille (kiertävät hitaasti — käytetään yksinkertaista CSS-rotationia containerin sisällä, ei JS:ää)
- Apex `Flame`-badge-ikoni → `status-flame-flicker`
- Elite: tier-ringin sisäreuna saa hennon `status-amber-ring-breathe` (nykyinen statinen `bg-gradient-to-tr from-gold...` jää, vain ring-glow sykkii)
- High Performer: avatar saa pienen **amber-undertone-glow:n** (`box-shadow: 0 4px 12px hsl(42 78% 54% / 0.18)`) — ensimmäinen vihje tulesta

### 5. `src/components/StatusBadge.tsx` — pillit hehkuvat

- Apex/Legend `aura blur-md animate-pulse` → vaihdetaan smoother sykintään `status-amber-ring-breathe`
- Apex `Flame`-ikoni → `status-flame-flicker`
- Elite `Crown` → henno `status-flame-flicker` (vain `lg`-koossa, sm/md säilyy staattisena suorituskyvyn vuoksi listoissa)

### 6. `src/components/CheckinTierHeader.tsx` — check-in tulee polttavaksi top-tiereillä

- Tier rank ≥ 5 (Apex/Legend): pohjagradient saa **amber-cinder-rain**-overlayn (3 kpl ember-pisteitä jotka nousevat oikeasta laidasta vasemmalle)
- XP-chipin gold → flame: rank ≥ 5 chipin sisälle pieni `status-flame-flicker`-animoitu kipinä
- Streak-flame (kun `streakIntensity === "critical" || "legendary"`) → `status-flame-flicker`
- Progress bar shimmer: nopeutetaan rank ≥ 5 -tasoilla (`shimmer-slide` 1.4s entisen 2.2s sijaan)

### 7. `src/components/TierLadder.tsx` — ladderin Apex/Legend-rivit elävät

- Apex-rivi (rank 5): lisätään 2 kpl pieniä amber-kipinöitä rivin oikeaan reunaan (`status-ember-rise`)
- Legend-rivi (rank 6): nykyinen sparkle + 1 kpl amber-cinder
- "Current Tier"-badge (joka on aina gold) → `status-amber-ring-breathe` reuna
- Apex-locked "Unlock"-pilli säilyttää nykyisen — se on jo riittävän aggressiivinen

## Suorituskyky & saavutettavuus

- **Kaikki uudet animaatiot**: vain `transform`/`opacity`, ei `box-shadow` tai `filter` rAF-tiheydellä
- **`prefers-reduced-motion`**: kaikki kipinät ja sykinnät poistetaan staattisiksi (säilyy gradientit + statiset glowt)
- **Kipinöiden DOM-kustannus**: max 6 elementtiä per nameplate (Apex), 4 per Legend, 3 per check-in-header, 2 per status-header. Yhteensä < 20 spania per sivu.
- **`pointer-events: none`** kaikissa dekoratiivisissa elementeissä
- **`will-change: transform, opacity`** vain aktiivisesti animoituvissa

## Mitä EI muuteta

- Tier-värit, percentile-tekstit, tier-logiikka — säilyy samana
- Recruit/Operator/Performer säilyvät rauhallisina (kontrasti top-tiereihin = status feel)
- DB / RPC / auth — ei muutoksia
- Nykyiset apex-aura-large, flame-rim-pulse, breathing-glow, shimmer-slide — säilyvät, uudet täydentävät niitä

## Lopputulos

Kun Apex- tai Legend-käyttäjä avaa profiilin, **statuspaneeli polttaa**: kipinöitä nousee, reunat sykkivät amberiä, flame-ikoni lepattaa. Kun Elite katsoo headeria, kruunu hengittää lämpöä. Kun High Performer näkee avatarin, ensimmäinen vihje tulesta lämmittää alapuolelta — "olet matkalla". Status muuttuu staattisesta merkistä **elävän tulen ilmentymäksi** — premium tavalla, ei räjähdyksenä.

