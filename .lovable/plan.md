

## Moderaattori optimaaliseksi — toteutussuunnitelma

Optimoidaan nykyinen `moderate-content` -edge function neljän osa-alueen yli: **nopeus**, **kustannus**, **luotettavuus** ja **käyttäjäkokemus**. Muutokset säilyttävät nykyisen API-pinnan taaksepäin yhteensopivana.

### Pääperiaatteet

1. **Pre-flight estää turhat AI-kutsut** — koko/MIME/hash-tarkistus selaimessa
2. **Cache toistuvat kuvat** — sama hash → välitön vastaus
3. **Thumbnail moderoidaan ennen täyttä uploadia** — säästää bandwidthia ja antaa nopean palautteen
4. **Fail-CLOSED kuville** — jos AI-gateway alhaalla, ei päästetä spam läpi
5. **Confidence-perusteinen reititys** — matala luottamus → admin-jono
6. **Rate-limit per käyttäjä** — 5 moderaatiota/min

### 1. Tietokantamuutokset (migraatio)

**`moderation_cache`** (uusi taulu)
- `image_hash text PRIMARY KEY`, `action text`, `categories text[]`, `confidence numeric`, `severity text`, `reason text`, `created_at timestamptz`
- Indeksi `created_at`-kentälle vanhojen poistamista varten
- RLS: vain service-role kirjoittaa/lukee
- TTL-cleanup: 30 päivää vanhempi data poistetaan (cron-funktiossa)

**`moderation_queue`** (uusi taulu)
- `id uuid PK`, `content_type text`, `content_id uuid`, `image_url text`, `text_content text`, `user_id uuid`, `ai_action text`, `ai_confidence numeric`, `ai_categories text[]`, `ai_reason text`, `status text DEFAULT 'pending'` ('pending'|'approved'|'rejected'), `reviewed_by uuid`, `reviewed_at timestamptz`, `created_at timestamptz`
- RLS: SELECT/UPDATE vain admineille, INSERT vain service-role

**`content_moderations`** (laajennus)
- Lisää `severity text` ('low'|'medium'|'high'|'critical')
- Lisää `cache_hit boolean DEFAULT false`
- Lisää `latency_ms integer` (mittaus)

**RPC `check_moderation_rate(_user uuid)`**
- Palauttaa `{ allowed: boolean, retry_after_seconds: integer }`
- Käyttää `content_moderations`-taulua: count viim. 60s → max 5

### 2. Edge function `moderate-content` -refaktori

**Uudet pyyntökentät:**
- `image_b64?: string` — base64-thumbnail (256px), ohittaa `image_url`-fetch
- `image_hash?: string` — SHA-256 cache-avaimeen

**Flow:**

```text
1. Validate JWT (käyttäjä)
2. RPC check_moderation_rate → 429 jos rate-limited
3. Jos image_hash → moderation_cache lookup
   - Hit: palauta välittömästi (latency_ms ~50ms)
4. Jos miss: AI-kutsu AbortControllerilla 8s timeoutilla
   - Käytä image_b64 jos annettu (data URL), muuten image_url
   - Pyydä myös `severity`-kenttä tool-schemaan
5. Confidence-routing:
   - action=block && confidence ≥ 0.85 → block (kova)
   - action=block && confidence < 0.85 → flag + INSERT moderation_queue
   - action=flag → flag (salli mutta merkitse)
   - action=allow → allow
6. Tallenna moderation_cache (jos uusi)
7. Tallenna content_moderations (latency_ms, cache_hit, severity)
8. Fail-CLOSED: jos AI-gateway timeout/error JA kind='proof'|'feed_post' JA imagea →
   palauta { action: 'block', reason: 'moderation_unavailable_retry' }
   (nykyinen fail-open jää tekstipohjaisille posteille)
```

**Tool-schema laajennus:** lisää `severity` (enum: low/medium/high/critical) — käytetään UI-värityksessä.

**Uudet kategoriaviestit (käyttäjälle näytettävät):**
- `nudity` → "Modesty required — keep clothes on in proofs"
- `spam`/`advertising` → "No promotional content allowed"
- `fake_screenshot`/`watermark` → "Use original photos, not screenshots"
- `ai_generated` → "Real proofs only — AI-generated content not accepted"
- `low_effort`/`off_topic` → "Try a clearer fitness/discipline-related photo"
- default → "This proof couldn't be verified. Try again with clearer content"

