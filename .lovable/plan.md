

## Apple Health "Verified Proof" — korjattu suunnitelma

Olit oikeassa: kameraproof EI ole pakollinen — se on Elite-only ja vapaaehtoinen. Tämä muuttaa Apple Health -integraation positionin merkittävästi: HealthKit ei ole "kameran lisävahvistus" vaan **ensimmäinen oikea anti-cheat-mekanismi koko appiin**.

### Mitä tämä muuttaa strategisesti

Tällä hetkellä:
- Kuka tahansa voi togglata "workout" päälle ilman mitään todistusta → +20-35 XP
- Sleep-tunnit, hydraatio, kylmä suihku jne. ovat kaikki itse-ilmoitettuja
- Kameraproof = vain Elite-bonus, ei enforce mitään

Apple Health -integraatio tuo koko appiin **ensimmäisen tamper-resistant verifikaation**. Tämä on iso markkinointikulma: "First fitness app where workouts can't be faked."

### 1. Kaksi tasoa: Standard vs Verified XP

**Standard check-in (kuten nyt, kaikille):**
- Kaikki togglet itse-ilmoitettuja → base XP
- Toimii Androidilla, webissä, iOS:llä ilman Apple Healthia
- Säilyttää nykyisen kokemuksen muuttumattomana

**Verified check-in (opt-in, iOS + Apple Watch):**
- Workout-toggle → vaatii HealthKit-workoutin viimeisen 24h sisällä → ✓ Verified -merkki + base XP + **+10 XP bonus**
- Sleep-tunnit → prefillataan HealthKitistä → ✓ Verified-merkki sleep-rivillä
- Käyttäjä voi yhä togglata standardisti jos ei halua verifioida

### 2. Miksi tämä toimii reiluuden kannalta

- **Ei syrji ketään**: standard-XP toimii kuten ennenkin, kaikki tasot saavat saman base-XP:n
- **+10 XP bonus on pieni**: ei muuta leaderboardia merkittävästi (yksi gym-treeni 30 XP → 40 XP verified)
- **Verified Athlete -merkki** on prestige-elementti, ei XP-etu — markkinasignaali ei pelietu
- **Android/web-käyttäjät** näkevät Verified-merkit muilla mutta saavat oman base-XP:nsä → toimii kuten "blue checkmark" Twitterissä

### 3. Backend

**Uusi taulu `verified_workouts`:**
- `id`, `user_id`, `checkin_id` (nullable), `workout_type`, `started_at`, `ended_at`, `duration_seconds`, `calories`, `avg_heart_rate`, `source` ('apple_health'), `verified_at`
- RLS: SELECT oma + julkinen pelkkä `verified_workouts.user_id` count (Verified Athlete -merkkiä varten)
- INSERT vain RPC kautta, ei suora

**RPC `record_verified_workout(checkin_id uuid, workout_data jsonb)`:**
- Validointi:
  - `started_at >= now() - interval '24 hours'`
  - `duration_seconds >= 600` (≥10min)
  - `ended_at > started_at AND ended_at <= now()`
  - Tyyppi whitelistissä: running, walking, cycling, strength, yoga, hiit, swimming, hiking, rowing, mma, crossfit
  - Ei duplikaattia: `unique(user_id, started_at)`
  - Check-in olemassa ja kuuluu samalle käyttäjälle, sama päivämäärä
- Bonus: `profiles.xp += 10` (max 1× / check-in / päivä)
- Palauttaa: `{ verified: true, bonus_xp: 10 }` tai virheen

**Verified Athlete -kriteeri (frontend-laskenta):** ≥5 verified workoutia viimeisen 30 päivän aikana

### 4. iOS-natiiviasennus

- Asennetaan `capacitor-health` (community-plugin, tukee Capacitor 8 + HealthKit)
- Vaihtoehtoisesti oma natiiviplugin Swiftilla jos community-plugin ei toimi luotettavasti — testataan ensin
- `ios/App/App/Info.plist`:
  - `NSHealthShareUsageDescription`: "We read your workouts, sleep and active energy from Apple Health to verify your check-ins and award the Verified badge. This is optional and you can disable it anytime in Profile."
- Uusi `ios/App/App/App.entitlements` HealthKit-capabilityllä, lisätään `project.pbxproj`-viittauksiin
- `ios/App/ci_scripts/ci_post_clone.sh` varmistaa entitlements säilyy Xcode Cloud -buildeissa
- Lockfile-integriteetti varmistettu (mem://technical/ios-development-build mukaan)

### 5. UI-muutokset

**A) `Profile.tsx`** — uusi "Apple Health" -osio (vain iOS-natiivilla, web-piilo):
- Toggle "Connect Apple Health" → natiivilupa
- Status: "Connected · 7 verified workouts this month"
- Disconnect-nappi
- Tila tallennetaan `localStorage.w_health_connected` (ei profiles-saraketta)

