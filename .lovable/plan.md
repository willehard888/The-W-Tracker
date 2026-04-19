
Käyttäjä haluaa molemmat: **Sunday Briefing** ensin, sitten **AI Coach memory + proaktiivisuus**. Suunnitelma rakentuu nykyisen `ai-coach`-edge-funktion ja `daily_checkins`-taulun päälle.

## Vaihe 1 — Sunday Briefing (viikkoraportti)

### Mitä rakennetaan
Joka sunnuntai-ilta käyttäjä saa **AI-generoidun viikkoraportin** push-notifikaationa. Avaaminen vie uudelle `/briefing/:id` -näkymälle, jossa raportti + jaettava kuva.

### Komponentit

**A) Tietokanta** — uusi taulu `weekly_briefings`
- `id`, `user_id`, `week_start`, `week_end`
- `summary_md` (AI:n tuottama markdown), `headline` (1 lause), `key_insights` (jsonb: 3 havaintoa)
- `next_week_protocol` (jsonb: 3 toimintapistettä)
- `stats_snapshot` (jsonb: viikon XP, streak-muutos, paras/heikoin päivä, completion%)
- `generated_at`, `viewed_at`
- RLS: käyttäjä näkee vain omansa, vain edge function (service role) voi insertoida
- Unique: `(user_id, week_start)`

**B) Edge function `weekly-briefing-generate`** (cron, sunnuntaisin 19:00 UTC)
- Hakee kaikki Elite-käyttäjät, joilla ≥3 check-iniä kuluneella viikolla
- Per käyttäjä: kerää viikon `daily_checkins` + nykyinen profiili
- Lähettää Lovable AI Gatewayyn (`google/gemini-3-flash-preview`) **structured output (tool calling)** → palauttaa JSON: headline, insights, protocol, summary_md
- Tallentaa `weekly_briefings`-tauluun
- Lähettää push-notifikaation (käyttää nykyistä `push_tokens`-taulua + APNs/FCM samalla tavalla kuin `notify-message`)

**C) Cron-skeduli** — `pg_cron` joka sunnuntai 19:00 UTC kutsuu edge-funktiota

**D) Frontend** — `src/pages/WeeklyBriefing.tsx`
- Hakee briefingin id:llä, merkitsee `viewed_at`
- Hero: headline iso, gold-gradientti
- Stats-grid: viikon XP, streak-muutos, perfect days, paras päivä
- "3 Key Insights" lista (gold-iconit)
- "Next Week Protocol" — 3 actionable korttia
- "Share" nappi → käyttää nykyistä `StoryShareModal`-pattern (3:4 PNG)
- Reitti `/briefing/:id` lisätään `App.tsx` -reititykseen
- `Index.tsx`-sivulle "View latest briefing" -kortti, jos viimeisin briefing < 7 pv eikä viewed

**E) AI-promptin runko** (edge functionissa, ei clientillä)
- System: "Olet W Coach. Tee viikkoraportti datasta. Kirjoita käyttäjän kielellä. Suora, ei kliseitä. Konkreettiset luvut."
- Tool schema: `{ headline, key_insights[3], next_week_protocol[3], summary_md }`
- Käyttäjän viikon data raakana → AI tekee analyysin

## Vaihe 2 — AI Coach memory + proaktiivisuus

### Mitä rakennetaan

**A) Coach-muisti** — `ai-coach`-funktion systeemiprompti laajenee:
- Hakee käyttäjän viim. **7 päivän check-init** (workout, sleep, cold, journal, hydration, perfect days)
- Hakee viim. briefingin `key_insights`
- Injektoi tiivistettynä system-promptiin (ei lähetetä raakadataa, vaan AI-readable yhteenveto)
- Coach voi viitata: "Eilen ei treeniä, 5h unta — tänään kevyt päivä"

**B) Proaktiivinen aamuviesti** — uusi edge function `coach-morning-nudge`
- Cron joka aamu 07:00 (käyttäjän paikallisesta aikavyöhykkeestä → MVP: 07:00 UTC, myöhemmin tz-tuki)
- Per Elite-käyttäjä, jolla check-in eilen: AI generoi 1-2 lauseen päivän fokuksen
- Tallennetaan uuteen tauluun `coach_nudges` (id, user_id, content, created_at, seen_at)
- Push-notifikaatio: "Coach: [headline]"

**C) Coach Insight -kortti `Index.tsx`-sivulle** (Elite vain)
- Näyttää tämän aamun nudgen, jos olemassa eikä `seen_at`
- Tap → `/coach`, lähettää nudgen seuraavaksi viestiksi kontekstina
- Compact gold-card, sparkles-icon

### Tietokanta — `coach_nudges`
- `id`, `user_id`, `content` (text), `created_at`, `seen_at`
- RLS: käyttäjä näkee/päivittää vain omansa, service role insertoi
- Index: `(user_id, created_at desc)`

## Tekninen yhteenveto

```text
Sunday Briefing flow
─────────────────────
pg_cron (Sun 19:00) ──► weekly-briefing-generate
                              │
                              ├─► fetch elite users + 7d checkins
                              ├─► AI Gateway (gemini-3-flash, tool call)
                              ├─► insert weekly_briefings
                              └─► push notification ──► /briefing/:id

Coach Memory + Nudge flow
─────────────────────────
User opens /coach ──► ai-coach edge fn
                         └─► system prompt + 7d stats summary

pg_cron (daily 07:00) ──► coach-morning-nudge
                              ├─► AI Gateway per user
                              ├─► insert coach_nudges
                              └─► push notification

Index.tsx (Elite) ──► shows latest unseen nudge as gold card
```

### Tiedostot

**Uudet:**
- `supabase/migrations/<ts>_weekly_briefings.sql`
- `supabase/migrations/<ts>_coach_nudges.sql`
- `supabase/functions/weekly-briefing-generate/index.ts`
- `supabase/functions/coach-morning-nudge/index.ts`
- `src/pages/WeeklyBriefing.tsx`
- `src/components/CoachNudgeCard.tsx`
- `src/components/BriefingShareCard.tsx` (3:4 jakokuva)

**Muokattavat:**
- `supabase/functions/ai-coach/index.ts` — laajennettu system prompt 7d statseilla
- `src/App.tsx` — reitti `/briefing/:id`
- `src/pages/Index.tsx` — Coach Nudge -kortti + Latest Briefing -kortti
- `supabase/config.toml` — function configs jos tarpeen
- `mem://features/ai-coach` ja uusi `mem://features/sunday-briefing`

### Kustannus & rate limits
- Briefing: 1 AI-kutsu per Elite-käyttäjä per viikko (halpa)
- Nudge: 1 AI-kutsu per Elite-käyttäjä per päivä (gemini-3-flash → halpa)
- 429/402 errorit logataan, briefing/nudge skipataan kyseisen kierroksen ajaksi (tallentamatta)

### Miksi tässä järjestyksessä
1. Briefing valmiiksi → testaa AI-pipeline + structured output + push-flow
2. Coach memory käyttää samaa pipelinea + briefing-dataa systeemipromptissa → luonnollinen jatko

### Mitä **ei** tehdä tässä vaiheessa
- Ei aikavyöhyketukea nudgille (MVP: 07:00 UTC, seuraava iteraatio lisää tz)
- Ei manuaalista "generate now" -nappia briefingille (vain cron, pidetään yksinkertaisena)
- Ei historiaa briefingeistä erillisellä sivulla — vain viimeisin Indexissä, suora linkki id:llä
