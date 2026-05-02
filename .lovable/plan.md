
# Adaptive AI Coach v2 — Daily-driven personal trainer

Tällä hetkellä Coach näyttää staattisen 4-viikon ohjelman (Today / Program / Progress / Chat). Käyttäjä saa treenin, mutta järjestelmä ei oikeasti **mukaudu päivän dataan** (uni, palautuminen, streak, eilinen RPE) eikä tarjoa **päivittäisiä korkean vaikutuksen mikrotehtäviä** treenin ulkopuolelta. Tämä päivitys tekee Coachista jatkuvasti adaptoituvan, mitattavan ja pelillistetyn.

## Mitä rakennetaan

### 1. Daily Plan — adaptiivinen päiväsuunnitelma
Today-välilehden yläosaan lisätään uusi **"Today's Mission"** -kortti, joka näyttää 3–5 priorisoitua tehtävää joka aamu, generoituna käyttäjän edellisen vuorokauden datasta:

- **Primary** — päivän treeni ohjelmasta (säädetty)
- **Recovery** — esim. "Sleep ≥ 8h tonight (you got 6.2h yesterday)"
- **Focus** — esim. "20 min deep work, no phone"
- **Habit anchor** — esim. "3L water before 18:00"
- **Edge** — yksi venyttävä haaste (esim. "2 min cold finish")

Jokainen tehtävä:
- näyttää **odotetun XP-palkkion** (15–60 XP impact-luokituksen mukaan)
- on yhdellä napautuksella merkittävissä tehdyksi → haptinen + XP-flash + streak-tick
- värikoodattu prioriteetilla (Gold = high impact, Teal = recovery, Purple = focus)

### 2. Adaptive difficulty engine
Uusi reuna­funktio `coach-daily-plan` (cron: 04:00 UTC + on-demand) tekee jokaiselle Premium-käyttäjälle:

- Lukee 7 viime päivän `daily_checkins`, `coach_program_logs`, viimeisen RPE:n ja streak-tilan
- Laskee **Readiness Score (0–100)** = f(uni 7d avg, eilinen RPE, streak velocity, missed sessions)
- Säätää päivän treenin volyymia automaattisesti:
  - readiness ≥ 80 → push: +1 set tai +5 % kuorma-vihje
  - 60–79 → as planned
  - 40–59 → deload: −1 set, lyhempi conditioning
  - < 40 → swap to recovery day
- Kutsuu Lovable AI Gateway (`google/gemini-2.5-flash`) generoimaan 3–5 mikrotehtävää tool-callingilla → tallennetaan `coach_daily_plans`-tauluun
- Jos käyttäjä ei tee tehtäviä → seuraavana päivänä Coach kommentoi suoraan ("You skipped recovery twice — drop one workout this week")

### 3. Weekly review + auto-progression
Sunnuntai-iltaisin uusi cron `coach-weekly-review`:

- Aggregoi viikon compliance, XP-trendi, RPE-keskiarvo, unen muutos
- Päättää onko ohjelma **liian helppo / liian raskas / sopiva**
- Päivittää `coach_programs.plan_json` -kentän tulevien viikkojen volyymin (progressive overload tai deload)
- Luo `coach_nudges`-rivin: "Week recap: +12 % volume next week — you earned it."
- Lisää **Weekly Challenge** -korin (esim. "5/5 sleep ≥ 7.5h" → 200 XP bonus)

### 4. Honest, action-first feedback
- "Coach's Read" -kortti Progress-välilehdellä saa kontekstin myös päivätehtävistä (ei vain check-ineistä)
- AI-system prompttiin lisätään suora ohje: *"Be blunt. Name the gap. Prescribe next 24h, not theory."*
- Streak-katkon jälkeen Coach lähettää automaattisen `coach_nudges`-viestin: "You broke a 14-day streak. Here's how we restart: …"

### 5. Gamification layer
- Päivätehtävän suoritus → +XP (vaikutuksen mukaan), näkyy heti Today-kortissa numero­animaationa
- **Mission Streak** — erillinen streak-mittari "missions completed in a row"
- Uusi badge-kategoria: "Adaptive Mastery" (esim. 7 perfect missions / 30 missions / readiness ≥ 80 viikon ajan)
- Level up -event triggeröi koko-näytön celebration (samaa pattern kuin Elite Unlock)

