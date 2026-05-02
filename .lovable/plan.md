
# Evidence-Based Wellness Framework for W Coach

Tällä hetkellä Adaptive Coach v2 generoi päivittäiset missiot AI:lla mutta ilman **strukturoitua, näyttöön perustuvaa runkoa**. AI valitsee aiheet vapaasti, eikä käyttäjälle näy miksi tehtävä on määrätty, mikä on sen tieteellinen vahvuus, eikä järjestelmässä ole pitkän aikavälin habit/protocol-progressiota.

Tämä päivitys tuo **Wellness Framework v1**: 6 pilaria → ~30 protokollaa → evidence tier → annosohje (kesto/intensiteetti/frekvenssi) → odotettu hyöty → riskit. Framework toimii sekä **datan ankkurina AI-missioille** että **selattavana protocol library:nä** + **habit progression -järjestelmänä** käyttäjälle.

## 1. Framework — 6 pilaria (20/80)

Korkein vaikutus per käytetty minuutti, painotus tutkimusnäytön mukaan:

```text
1. SLEEP        — uni & sirkadiaaninen rytmi          (vahvin näyttö)
2. MOVEMENT     — Z2 + voima + VO2 intervals          (vahva näyttö)
3. NUTRITION    — proteiini, kuitu, ravintotiheys     (vahva–lupaava)
4. STRESS/MIND  — hengitys, meditaatio, luonto        (vahva–lupaava)
5. RECOVERY     — kylmä, lämpö, palautumistaidot      (lupaava–spekulatiivinen)
6. CONNECTION   — sosiaaliset suhteet, merkitys       (vahva näyttö, vähän mitattu)
```

Jokainen pilari = `pillar_id`, ikoni, väri (jo olemassa: gold/teal/violet/sky/rose + uusi emerald connectionille).

## 2. Protokolla-katalogi (~30 protokollaa)

Iso datapohja — tallennetaan **versionoituna staticina** (`src/lib/wellness-framework.ts`), ei DB-tauluna. Esimerkkirivit:

