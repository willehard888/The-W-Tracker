

# Apex Tribes — Next Level + Invites + Unique Names

Nostetaan Apex Tribes seuraavalle tasolle: estetään duplikaattinimet tietokannassa, lisätään kutsujärjestelmä jolla tribejä voi kasvattaa kohdennetusti, ja kiillotetaan UI vielä järeämmäksi/eksklusiivisemmaksi.

---

## 1. Triben nimi lukitaan uniikiksi (DB)

Tällä hetkellä `tribes.name` ei ole unique → kaksi käyttäjää voi luoda saman nimisen triben. Korjataan migraatiolla:

- Lisätään **case-insensitive unique index** nimeen: `CREATE UNIQUE INDEX tribes_name_unique ON tribes (lower(name));`
- Päivitetään `create_tribe`-RPC:
  - Tarkistaa ennen insertointia onko nimi (case-insensitive) jo varattu → palauttaa selkeän virheen `Tribe name already taken — try another`
  - Ehkäisee race condition -tilanteet (unique index hoitaa lopullisen takeen)
- Slug pysyy uniikkina nykyisellä `+random suffix`-logiikalla (ei muutosta)

**TribeNew.tsx** — lisätään realtime nimitarkistus:
- Käyttäjä kirjoittaa nimeä → 400ms debounce → kysely `tribes`-tauluun
- UI näyttää joko ✓ "Available" tai ✗ "Already taken" -indikaattorin
- Create-nappi disabloituu jos nimi varattu

---

## 2. Kutsujärjestelmä (Invites)

Mahdollistetaan jäsenten kasvattaminen kohdennetusti — etenkin private-tribejen kohdalla välttämätön.

### Tietokanta — uusi taulu `tribe_invites`
```text
- id uuid pk
- tribe_id uuid (FK tribes)
- inviter_id uuid (FK profiles)
- invitee_id uuid (FK profiles)
- status text ('pending' | 'accepted' | 'declined' | 'revoked')
- created_at, responded_at
- UNIQUE(tribe_id, invitee_id) WHERE status='pending'
```

### Uudet SECURITY DEFINER RPC:t
- `invite_to_tribe(p_tribe_id, p_invitee_id)` — vain jäsen voi kutsua, max 50 pendingiä per tribe, ei voi kutsua omaa itseään tai jo jäsentä
- `respond_to_tribe_invite(p_invite_id, p_accept boolean)` — vain invitee voi vastata; accept → lisää `tribe_members` (active) ja kasvattaa `member_count`
- `revoke_tribe_invite(p_invite_id)` — vain inviter tai owner voi peruuttaa

### RLS
- `SELECT` näkyy invitee:lle (omat saadut) ja inviter/owner:lle (omat lähetetyt)
- `INSERT/UPDATE/DELETE` blokattu suoraan → kaikki kulkee RPC:n läpi

### UI
**TribeDetail.tsx** — jäsenille uusi "Invite" -nappi headerin alle
- Avaa `<TribeInviteModal>`-dialogin
- Modaalissa hakukenttä → username-haku `profiles`-taulusta (kuten messages-haku)
- Listaa tulokset, klikkaus lähettää kutsun → toast "Invite sent to @username"
- Estää nykyiset jäsenet ja jo kutsutut (näyttää "Already invited" / "Member")

**Profile / Notifications** — saapuneet kutsut
- Lisätään uusi widget profiilin yläosaan: "🔥 Tribe Invites (n)" jos pending-kutsuja
- Klikkaus → `/tribe-invites` -sivu jossa lista: tribe-kortti + Accept/Decline -napit
- Vaihtoehtoisesti yksinkertaisempi: lisätään suoraan `Tribes`-sivulle uusi sektio "Invites" tabin "My Tribes" yläpuolelle

---

## 3. Apex Tribes — visuaalinen seuraava taso

