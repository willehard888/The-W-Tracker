

# Premium Button System

Tee koko apin napeista oikeasti hienot — fysikaaliset, painavat, ja yhtenäiset Obsidian & Gold -teemaan. Ei animaatiomuutoksia olemassa oleviin, vain itse napin materiaali ja uudet variantit.

## 1. `src/components/ui/button.tsx` — variantit uusiksi

Pidetään API identtisenä (`variant`, `size`, `asChild`, haptics) — vain tyylit vaihtuvat.

**Muokattavat variantit:**

- **`default`** (ensisijainen tumma): musta-obsidian gradientti `hsl(258 16% 14%) → hsl(258 18% 8%)`, 1px ylä-highlight `white/12%`, 1px ala-shadow `black/40%`, ulkoinen `0 1px 1px black/35%, 0 6px 14px -4px black/45%`. Painettuna: gradientti kääntyy + highlight pois → aito "painautuva" tunne.

- **`gold`** (hero CTA): kolmen stopin metallinen gradientti `hsl(42 95% 72%) → hsl(42 85% 56%) → hsl(42 65% 38%)` + 0.5px ylä-spec-viiva `white/55%` + ala-bevel `black/50%`. Ulkoinen lämmin glow `0 8px 20px -6px hsl(42 78% 50% / 0.45)`. Painettuna spec-viiva siirtyy 1px alas, gradientti tummenee 8%.

- **`destructive`**: sama rakenne kuin `default` mutta punainen ramppi (`0 70% 32% → 0 75% 22%`), spec `red/30%`.

- **`outline`** (sekundääri): `surface-panel` pohja, hairline border (`border/70%`), hover nostaa hairline `border-strong`-väriin + lisää 1px sisäinen ylähighlight.

- **`secondary`**: matalampi `surface-panel` ilman bordereita, hover lift +1px shadow-kasvulla.

- **`ghost`**: läpinäkyvä lepotilassa, hoverissa `white/4%` + 1px hairline alle (oikea "underline-on-hover" optisesti tasapainoitettu).

- **`link`**: gold-soft → gold transition tekstillä, ei layout-muutosta.

- **`gold-outline`**: hairline gold-soft, sisäpuolella `gold/4%` lasi, hoverissa täyttyy `gold/12%`.

**Uudet variantit:**

- **`glass`**: `surface-glass` lasipohja + light-rake — käytetään esim. modaaleissa ja ylätason action-baareissa.
- **`tier`**: ottaa nykyisen rank-värin CSS-muuttujasta (`--tier-color`) ja rakentaa siitä saman metallisen reseptin kuin gold — käytetään mm. tier-crest CTA:issa.

## 2. Koko-skaalaus (jättäämme aktiiviset animaatiot)

- `default` 40px, `sm` 36px, `lg` 48px, `xl` 56px, `icon` 40×40 — nykyinen.
- Lisätään `icon-sm` 32×32 ja `icon-lg` 48×48 pienille toolbar-napeille (Messages compose, Coach send) ja isoille FAB-tyyppisille napeille.
- Border-radius standardoitu: `default → rounded-md (8px)`, `lg/xl → rounded-lg (12px)`, `icon* → rounded-full` jos käyttötapaus on action-piste, muuten `rounded-md`.
- Sisäinen padding pysyy ennallaan; muutokset vain visuaalisia.

## 3. Tyypografia napissa

- Kaikki napit `font-semibold` (600) — nykyinen `font-semibold` säilyy. `gold` ja `tier`: `font-bold` (700) `tracking-[-0.005em]`.
- Iso `xl` koko: kasvatetaan letter-spacing `-0.01em` jotta isot CTA:t lukeutuvat kiinteinä lohkoina, eivät hajoa.
- Ikoni-teksti gap nostetaan `gap-2 → gap-2.5` jotta gold-CTA:t hengittävät.

## 4. Painautumisen ja fokuksen viimeistely

- Active-state (jo `scale-[0.985]`): lisätään samanaikainen `shadow`-vaihto kevyempään `0 1px 1px black/30%, inset 0 1px 2px black/35%` jotta nappi näyttää aidosti painuvan pintaan. Ei uusia animaatioita — pelkkä saman duraation transition lisätään `box-shadow` -listaan (jo mukana).
- Focus-ring: nykyinen `ring-2 ring-ring ring-offset-2` säilyy, mutta `ring-offset-color` siirtyy `--background`iin niin että ringi ei "kellu" outoon väriin lasimuuttuvalla taustalla. Lisätään `focus-visible:shadow-[0_0_0_4px_hsl(var(--ring)/0.18)]` pehmentäen ringin reunaa.
- Disabled: `opacity-50` lisäksi `saturate-[0.6]` — disabled gold ei enää huuda kullalta.

## 5. Hold-state (uusi, valinnainen prop)

Lisätään `loading?: boolean` -prop. Kun `true`:
- nappi disabloituu, sisältö korvautuu `Loader2` + nykyinen `children` `opacity-0`-kerroksena säilyttäen napin leveyden (ei layoutin hyppimistä)
- ei spinner-pop-in-animaatiota — loader rendataan nykyisellä `animate-spin`-keyframellä, joka on jo globaali

Sama kuvio kuin `PaywallTierCard` jo käyttää — vakioidaan napille itselleen jotta ei tarvitse tehdä erikseen joka sivulla.

## 6. Kosketusalue ja iOS-tunne

- Minimum tap target: lisätään `[&>*]:pointer-events-none` ja `min-h` napin koon mukaan jotta active-tila ei katoa ikonin/tekstin sisällä klikatessa (nykyinen ongelma `gap-2 [&_svg]`-kohdissa).
- Säilytetään olemassa oleva `hapticImpact("light")`-kutsu — ei muutoksia.

## 7. Mitä EI muuteta

- Ei uusia framer-motion-animaatioita, ei uusia keyframeja, ei uutta CSS-shimmeria.
- Ei muutoksia `BottomNav`-, `StatusHeader`- tai paywall-erikoisnappeihin (niillä on omat tarkoitukselliset efektit).
- Ei muutoksia `Button`in propseihin tai callsiteihin — kaikki nykyiset käyttöpaikat saavat uudet tyylit automaattisesti.

## Tiedostot

- `src/components/ui/button.tsx` — variantit, koot, `loading`, focus-shadow

Koska kaikki napit appin läpi käyttävät tätä yhtä komponenttia (Profile, Auth, Coach, Tribes, Messages, Battles, Paywall, dialogit), koko apin napit nousevat samalla tasolle ilman page-tason editointia.