```text
PROTOCOL                      PILLAR     EVIDENCE     DOSE                          BENEFIT                          RISK
sleep-7-9h                    sleep      strong       7–9h, sama aika ±30min        kognitio, palautuminen           sängyssä >9h → masennusriski
morning-light-10min           sleep      strong       10 min ulkona <60min heräämi  sirkadiaaninen ankkurointi       ei suoraan auringon katsominen
zone-2-cardio                 movement   strong       150–180 min/vk @ 60–70% HRmax mitokondriot, insuliiniherkkyys  matalan kynnyksen ortop. riski
strength-2-3x                 movement   strong       2–3 sessiota/vk, 8–12 sarjaa  lihasmassa, luusto, glukoosi     ei tekniikkaa → revähdys
vo2-intervals-1x              movement   strong       4×4 min @ 90% HRmax, 1x/vk    VO2max, mortaliteettiriski ↓     ei vasta-aloittaneille
protein-1-6g-per-kg           nutrition  strong       1.6 g/kg/vrk, jaettuna        lihasprotsynt., kylläisyys       ei merkitt. munuaisriskiä
fiber-30g                     nutrition  strong       25–35 g/vrk                   mikrobiomi, kardiomet.           liikaa nopeasti → puhaltaa
hydration-30ml-kg             nutrition  promising    ~30 ml/kg, ei myöh. iltaa     suorituskyky, päänsärky          hyponatremia hyvin harvoin
breath-box-5min               stress     strong       4-4-4-4, 5 min                paras. autonomian tasapaino     ei
nsdr-yoga-nidra-10min         stress     promising    10–20 min iltapäivä           palautumis-uni-substituutti      anekdoottinen unenlaatu
mindfulness-10min             stress     strong       10 min/päivä 8 vk             ahdistus ↓, fokus ↑              ei
nature-2h-week                stress     promising    ≥120 min/vk metsää            hyvinvointimittarit              käytännön logistiikka
cold-2-3min                   recovery   promising    2–3 min ≤15 °C, 2–4x/vk       mieliala, ruskea rasva           voimaharjoituksen jälkeen ↓ hypertrofia
sauna-20min-4x                recovery   promising    20 min @ 80 °C, 4x/vk         kardiov. mortaliteetti ↓ (obs)   nestehukka, raskaus
mobility-10min                recovery   promising    10 min iltarutiini            liikkuvuus, kivuttomuus          ei
cwt-contrast                  recovery   speculative  vuorot. kylmä/lämpö 3x        anekdoottinen palautuminen       sydänsairaat varovaisuus
deep-work-90min               focus      strong       90 min ilman puhelinta        tuottavuus, flow                 vaatii kalenterointia
no-phone-first-60min          focus      promising    1. tunti aamu ilman ruutua    kortisoli, ankkurointi           anekdoottinen
journaling-5min               focus      promising    5 min iltapäivä, ranskalaiset metakognitio                     ei
weekly-social-2x              connection strong       2 merkityksellistä kohtaamista mortaliteetti ↓ (Harvard 80v)   ei
gratitude-3x                  connection promising    3 asiaa illalla, 14 vk        positiiv. affekti                lievä, lyhytkestoinen
strength-progressive-overload movement   strong       +2.5–5% kuorma kun 12 reps    pitkäkest. adaptaatio            tekniikka edellä
caffeine-cutoff-8h            sleep      promising    Ei kofeiinia 8–10h ennen unta latenssin lyheneminen            yksilölliset erot
alcohol-zero-on-training      sleep      strong       Ei alkoholia treenipäivänä    REM-uni, lihasprotsynt.          sosiaaliset paineet
walk-after-meals-10min        nutrition  promising    10 min kävely aterian jälk.   glukoosihuiput ↓                ei
sun-vitd-15min                recovery   promising    15 min iho aurinkoa kesällä   D-vit, mieliala                  ihosyöpäriski yli-altistus
breath-physiological-sigh     stress     promising    2 sisäänhenk. + uloshenk. 1min ahdistuksen lasku akuutisti     ei
heart-rate-variability-track  recovery   speculative  Aamu-HRV trendi               yksilöllinen palautumismittari   yksittäisten arvojen ylitulkinta
ice-bath-pre-sleep            recovery   speculative  kylmä <2h ennen unta          anekdoottinen unisyvyys          unen häiriintyminen
fasted-cardio                 nutrition  speculative  Z2 paastotilassa              rasvanpolto-claim                heikko vaikutus pitkällä aik.
```

Tagit per protokolla:
- `pillar`, `evidence: "strong" | "promising" | "speculative"`,
- `dose: { value, unit, frequency_per_week, time_of_day? }`,
- `benefit: string` (1 lause, mitä tutkimus osoittaa),
- `risk: string` (1 lause, kontraindikaatiot),
- `citations: string[]` (DOI tai meta-analyysi-viittaus, max 3),
- `tags: ("morning"|"evening"|"low-effort"|"high-effort"...)[]`.

## 3. AI-mission-generator käyttää frameworkkiä

Muutos `coach-daily-plan` edge functionissa:

1. Function lataa `wellness-framework.ts` -version (versioidaan: `framework_version: "1.0"`)
2. Frameworkin protokollat injektoidaan **AI-systeemipromptiin** strukturoituna listana (vain `id`, `pillar`, `evidence`, `dose_summary`)
3. Tool-schema laajennetaan: jokainen mission saa `protocol_id` + `evidence` + `pillar`
4. AI:lle annetaan sääntö: **"Choose protocols only from the provided catalog. Never invent a protocol."**
5. Painotussääntö: vähintään 60 % päivän XP:stä `evidence: "strong"` -protokollista

