

# Lighter TierLadder + Tribe Battles (tribe vs tribe)

Two erillistä työtä: (1) TierLadder kevyt siivous — vähemmän liikettä, sama rakenne. (2) Uusi "Tribe Battles" -ominaisuus jossa Apex-omistajat haastavat toisia tribejä viikon kestoisiin XP-kollektiivibattleihin.

---

## 1. TierLadder — kevyt siivous

Tavoite: nykyinen näkymä on liian raskas (pyörivä kruunu, shimmer-pyyhkäisy, conic-borderit vetävät huomion). Jätetään väri+rakenne, poistetaan jatkuvasti liikkuvat efektit.

**Poistetaan:**
- Pyörivä kruunu headerissa → staattinen Crown-ikoni gold-värillä
- `tier-shimmer-sweep` current-tier rivillä → korvataan pelkällä gold ring + staattisella gold-glow shadowilla
- `apex-conic-border` Apex/Legend-riveiltä → korvataan vahvalla staattisella gold/conic gradient-borderilla
- `apex-embers` partikkelit current-tier rivillä → pois
- Pulssaava "you are here" -piste vasemmalla → pois
- Headerin gradient-text "Your Ascension" → tavallinen foreground-väri, gold pelkästään alaotsikossa

**Säilytetään:**
- 7 rivin rakenne, värit, percentile, ikonit
- Vertikaalinen gold progress-rail (staattinen, ei animaatioita)
- Rivien progressiiviset korkeudet (52→72px) — antaa hierarkian ilman liikettä
- "Current Tier" -ribbon current-rivillä (staattinen, ei animaatiota)
- Locked-tier silhuetit + "+N" / "Next" -hint
- Detail-dialog ennallaan

Lopputulos: rauhallinen, edelleen näyttävä, mutta ei "blink-blink" vaikutelmaa.

---

## 2. Tribe Battles — uusi feature

Konsepti: yhden tribe-omistajan haaste toiselle tribe-omistajalle. Battlen ajan molempien tribejen jäsenten yhteenlaskettu **XP-tienesti** (uudet `daily_checkins.xp_earned`-rivit battlen aikana) ratkaisee voittajan. Voittaja saa "Tribe Battle Won" -merkinnän ja koko voittaja-tribe +50 XP per jäsen.

### 2.1 Skeema (uusi migraatio)

Uusi enum + taulu:

```sql
create type tribe_battle_status as enum ('pending','active','completed','declined','expired');

create table tribe_battles (
  id uuid primary key default gen_random_uuid(),
  challenger_tribe_id uuid not null references tribes(id) on delete cascade,
  opponent_tribe_id   uuid not null references tribes(id) on delete cascade,
  challenger_owner_id uuid not null,
  opponent_owner_id   uuid not null,
  status tribe_battle_status not null default 'pending',
  duration_days int not null default 7,
  started_at timestamptz,
  ended_at   timestamptz,
  challenger_score int not null default 0,
  opponent_score   int not null default 0,
  winner_tribe_id  uuid,
  created_at timestamptz not null default now(),
  check (challenger_tribe_id <> opponent_tribe_id)
);

create index on tribe_battles (challenger_tribe_id, status);
create index on tribe_battles (opponent_tribe_id, status);
```

RLS:
- SELECT: jäsen kummassakin tribessä TAI kumman tahansa tribe-owner
- INSERT/UPDATE/DELETE estetty — kaikki RPC:n kautta

### 2.2 SECURITY DEFINER -RPC:t

- `create_tribe_battle(p_challenger_tribe_id, p_opponent_tribe_id, p_duration_days)` — vaatii että auth.uid() on challenger-triben omistaja, ei toinen tribe sama, max 1 aktiivinen battle per tribe-pari, palauttaa id
- `respond_to_tribe_battle(p_battle_id, p_accept)` — vain opponent-tribe-owner, asettaa active+started_at tai declined
- `resolve_tribe_battle(p_battle_id)` — laskee `sum(xp_earned)` `daily_checkins`-taulusta jokaisen triben aktiivisille jäsenille `started_at` ja `started_at + duration_days` välillä, asettaa `winner_tribe_id`, jakaa +50 XP jokaiselle voittaja-tribe jäsenelle
- `auto_resolve_expired_tribe_battles()` — kutsutaan triggerinä kun joku katsoo battlea ja se on päättynyt

### 2.3 UI — uusi sivu `/tribes/:id/battles`

- Otsikko: "Tribe Battles" + tribe-nimi
- Tabs: "Active" / "Pending" / "History"
- Aktiiviset battle-kortit: vastapuoli, kesto, current scoreboard (challenger XP vs opponent XP, progress bar), aikaa jäljellä
- Pending: jos olet opponent-owner → "Accept / Decline" -napit
- History: voittaja, lopullinen score
- "Challenge another tribe" -nappi (vain owner) → modal jossa hae tribe nimellä, valitse 3/7/14 päivän kesto

### 2.4 Pääsy / linkit

- `TribeDetail.tsx`: lisätään hero-osioon "⚔️ Tribe Battles" -nappi joka navigoi `/tribes/:id/battles`
- `Tribes.tsx`: lisätään pieni "Active Battles" -indicator omien tribejen korteille jos aktiivinen battle on käynnissä
- BottomNav: ei lisätä erillistä tabia (kuuluu Tribes-osion alle)

### 2.5 Eligibility

Vain triben **owner** voi luoda haasteen tai hyväksyä sen. Min. 2 aktiivista jäsentä molemmissa tribesseissä (estetään tyhjä-vs-tyhjä). Max 1 aktiivinen battle per tribe-pari kerrallaan.

---

## 3. Muutettavat tiedostot

**TierLadder cleanup:**
- `src/components/TierLadder.tsx` — poistetaan animaatiot listan mukaan
- `src/index.css` — voidaan jättää utility-luokat sisään (eivät käytössä = harmittomia)

**Tribe Battles (uusi):**
- Uusi DB-migraatio: enum + `tribe_battles` taulu + 4 RPC + RLS
- `src/pages/TribeBattles.tsx` — uusi sivu (Active/Pending/History tabit, challenge-modal)
- `src/components/TribeBattleCard.tsx` — yksittäisen battlen kortti (scoreboard, progress)
- `src/components/TribeChallengeModal.tsx` — haastemodal (hae tribe, valitse kesto)
- `src/App.tsx` — uusi reitti `/tribes/:id/battles`
- `src/pages/TribeDetail.tsx` — "Tribe Battles" -nappi hero-osioon
- `src/pages/Tribes.tsx` — pieni "active battle" -indikaattori My Tribes -korteille
- `.lovable/memory/features/tribes.md` — päivitys uudella feature-osiolla

### Ei muuteta
- `battles`-taulu (1v1) — pysyy ennallaan
- ApexBadge, profiilin tier-järjestelmä, status-tier-laskenta
- Tribe-create / invite / membership -RPC:t

