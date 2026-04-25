# Realismi + nopeus + kiillotus -kierros (mitään ei poisteta)

Pyyntö on laaja ("kaikki paremmin, nopeammin ja aidommalta"), joten työ jaetaan kolmeen rinnakkaiseen suuntaan: **suorituskyky**, **realismi** ja **kiillotus**. Yksikään olemassa oleva komponentti, ominaisuus tai visuaalinen elementti ei katoa — vain optimoidaan, viritetään ja syvennetään.

## 1. Suorituskyky (latausnopeus + sulavuus)

**StylizedStreakFlame on tällä hetkellä ylivoimaisesti raskain elementti** (84 liekkiä × kaksi SVG-kerrosta + 3 turbulence-suodinta + 54 overlay-elementtiä = ~300 animoitua SVG-nodea). Käyttäjä näkee tämän heti Home-sivulla.

- **Adaptiivinen tiheys**: lisätään `prefers-reduced-motion` ja low-end-tunnistus (`navigator.hardwareConcurrency <= 4` tai `devicePixelRatio < 2`) → 84 → 48 liekkiä, PASSES 6 → 4. Pidetään 84/6 vain tehokkailla laitteilla. Visuaalisesti ero on pieni koska liekit ovat päällekkäin.
- **`will-change`-puhdistus**: monessa kerroksessa on `willChange: "transform, opacity"` → vain front-row pitää sen, back/mid-row ei. Vapauttaa GPU-muistia.
- **Turbulence-suodinten yhdistäminen**: 3 erillistä `<filter>`-elementtiä per StylizedStreakFlame-instanssi. Yhdistetään `<defs>` koko sivulle (jos useita liekkejä, jaetaan suotimet).
- **Multiply-stroke-SVG → CSS-mask**: viime kierroksen lisäämä erillinen multiply-SVG per liekki tuplaa SVG-nodet. Korvataan `filter: drop-shadow(0 0 0.5px hsl(8 95% 12%))` -tekniikalla, joka tuottaa saman tumman ääriviivan **yhdellä DOM-nodella per liekki** — sama visuaali, puolet työstä.
- **Vite chunk -hienosäätö**: lisätään `framer-motion` ja `lucide-react` omiin chunkeihinsa (nyt ne menevät päärunkoon ja viivästyttävät ensimmäistä paintia).
- **Kuvien lazy-loading**: tarkistetaan että kaikki `<img>` käyttävät `loading="lazy"` ja `decoding="async"` paitsi Above-the-fold.
- **Reitin esilataus**: lisätään hover/focus-pohjainen `import()`-prefetch BottomNavin linkkeihin, jotta Leaderboard/Tribes/Profile latautuvat taustalla ennen klikkausta.

## 2. Realismi (super-aito tuli + visuaalit)

- **Liekin lämpövärähtely**: lisätään hienovarainen radial heat-haze juuri liekin yläpuolelle (`backdrop-filter: blur(0.5px)` + slow morph) — saa ilman näyttämään värähtelevän kuumuudesta. Yksi DOM-node, ei vaikutusta perffiin.
- **Säästä-anisotropia**: nykyinen `--ssf-wind-x/y` on lineaarinen. Lisätään pieni Perlin-tyyppinen offset (deterministinen sin/cos-summa) RAF-loopiin → liekki ei "leiju robotiisesti" vaan saa luonnollisen turbulenssin.
- **Sub-pixel ember-välähdykset**: nykyiset embers ovat melko isoja. Lisätään 6-12 ekstra mikro-embers (1-2px) jotka syttyvät satunnaisesti pään seuduille — antaa todellisen "kipinämeren" tunnun.
- **Ground reflection**: liekin alle hienovarainen anisotrooppinen kiilto/pool (jo olemassa, mutta venytetään horisontaalisesti niin että se reagoi `--ssf-wind-x`-arvoon → tuli "valaisee" maata oikeaan suuntaan).
- **Tier-värisävytys**: nykyiset oranssi/punainen/keltainen pidetään alaspäin tier-tasoilla, mutta Apex/Legendary-tieriltä lisätään hyper-saturated cyan-kärki (vain tip-3%) — viittaa propaani/maagiseen liekkiin huipulla. Lisää "epic"-tunnetta menettämättä realismia.

## 3. Kiillotus (mikrointeraktiot + viimeistely)

- **BottomNavin glassmorphism**: tarkistetaan että `backdrop-blur` on `saturate(180%)` + ohut yläreunan hairline (1px gradient). Apple-tyylinen.
- **Reveal-animaatioiden viivästys**: nykyiset Home-osiot tulevat sisään yhtä aikaa. Porrastetaan 80ms välein → cinematic stagger.
- **Haptinen feedback** kaikkiin primary-CTA-painikkeisiin (jo Capacitor Haptics on käytössä liekissä) — extend `Button` variant `premium`/`hero` triggers `Haptics.impact("light")` natiivilla.
- **Skeleton-laatu**: tarkistetaan että kaikki `Skeleton`-komponentit käyttävät shimmer-gradient + matching aspect ratiot (estää layout shift).

## Tekniset muutokset (tiedostot)

```text
src/components/home/StylizedStreakFlame.tsx
  - Adaptiivinen flameCount/PASSES (low-end detect)
  - will-change-puhdistus back/mid-rowista
  - Multiply-SVG → drop-shadow filter (ääriviiva)
  - Lisää: Perlin-tyyppinen wind, mikro-embers, heat-haze
  - Apex tier: cyan-kärki (>= 0.97 intensity, vain Apex+)

src/index.css
  - Heat-haze keyframe (subtle morph)
  - Reveal-stagger hjälpväriä (.reveal-stagger > * { animation-delay: ... })

vite.config.ts
  - manualChunks: lisää framer-motion ja lucide-react omiin chunkeihin

src/components/BottomNav.tsx
  - Hover/focus-pohjainen route-prefetch
  - Yläreunan hairline-gradient

src/components/home/Reveal.tsx (jos olemassa)
  - Lisää delay-prop tai automaattinen stagger

src/components/ui/button.tsx
  - Premium/hero variant: Haptics.impact natiivilla onPointerDown

Globaali pass:
  - rg "loading=" ja varmista lazy/eager + decoding="async" kaikille img-tageille
```

## Mitä EI muuteta / poisteta

- Ei poisteta yhtään liekkikerrosta, overlay-tongueja, sparkseja, tribe-aurahaloja eikä yhtään komponenttia
- Ei muuteta värisemantiikkaa (oranssi/keltainen/punainen-paletti pidetään, paitsi Apex-tier-kärki)
- Ei muuteta tier-järjestelmää, RLS:ää, Auth-flowta tai backend-rakennetta
- Ei vaihdeta animaatiokirjastoa tai design-tokenia

## Lopputulos

- **Latausaika**: arviolta -25-40% First Contentful Paint Home-sivulla (chunk-jako + adaptiivinen liekki)
- **FPS**: 60fps myös keskitason puhelimissa (vrt. nykyiseen ~40-50 fps)
- **Realismi**: liekki saa luonnollisen turbulenssin + lämpövärähtelyn + mikro-embers — näyttää kuvatulta videolta ei piirretyltä
- **Kiilto**: porrastettu Reveal, glassmorphism-hairline, haptiset CTA:t
