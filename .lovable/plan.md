

# Korjaa status & prosentit (yksi optimoitu lähde)

## Ongelma
- Kuvassa profiili näkyy: `#3 · Ahead of 67% · High Performer · Score 0.0`. Tämä on epäjohdonmukaista koska:
  - `rank_score = 0` ei voisi olla High Performer (SQL pakottaa `recruit` jos rank_score on 0)
  - Prosentti lasketaan asiakaspuolella eri pohjalla kuin SQL:n tier-logiikka → näytetty %ile ei vastaa todellista tieriä
  - Sama kysely tehdään 2× (Index + Profile), eri queryKey → tuplakuorma

## Korjaus

### 1. Yksi jaettu hook: `useMyRank`
Uusi `src/hooks/use-my-rank.ts` joka:
- Käyttää **samaa universumia kuin SQL** (`rank_score > 0`) sekä `ahead`- että `total`-lukuihin → johdonmukainen %ile
- Palauttaa `{ rank, totalUsers, percentile, hasRank }` jossa `hasRank = rank_score > 0`
- Jos käyttäjällä `rank_score = 0` → palautetaan `rank = totalUsers + 1`, `percentile = 0`, `hasRank = false` (näytetään selkeästi "Tee ensimmäinen check-in" eikä väärää #-numeroa)
- Yksi query‑avain `["my-rank", userId]`, `staleTime: 60s`, `gcTime: 5min` → cache jaettu Indexin ja Profilen kesken (poistaa kaksi rinnakkaista verkkokutsua)
- Käytä **yhtä kyselyä yhden sijasta kahden** RPC:n kautta → uusi DB-funktio `get_user_rank(p_user_id)` palauttaa `(rank, total, percentile)` yhdessä round-tripissä

### 2. DB-funktio `get_user_rank`
SECURITY DEFINER, STABLE. Palauttaa rivin:
```text
rank        int
total_users int
percentile  numeric(5,2)
has_rank    boolean
```
Logiikka identtinen `update_all_status_tiers`:n kanssa (`rank_score > 0` universumi, `ROW_NUMBER() OVER (ORDER BY rank_score DESC)`). Käyttäjän jolla `rank_score = 0` → `has_rank = false`, `percentile = 0`.

### 3. Korjaa "haamu‑tier" -tilanne
Aja kerran migraatiossa `update_all_status_tiers()` → kaikki käyttäjät joilla `rank_score = 0` putoavat `recruit`-tasolle. Tämä siivoaa kuvan kaltaiset “High Performer @ 0.0” tilanteet.

### 4. UI-tarkennukset
- `RankPressureCard`: jos `hasRank = false` → piilotettu "Ahead of X%" rivi, korvataan "Tee ensimmäinen check‑in nostaaksesi rank scorea". Bar 0 %.
- `percentile` näytetään `Math.round` desimaalitarkkuudella ≥ 99 (esim. `99.2%` Apex‑tasoille) — muut tasot kokonaisluku.
- `Index.tsx` ja `Profile.tsx` käyttävät uutta `useMyRank()`‑hookia → poistetaan duplikoidut inline‑queryt (vähemmän koodia, 1 verkkokutsu/sivu sijaan 2).

### 5. TierLadderin "Top X%" johdonmukaiseksi
`TierLadder` näyttää tällä hetkellä `cfg.percentile` (string kuten "Top 5%"). Korjaa vaatimusrivi käyttämään `cfg.requirements.percentile` -kentästä laskettuna (Apex `Top 1%`, Legend `Top 0.1%`) niin että kaikki `Top X%` tekstit ovat synkassa SQL-kynnyksien kanssa.

## Tekniset tiedostot
- **Uusi:** `supabase/migrations/<ts>_get_user_rank.sql` — luo `get_user_rank` RPC + ajaa `SELECT update_all_status_tiers()`
- **Uusi:** `src/hooks/use-my-rank.ts`
- **Muokattu:** `src/pages/Index.tsx` — käytä `useMyRank`, poista inline `useQuery`
- **Muokattu:** `src/pages/Profile.tsx` — sama
- **Muokattu:** `src/components/RankPressureCard.tsx` — `hasRank`-tila + tarkempi prosenttinäyttö
- **Muokattu:** `src/components/TierLadder.tsx` — yhdenmukainen "Top X%" -teksti

## Suorituskyky
- Verkkokutsut/sivu: **2 → 1** (Index ja Profile)
- Cache jaettu sivujen välillä → siirtyminen Index ↔ Profile ei laukaise uutta fetchia 60 s sisällä
- Database round-trips per call: **2 → 1** (yksi RPC kahden COUNT‑kyselyn sijasta)

