

# Premium Fire+Gold -teema kaikissa napeissa

Levitetään tribe-fire-identiteetti (ember + coal + gold) sovelluksen yleiskäytön nappeihin niin, että jokainen `<Button>` näyttää teemalta — ilman että yliräjäytetään (ei joka nappi loimua). Hierarkia on selkeä, premium ja yhtenäinen.

## Visuaalinen hierarkia (uusi standardi)

| Tarkoitus | Variantti | Tuntuma |
|---|---|---|
| Korkein intensiteetti — Tribe / Fire / "ignite" actions | `ember` | Sulava molten metalli + halo-pulse |
| Identiteetti / status / "earn" actions (Login, Save, Accept) | `coal` | Hehkuva hiili kultakruunulla |
| Saavutus / status display CTA (Pro, Champion) | `gold` | Klassinen kiillotettu kulta |
| **UUSI: Yleinen sekundääri (Cancel, Compare, Message)** | `gold-soft` | Lasinen tumma paneeli + lämmin kultareuna + sisäinen kultainen hiussäteily |
| **UUSI: Yleinen outline (Decline, View, Filter)** | `ember-glass` | Lasi + ember-hairline + hover-kuumuus |
| Vaaralliset (Reject, Delete) | `destructive` / `danger-outline` | Punametalli (ei muutosta) |
| Linkit / minimalistinen | `ghost` | Päivitetään saamaan **lämmin kulta-tint** hoverissa |

`secondary` ja `outline` säilyvät taaksepäin yhteensopivina, mutta niiden visuaali päivitetään: ne saavat **lämpimän alasävyn** (kulta-soft tint + hot highlight), niin että jopa vanhat `variant="secondary"`-napit (joita on 175 paikassa) muuttuvat automaattisesti teemaan sopiviksi ilman koodimuutoksia call-site-kohtaisesti.

## Toteutus

### `src/components/ui/button.tsx`

**1. Päivitä `secondary` → premium kultalasi**
- Tumma obsidian-pohja säilyy luettavuuden vuoksi
- Lisää: hiussäteily ylhäältä (kulta), pohjavarjostuksen sisäinen kultainen hehku, hover-tilassa lämmin kultareuna ja `box-shadow` jolla kultainen halo nousee
- Teksti muuttuu hoverissa `hsl(var(--gold-light))`

**2. Päivitä `outline` → premium ember-lasi**
- Korvaa harmaa `border-image` lämpimällä gradient-bordilla (kulta-soft → ember-soft)
- Pohja: `linear-gradient` jossa hyvin kevyt kulta-tint (4–6% alpha)
- Hover: ember-hairline + diagonaalinen heat shimmer (`::after` translate3d, sama kuin `ember`)

**3. Päivitä `ghost` → lämmin lift**
- Hover-bg → `hsl(var(--gold) / 0.06)` harmaan sijaan
- Hover-text → `hsl(var(--gold-light))`
- Sisäinen alareuna saa kultainen hairline

**4. Lisää uudet eksplisiittiset variantit**
- `gold-soft`: identinen päivitetyn `secondary`:n kanssa, mutta voimakkaampi kultainen kruunu — call-sitet voivat valita tämän kun haluavat selkeämmän kullan
- `ember-glass`: identinen päivitetyn `outline`:n kanssa mutta vahvemmilla ember-vivahteilla — Tribe-kontekstin sekundäärit voivat valita tämän
- `gold-icon`: ikoninapeille (`size="icon-sm"`/`icon-lg`) jotta back/close/clear-napit nykyisessä `ghost`-tilassa saavat kullatun loimun hoverissa

### `src/index.css`

- Lisää `@keyframes button-warm-rim-breathe` (4s, hyvin kevyt kultainen reunan opasiteetin sykintä) — käytetään `secondary`/`gold-soft` napeissa harvinaisena luksuselementtinä (vain kun nappi on `:focus-visible`-tilassa, ei jatkuva suorituskykyä rasittava efekti)
- Lisää `prefers-reduced-motion` -guard kaikille uusille animaatioille

### Globaali vaikutus (zero-touch)

Koska 175 nykyistä `variant="secondary"`-käyttöä ja kymmenet `variant="outline"`-napit perivät uudet visuaalit automaattisesti, koko sovellus muuttuu teemaan sopivaksi yhdellä commitilla:
- `Battles.tsx`: Cancel/Decline-napit
- `UserProfile.tsx`: Add Friend / Pending / Message / Compare
- `Coach.tsx`: Suggested-promptit + back-nappi
- `AdminModeration.tsx`: Approve-nappi
- `TribePendingRequestsDialog.tsx`: hyväksy/hylkää-napit
- Kaikki dialog-footerit (Cancel-napit) sovelluksessa
- `BottomNav` `ghost`-napit saavat kultaisen hoverin

### Kohdennetut päivitykset

| Tiedosto | Muutos |
|---|---|
| `src/components/ui/sidebar.tsx` | `ghost` perii uuden lämpimän hoverin — ei koodimuutosta |
| `src/pages/UserProfile.tsx` r. 477–480 | Vaihda `Message`/`Compare` → `variant="gold-soft"` |
| `src/pages/Coach.tsx` r. 202–206 | Suggested-promptit `outline` → `ember-glass` (Coach on Elite/AI-fire-konteksti) |
| `src/components/TribeBattleCard.tsx` r. 230–234 | Decline `outline` → `ember-glass` |
| `src/pages/Battles.tsx` r. 461, 505 | Cancel/Decline säilyvät `secondary`:nä — perivät uuden lookin |

## Mitä EI muuteta

- `ember`, `coal`, `gold`, `tier`, `success`, `warning`, `destructive`, `link`, `glass`, `obsidian` — säilyvät täsmälleen samoina
- Mitään olemassa olevaa nappia ei poisteta tai uudelleennimetä — kaikki nykyinen koodi toimii
- `BottomNav`-kuvakkeet säilyvät selkeästi luettavina (vain hover saa kultaisen lämmön)
- DB / RPC / auth — ei muutoksia

## Lopputulos

Koko sovellus näyttää **kulta- ja tulipaletilta** — jopa Cancel-napit ja sivupalkit hehkuvat hienovaraisesti lämpöä. Ember- ja coal-napit pysyvät korkeimpana intensiteettitasona, ja muu UI tukee niitä premium-tavalla harmaan paneelin sijaan. Hierarkia on edelleen selvä: silmäsi tietää aina mihin painaa.