## Tekninen muutoslista

### Tietokanta (migraatio)
```text
coach_daily_plans
 ├─ id uuid PK
 ├─ user_id uuid
 ├─ plan_date date
 ├─ readiness_score int (0–100)
 ├─ readiness_breakdown jsonb (sleep, rpe, streak, missed)
 ├─ adjustment text  (push|hold|deload|swap)
 ├─ missions jsonb   ([{id, kind, title, detail, xp, priority, done}])
 ├─ generated_at timestamptz
 └─ UNIQUE (user_id, plan_date)

coach_mission_logs
 ├─ id uuid PK
 ├─ user_id uuid
 ├─ daily_plan_id uuid
 ├─ mission_id text
 ├─ completed_at timestamptz
 └─ xp_awarded int
```
RLS: Premium gate insert/select kuten `coach_programs`. Mission completion XP päivitetään profiles.xp **SECURITY DEFINER RPC:llä** `award_mission_xp(_plan_id, _mission_id)`.

Uusi badge-rivit (insert tool):  `mission_streak_7`, `mission_streak_30`, `readiness_master_7`, `perfect_mission_30`.

### Edge functions
- `coach-daily-plan` (uusi) — cron + on-demand, `verify_jwt = true`. Käyttää `google/gemini-2.5-flash` + tool-calling schemalla `emit_daily_plan`.
- `coach-weekly-review` (uusi) — sunnuntai-cron. `google/gemini-2.5-flash`, päivittää `coach_programs.plan_json` ja luo `coach_nudges`-rivin.
- `ai-coach` (muokkaus) — system promptiin injektoidaan tämän päivän mission-status + readiness score; tone "blunt action-first".
- `pg_cron` + `pg_net` -ajastukset (insert tool, ei migraatio).

### Frontend
- Uusi: `src/hooks/use-daily-plan.ts` (react-query, real-time channel `coach_daily_plans`)
- Uusi: `src/components/coach/DailyMissionCard.tsx` — animoitu lista, swipe-to-complete, XP-flash
- Uusi: `src/components/coach/ReadinessRing.tsx` — pieni 0–100 rengasvisuaali Today-kortin ylälaitaan
- Uusi: `src/components/coach/WeeklyChallengeCard.tsx` — Progress-välilehdelle
- Muokkaus: `src/pages/Coach.tsx` Today-tab: Mission-kortti ennen TodaySessionCard:ia
- Muokkaus: `src/components/home/CoachStrip.tsx` näyttää "X / Y missions done today" + readiness ring
- Muokkaus: `src/components/coach/ProgressDashboard.tsx` lisää WeeklyChallengeCard ja Mission Streak -mittari

### Cron
```text
04:00 UTC daily   → coach-daily-plan (kaikki Premium-käyttäjät, batch 50)
22:00 UTC sun     → coach-weekly-review
```

## Käyttäjäkokemus (uusi Today-tab)

```text
┌──────────────────────────────────────┐
│  Today · Week 2 · Wed                │
│  Readiness  ●●●●●○○○○○  72           │
│  Hold the line — sleep was tight.    │
├──────────────────────────────────────┤
│ TODAY'S MISSION         3 / 5  ✓✓✓○○ │
│ ◆ Lower body strength · 55 min  +60  │
│ ◆ Sleep ≥ 8h tonight            +30  │
│ ◆ 20 min deep work, no phone    +20  │
│ ◆ 3L water before 18:00         +15  │
│ ◆ Edge: 2 min cold finish       +25  │
├──────────────────────────────────────┤
│ [ Open today's session ]             │
└──────────────────────────────────────┘
```

## Mitä EI muutu
- Premium-paywall logiikka (sama `has_premium`/`has_active_access`)
- Olemassa oleva 4-viikon `coach_programs` -rakenne — uusi taso tulee päälle, ei tilalle
- Chat-välilehti säilyy ennallaan (saa vain rikkaamman kontekstin)

Hyväksy niin toteutan kerralla: migraatio + 2 edge functionia + cron + 4 uutta komponenttia + Today/Progress-päivitykset.
