

# Tribe Leaderboard + private tribe -haku & liittymispyynnöt

Kaksi uutta ominaisuutta: (1) globaali Tribe Leaderboard joka ranking tribejä viikoittaisen kollektiivisen XP-tienestin perusteella, (2) haku joka löytää myös private-tribet ja antaa lähettää liittymispyynnön.

---

## 1. Tribe Leaderboard

**Sijainti:** Uusi reitti `/tribes/leaderboard` + "Tribe Leaderboard" -kortti `Tribes.tsx`-sivulla (Browse-tabin yläosassa, ennen Featured-tribea).

**Ranking-logiikka:**
- Tribejen sijoitus määräytyy **viikon (7 viime päivän) yhteenlasketun XP:n** perusteella, joka lasketaan `daily_checkins.xp_earned`-summana kaikkien aktiivisten tribe-jäsenten kesken.
- All-time-tabi laskee tribe-jäsenten profiles.xp summan (perinteisempi mittari).
- Vain `visibility = 'public'` tribet listataan oletuksena, mutta käyttäjän omat tribet näkyvät aina (myös private).

**UI:**
- Kaksi tabia: **Weekly XP** (oletus) / **All-Time XP**
- Top 3: erityinen kortti gold/silver/bronze-väreillä (Crown/Medal/Award-ikonit)
- Sija 4–50: kompakti rivi (sija, tribe-nimi, member_count, XP-summa)
- Käyttäjän oman triben sijoitus aina näkyvissä alareunan "Sticky My Tribe" -kortissa
- Klikkaus → navigoi `/tribes/:id`

**Backend:**
- Uusi SECURITY DEFINER -RPC `get_tribe_leaderboard(p_period text, p_limit int)` jossa `p_period IN ('weekly','all_time')` — palauttaa `tribe_id, name, member_count, score, rank` järjestyksessä. RLS-bypass toimii koska RPC suodattaa itse public-tribet + viewerin omat.

---

## 2. Private tribe -haku & liittymispyynnöt

Ongelma nyt: `tribes` RLS-policy `Public tribes viewable by all authed` näyttää vain `visibility = 'public'`, omat jäsenyydet TAI omistuksen → private-tribet eivät löydy haulla.

**Ratkaisu:**

### 2.1 Uusi SECURITY DEFINER -RPC `search_tribes(p_query text, p_limit int)`

Palauttaa sekä public että private tribet hakusanaa vastaten, mukaan lukien turvalliset kentät:
```
id, name, slug, description, member_count, visibility, owner_id,
viewer_status text  -- 'member' | 'pending_join' | 'pending_invite' | 'none'
```
Suodattaa pois hakutuloksista vain bannatut/poistetut. Private tribejen `description` näkyy myös, jotta ihminen voi päättää haluaako liittyä.

### 2.2 `join_tribe` jo tukee pending-statusta — UI:n päivitys

Nykyinen `join_tribe` RPC palauttaa jo `'pending'` private-tribeille (rivi 178–187 in `Tribes.tsx`). Tarvitsee vain UI-tuen:
- Hakutuloksissa private-tribet saavat `Lock`-ikonin ja "Request to join" -napin
- Painike vaihtaa "Request sent" -tilaan kun status palautuu `pending`

### 2.3 Owner-puoli: hyväksy/hylkää liittymispyynnöt

`approve_tribe_member` RPC on jo olemassa. Lisätään UI:
- `TribeDetail.tsx`-hero-osioon: jos olet owner ja on `pending` jäseniä → näytä pieni badge "X pending requests" + linkki uuteen "Pending Requests" -dialogiin.
- Dialogi listaa pending-jäsenet (username + avatar) ja **Accept / Decline** -napit per rivi.

### 2.4 Hakukenttä Tribes-sivulle

- Browse-tabin yläosaan tulee `Search`-input "Search all tribes (public & private)"
- Debounced 300ms, kutsuu `search_tribes`-RPC:tä
- Hakutuloksilla on oma renderöinti (nykyiset Featured + lista pysyvät kun haku on tyhjä)
- Action-nappi tulosta klikatessa:
  - `viewer_status = 'member'` → "Open" (navigoi `/tribes/:id`)
  - `viewer_status = 'pending_join'` → "Request sent" (disabloitu)
  - `viewer_status = 'pending_invite'` → "Accept invite" (avaa Invites-osio)
  - `viewer_status = 'none'` + public → "Join"
  - `viewer_status = 'none'` + private → "Request to join" + `Lock`-ikoni
- Public tribelle klikkaus avaa `/tribes/:id` suoraan; private tribelle vain perustiedot näkyvät hakutuloksessa (ei pääsyä detail-sivulle ennen hyväksyntää — `Public tribes viewable by all authed` policy estää sen ilman jäsenyyttä).

---

## 3. Muutettavat / luotavat tiedostot

**Backend (uusi migraatio):**
- `get_tribe_leaderboard(p_period, p_limit)` SECURITY DEFINER
- `search_tribes(p_query, p_limit)` SECURITY DEFINER (palauttaa myös private tribet + viewer_status)

**Frontend:**
- `src/pages/TribeLeaderboard.tsx` (uusi) — Weekly/All-Time tabit, top 3 -kortit, lista, sticky my-tribe
- `src/components/TribeSearchBar.tsx` (uusi) — debounced haku + tulokset, käyttää `search_tribes`
- `src/components/TribePendingRequestsDialog.tsx` (uusi) — owner näkee pending-jäsenet ja hyväksyy/hylkää
- `src/pages/Tribes.tsx` — lisää TribeSearchBar ja "View Tribe Leaderboard" -kortti Browse-tabin yläosaan
- `src/pages/TribeDetail.tsx` — lisää "Pending Requests" -painike owner-näkymään (badge + dialog-trigger)
- `src/App.tsx` — uusi reitti `/tribes/leaderboard`
- `.lovable/memory/features/tribes.md` — päivitys (leaderboard + private-haku + pending-flow)

### Ei muuteta
- `tribes` RLS-policy (search hoituu RPC:llä joka ohittaa RLS:n turvallisesti)
- `join_tribe` / `approve_tribe_member` RPC:t (toiminnallisuus jo olemassa, vain UI muuttuu)
- Tribe Battles, member-rakenne, posts