### Tribes-listasivu (Tribes.tsx)
- **Animoitu conic-border hero**: lisätään `apex-conic-border`-luokka heron ulkokehälle → hidas pyörivä gold/flame-gradient
- **Featured Tribe -kortti**: jos käyttäjä ei ole minkään triben jäsen, top-1 popular tribe nostetaan isona "Featured" -korttina (3D-tilt-hover, bigger crown, member-avatar -stack)
- **Member avatar stack**: jokaiseen tribe-korttiin näytetään 3-5 jäsenen avatarit overlapping (haetaan `tribe_members` join `profiles`)
- **Owner-merkki**: jos olet itse owner → kortissa pieni "👑 You own this" -lippu kulmassa
- **Skeleton loading** spinnerin sijaan — paremmat shimmer-cardit

### Tribe-detailsivu (TribeDetail.tsx)
- **Parallax hero**: scroll-effect joka liikuttaa hero-gradienttia (`useScroll` framer-motion)
- **Members-rivi headerin alle**: horisontaalinen scrollable lista jäsenten avatareista (klikattava → user profile)
- **Invite-nappi**: gold-border ghost button "Invite Members" headerin alapuolella (vain jäsenille)
- **Post-kortit**: lisätään poster-avatar + username + tier-badge (apex/legend) ja "Like"-nappi (käyttäen jo olevaa `tribe_post_reactions`)
- **Empty state**: kun ei posteja, näytetään cinematic "Be the first to ignite this tribe" -kortti gold-glowilla

### Uusia CSS-efektejä (`index.css`)
- `.apex-portal-glow` — pulssaava radial inner-shadow heron sisään
- `.apex-tribe-card-hover` — hover lift + glow combo standardisoituna
- `.apex-divider` — ohut horizontal gradient-viiva sektioiden välillä

---

## 4. Memory & dokumentaatio

- Päivitetään `mem://features/tribes`:
  - Mainitaan unique name -constraint
  - Lisätään invites-flow ja `tribe_invites`-taulu + 3 uutta RPC:tä
  - Päivitetään UI-osio Featured Tribe + invite-modaalilla

---

## Tekniset yksityiskohdat

### Migraatio
```sql
CREATE UNIQUE INDEX tribes_name_unique ON public.tribes (lower(name));

CREATE TABLE public.tribe_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tribe_id uuid NOT NULL,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE UNIQUE INDEX tribe_invites_pending_unique
  ON public.tribe_invites (tribe_id, invitee_id)
  WHERE status = 'pending';
ALTER TABLE public.tribe_invites ENABLE ROW LEVEL SECURITY;
-- RLS: SELECT visible to inviter, invitee, owner; mutations blocked → RPC only
```

### Edited / created files
- `src/pages/TribeNew.tsx` — debounced name availability check, visible feedback
- `src/pages/Tribes.tsx` — Featured Tribe card, member-avatar stacks, invites section
- `src/pages/TribeDetail.tsx` — parallax hero, members row, invite button, like-button on posts
- **NEW** `src/components/TribeInviteModal.tsx` — username search + invite send
- **NEW** `src/pages/TribeInvites.tsx` (tai inline Tribes.tsx:ään) — accept/decline saapuneet
- `src/pages/Profile.tsx` — pending invites -widget (jos kutsuja)
- `src/index.css` — uudet apex-portal/divider/tribe-card-hover -luokat
- `.lovable/memory/features/tribes.md` — päivitys

### Ei muuteta
- Status-tier -logiikka, RevenueCat / Stripe -hinnoittelu, Auth-virtaukset
- `create_tribe` 3-tribe-limit tai 3-40 char nimirajoitus pysyy
- Olemassaolevia tribejä joiden nimi sattuu olemaan duplikaatti EI poisteta — migraatio yrittää indexin luontia, jos törmää duplikaatteihin: lisätään `_<6char>` -suffix vanhempaan duplikaattiin automaattisesti ennen index-luontia