Tool-schema lisäkenttä:
```text
protocol_id: enum (kaikki katalogin id:t)
evidence:   "strong" | "promising" | "speculative"
pillar:     "sleep" | "movement" | ...
why:        max 90 chars — 1 lause perustelu (pohjautuu päivän dataan)
```

## 4. Käyttäjälle näkyvä UI

### 4.1 Mission-rivien laajennus
Olemassa oleva `MissionRow` (`DailyMissionCard.tsx`) saa pienen **evidence-mikrochipin** kind-chipin viereen:
```text
+30 XP  •  STRONG    (vihreä)
+25 XP  •  PROMISING (keltainen)
+20 XP  •  EARLY     (harmaa)
```
Tap → avaa `<ProtocolSheet />` joka näyttää: pilari, annos, hyöty, riski, evidence-status, "miksi sinulle tänään" (AI:n `why`).

### 4.2 Uusi reitti `/coach/library` — Protocol Library
- 6 pilarisuodatinta (vaakaan scrollattava chip-rivi)
- Evidence-toggle: "Show only strong-evidence protocols"
- Hakukenttä
- Card-grid: protokolla-kortti (pilari-väri, dose, evidence-badge)
- Tap → sama `ProtocolSheet`
- "Add to my habits" -nappi → tallentaa `user_habits`-tauluun

### 4.3 Uusi Coach-välilehti **"Habits"** (5. tab)
Tabit muuttuvat: `Today · Program · Habits · Progress · Chat`

Sisältö:
- Aktiiviset habitit (käyttäjän valitsemat protokollat) — max 5 kerralla, jotta ei tukehduta
- Jokainen näyttää: streak (peräkkäiset päivät tehty), level (1→5 progression-säännöillä alla), seuraava milestone, evidence-tier
- Inline-kuittaus (kuten daily mission) — antaa pienemmän XP:n (5–15 XP/habit/päivä) kuin daily mission, jotta päämissionit pysyvät pääfookuksena

### 4.4 Today-tabin "Why this plan" -osio
Daily mission -kortin alle pieni laajennettava blokki:
```text
▾ Why this plan
This plan emphasises SLEEP and MOVEMENT because your 7-day
sleep average is 6.2h (target 7.5h+) and you logged 1 missed
session. 4/5 protocols are strong-evidence.
```
AI generoi tämän samalla tool-callilla (uusi schema-kenttä `rationale`).

## 5. Habit Progression -järjestelmä

Vältetään "kaikki kerralla" → tasoitettu progression:

```text
LEVEL 1  (Spark)      0–6 päivää  → "Yritä 3x/vk"          baseline XP
LEVEL 2  (Rhythm)     7–20 päivää → "Tee suositusannos"     +25% XP
LEVEL 3  (Locked-in)  21–59       → "Lisää 1 variaatio"     +50% XP, badge
LEVEL 4  (Compound)   60–119      → "Yhdistä toiseen"       +75% XP, badge
LEVEL 5  (Identity)   120+        → "You are this habit"    2× XP, premium badge
```

Säännöt:
- Streak nollautuu 1 missatun päivän jälkeen → palaa edelliselle tasolle (ei nollaan), jotta ei rangaista yhdestä lipsumisesta
- Maksimissaan 5 aktiivista habitia kerralla — uusi vaatii arkistoinnin

## 6. Tekniset muutokset

### 6.1 Uudet tiedostot
- `src/lib/wellness-framework.ts` — koko katalogi + tyypit + version-vakio. ~600 LOC, mutta puhdas data.
- `src/components/coach/ProtocolSheet.tsx` — bottom-sheet (käytä olemassa olevaa `Sheet` komponenttia)
- `src/components/coach/HabitCard.tsx` — käyttäjän aktiivinen habit
- `src/components/coach/HabitsTab.tsx` — Habits-välilehden sisältö
- `src/pages/ProtocolLibrary.tsx` — `/coach/library`
- `src/hooks/use-user-habits.ts` — react-query + realtime
- `src/hooks/use-protocol.ts` — `getProtocol(id)` selektori