**B) `DailyCheckin.tsx`** — workout-toggle laajenee:
- Jos HealthKit yhdistetty + workout löytyy 24h sisällä → näytä "✓ Verified workout from Apple Health · 32 min" workout-toggle-rivin alle
- Jos workout ON päällä mutta HealthKitistä ei löydy → "Verify with Apple Health (+10 XP)" -rivi nappiineen
- Sleep-rivi: jos HealthKit yhdistetty → prefillaa sleep-tunnit, näytä "Auto-filled from Apple Health" subtekstinä, käyttäjä voi yhä yliajaa

**C) Verified-merkki:**
- Uusi `VerifiedBadge.tsx` -komponentti (pieni gold-ikoni heart + checkmark)
- Näkyy check-in-confirmation-näytöllä XP-breakdownissa: "Workout +30 · Verified +10 = 40 XP"
- Näkyy Profile.tsx -sivulla username:n vieressä jos Verified Athlete (≥5/30pv)
- Näkyy `PublicProfile.tsx` -sivulla
- Näkyy `Leaderboard.tsx` -riveillä username:n vieressä
- Näkyy `Battles.tsx` -riveillä jos vastustaja Verified Athlete

**D) `Onboarding.tsx`** — uusi 5. step (vain iOS-natiivilla):
- "Verify your discipline with Apple Health" — näyttää Verified-merkin esimerkin
- "Connect Apple Health" -nappi tai "Skip" -linkki
- Jos skipataan, voi yhdistää myöhemmin Profile-sivulta

### 6. Tiedostot

**Uudet:**
- `src/lib/health-kit.ts` (Capacitor-pluginin wrapper: requestPermissions, getRecentWorkouts, getLastNightSleep, isAvailable)
- `src/components/HealthKitToggle.tsx` (Profile-osio)
- `src/components/VerifiedWorkoutPicker.tsx` (DailyCheckinin workout-rivin laajennus)
- `src/components/VerifiedBadge.tsx` (✓ -merkki)
- `src/hooks/use-verified-athlete.ts` (laskee 30pv verified workout count)
- `supabase/migrations/<ts>_verified_workouts.sql` (taulu + RLS + RPC)
- `ios/App/App/App.entitlements` (HealthKit capability)

**Muokattavat:**
- `package.json` (capacitor-health dependency)
- `ios/App/App/Info.plist` (NSHealthShareUsageDescription)
- `ios/App/App.xcodeproj/project.pbxproj` (entitlements-viittaus)
- `ios/App/ci_scripts/ci_post_clone.sh` (entitlements-säilytys)
- `src/pages/Profile.tsx` (HealthKitToggle + Verified Athlete -merkki)
- `src/pages/DailyCheckin.tsx` (Verified workout -picker + sleep prefill)
- `src/pages/Onboarding.tsx` (5. step iOS:llä)
- `src/pages/PublicProfile.tsx` (Verified-merkki)
- `src/pages/Leaderboard.tsx` (Verified-merkki riveille)
- `src/pages/Battles.tsx` (Verified-merkki vastustajille)
- `src/pages/PrivacyPolicy.tsx` (HealthKit-osio)

### 7. Tekninen yhteenveto

```text
Käyttäjä iOS + Apple Watch:
  Profile → Connect Apple Health → natiivilupa
       │
       ↓
  DailyCheckin:
    ├─ Workout-toggle päällä
    │    ├─ HK-workout löytyy → auto ✓ Verified + base XP + 10 bonus
    │    └─ Ei löydy        → standard base XP
    │
    └─ Sleep-rivi prefill HK:sta (yliajettavissa)

Käyttäjä iOS ilman Apple Watchia / Android / Web:
  Standard check-in normaalisti, base-XP, ei verified-mahdollisuutta

Verified Athlete -merkki:
  ≥5 verified workoutia 30 päivässä → ✓ näkyy kaikkialla
```

### Mitä EI tehdä

- Ei tehdä HealthKitistä pakollista millekään featurelle
- Ei korkeampaa kuin +10 XP bonusta (säilyttää reiluuden)
- Ei battle-verifikaatiota tässä vaiheessa (vain check-in)
- Ei Android Health Connect / Strava / Whoop -integraatioita
- Ei sykekäyrän tai raakadatan tallennusta — vain workout-meta
- Ei muuteta nykyistä Elite-kameraproof-flow'ta lainkaan