### 3. Client-side moduulit

**Uusi `src/lib/moderation-preflight.ts`:**
- `validateFile(file)`: koko 10KB–10MB, MIME image/*, palauttaa `{ ok, reason? }`
- `generateThumbnail(file, maxSize=256)`: canvas → JPEG base64 (quality 0.85), palauttaa `{ b64, hash }`
- `sha256Hex(blob)`: Web Crypto API
- `getFriendlyMessage(category, reason)`: kategoriakohtaiset viestit

**Uusi `src/components/ModerationGate.tsx`:**
- Modal/overlay: "Reviewing your proof..." + spinner + thumbnail preview
- 5s jälkeen: "Taking longer than usual..." + cancel-nappi (AbortController)
- Tilat: `validating` | `uploading` | `reviewed_ok` | `reviewed_blocked` | `error`
- Smooth fade-in/out (~200ms)

**Uusi `src/hooks/use-moderation.ts`:**
- `moderate({ file, kind, contentId, text })`: käyttää preflight + invoke
- Palauttaa `{ action, severity, reason, friendlyMessage, blocked }`
- Hoitaa AbortControllerin

### 4. UI-integraatiot

**`src/pages/DailyCheckin.tsx`:**
- Käännä järjestys: thumbnail → moderate → täysi upload → check-in insert
- Näytä `ModerationGate` heti kuvan valinnan jälkeen
- Jos blocked → ei uploadia ollenkaan, näytä friendly viesti + "Try another photo"
- Säästö: ~1–2s nopeampi palaute, ei turhaa storage-kirjoitusta

**`src/pages/EliteFeed.tsx`:**
- Sama pattern kuvien kanssa
- Tekstipohjaisille posteille: moderate text rinnakkain (fail-open säilyy)

**Uusi `src/pages/AdminModeration.tsx`** (route `/admin/moderation`):
- Vain admineille (käytä `has_role`-tarkistusta)
- Lista `moderation_queue` (status='pending'), uusin ensin
- Kuvan thumbnail + AI:n syy + confidence + kategoriat
- Approve / Reject -napit → UPDATE status + reviewed_by + reviewed_at
- Reject + content_id → poista posti / piilota check-in
- Real-time `supabase.channel('moderation_queue')` → uusi rivi nostaa badge-counterin

**`src/App.tsx`:** lisää `/admin/moderation` route

### 5. Tiedostot

**Uudet:**
- `src/lib/moderation-preflight.ts`
- `src/components/ModerationGate.tsx`
- `src/hooks/use-moderation.ts`
- `src/pages/AdminModeration.tsx`
- Migraatio: `moderation_cache` + `moderation_queue` + `check_moderation_rate` RPC + `content_moderations` -lisäkentät

**Muokattavat:**
- `supabase/functions/moderate-content/index.ts` (cache, rate-limit, fail-closed, severity, b64-tuki, AbortController)
- `src/pages/DailyCheckin.tsx` (preflight + ModerationGate + käännetty järjestys)
- `src/pages/EliteFeed.tsx` (sama pattern)
- `src/App.tsx` (admin route)

### 6. Mittaus & vertailu

| Mittari | Nyt | Optimoitu |
|---|---|---|
| Latency (cache hit) | 2–4s | ~50ms |
| Latency (cache miss) | 2–4s | 1–2s |
| Bandwidth (block-tapauksessa) | Koko kuva (1–10MB) | Vain thumbnail (~30KB) |
| Käyttäjäpalaute | Hiljainen | "Reviewing..." heti |
| AI-kutsun timeout | Ei rajaa | 8s + AbortController |
| AI-gateway alhaalla | Kaikki sallitaan | Block kuville, allow tekstille |
| Spam-yritys | Rajoittamaton | 5/min throttle |
| Matala confidence | Kova esto | Admin-jono |
| Toistuvat kuvat | Joka kerta AI | Cached |

### Mitä EI tehdä

- Ei vaihdeta mallia (`google/gemini-2.5-flash` on optimi)
- Ei moderoida vanhoja kuvia takautuvasti
- Ei poisteta nykyistä `image_url`-tukea (taaksepäin yhteensopiva)
- Ei lisätä toista AI-vendoria backupiksi
- Ei muuteta tekstipohjaisten postausten fail-open-logiikkaa