### 6.2 Muokkaukset
- `src/pages/Coach.tsx` — lisää 5. tab "Habits"
- `src/components/coach/DailyMissionCard.tsx` — evidence-chip + tap → sheet, "Why this plan" -laajennus
- `supabase/functions/coach-daily-plan/index.ts` — injektoi catalog, laajennettu tool-schema (`protocol_id`, `evidence`, `pillar`, `why`, `rationale`), 60 %-strong-XP-validointi serverpuolella (jos AI livahtaa, korjataan painotuksia ennen tallennusta)
- `src/App.tsx` — uusi route `/coach/library`

### 6.3 Migraatio (uudet taulut)
```text
user_habits
 ├─ id uuid PK
 ├─ user_id uuid
 ├─ protocol_id text          -- viittaa wellness-framework.ts -id:hen
 ├─ added_at timestamptz
 ├─ archived_at timestamptz
 ├─ current_streak int
 ├─ best_streak int
 ├─ level int                  -- 1..5
 └─ UNIQUE (user_id, protocol_id) WHERE archived_at IS NULL

user_habit_logs
 ├─ id uuid PK
 ├─ habit_id uuid → user_habits
 ├─ user_id uuid
 ├─ logged_on date
 ├─ xp_awarded int
 └─ UNIQUE (habit_id, logged_on)
```

RLS:
- `user_habits` — Premium gate, omistaja CRUD
- `user_habit_logs` — Premium gate, INSERT vain SECURITY DEFINER RPC `log_habit(_habit_id, _date)` joka:
  1. tarkistaa ettei jo logattu kyseiselle päivälle
  2. laskee level-säännöt → XP
  3. päivittää `current_streak` / `best_streak` / `level`
  4. lisää `profiles.xp` += XP

### 6.4 `coach_daily_plans.missions` JSONB
Lisätään olemassa oleviin missioneihin valinnaiset kentät: `protocol_id`, `evidence`, `pillar`, `why`. Vanhat plan-rivit toimivat (kentät optional). Lisätään myös `coach_daily_plans.rationale text NULLABLE`.

Migraatio:
```text
ALTER TABLE coach_daily_plans
  ADD COLUMN rationale text,
  ADD COLUMN framework_version text NOT NULL DEFAULT '1.0';
```

### 6.5 Memory-päivitys
Päivitä `mem://features/ai-coach.md` kuvaamaan framework + evidence-tierit. Lisää uusi `mem://features/wellness-framework.md` jossa on katalogin versionumero ja yhteenveto.

## 7. Mitä EI tehdä tässä erässä

- Ei muuteta olemassa olevaa daily check-in -listaa (ei pakoteta uutta UI:ta päämassalle)
- Ei poisteta nykyisiä missioita / fallbackia
- Ei lisätä ulkoisia API-integraatioita (Apple Health, Oura) — `wellness-framework.ts` toimii puhtaasti omasta datasta
- Ei lisätä HRV-tracking-protokollaa aktiiviseksi habitiksi (näytetään kirjastossa "speculative")

## 8. Lopputulos käyttäjälle

1. Päivän missiot ovat **läpinäkyviä**: jokainen kertoo "miksi minulle, miksi nyt, miten vahva näyttö"
2. **Library** = selailtava tietokanta — käyttäjä voi oppia ja valita
3. **Habits** = pitkän aikavälin progression, joka ei tukahdu yhteen lipsumiseen
4. AI ei enää keksi protokollia — se valitsee ja perustelee tunnetuista
5. Evidence tier opettaa rehellisesti: vahvasti todistettua erottuu kokeellisesta

Hyväksy → toteutan kerralla: framework-data, 1 migraatio, edge function -laajennus, 4 uutta komponenttia, 1 uusi sivu, Habits-tab, ProtocolSheet, ja UI-evidenssimerkinnät.
