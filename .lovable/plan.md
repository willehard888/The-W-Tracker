

# Liekki → Next Level

Nostetaan `RealisticFlame` cinematic-tasolta **simuloidun fysiikan tasolle**: liekki reagoi ympäristöönsä, valaisee oikeasti ympäristöä, hengittää, ja sen ydin elää kuin oikea palokaasu. Lisätään myös aitoja interaktioita (kosketus → liekki taipuu) ja parallax-syvyys.

## Periaate

| Taso | Mitä lisätään |
|---|---|
| **Visuaalinen syvyys** | Volumetric light cone projisoituu ALAS liekistä → valaisee taustan ympärillä, ei vain liekkiä itseään |
| **Fysiikka** | Liekki taipuu osoittimen/kosketuksen suuntaan (lähellä) — paikallinen wind-kenttä |
| **Hiukkaset** | Aidot rising embers + falling ashes (Diamond+) jotka noudattavat wind-vektoria |
| **Hengitys** | Slow inhale/exhale -sykli muuttaa liekin korkeutta + intensiteettiä (5–7s) |
| **Ympäristön reaktio** | Apex/Legend/Inferno saa hetkellisen "shockwave"-ympyrän kun käyttäjä saavuttaa virstanpylvään |
| **Sisäinen rakenne** | Heat-haze SVG-displacement liekin TAUSTALLE → tausta vääristyy oikeasti liekin ympärillä |

## Toteutus

### 1. `src/lib/wind.ts` — laajennus paikalliselle pointer-windille

Lisätään uusi globaali CSS-var `--pointer-wind-x` jonka updateaa lightweight pointermove-listener (throttled 30fps). Liekit jotka ovat lähellä osoitinta (`hover` tai `data-flame-interactive` sisällä) lisäävät tämän omaan windTransformiinsa. Default 0 → ei vaikutusta.

- `attachPointerWind()` — käynnistetään `WindProvider`issa
- Vaikutus on radius-rajoitettu CSS:llä (vain :hover-puussa)

### 2. `src/components/home/RealisticFlame.tsx` — uudet kerrokset

Lisätään `EIGHT layers` → **TWELVE layers**:

**9. Volumetric ground light** (Warm+)
Iso `radial-gradient` joka projisoituu liekin **alle ja sivuille** (ei pelkkä halo). Mix-blend `screen`. Sykkii hitaasti `flame-ground-cast`-keyframessa (4–6s). Antaa illuusion että liekki valaisee pintaa jolla se palaa.

**10. Inhale/exhale breath** (uusi wrapper-animaatio)
Liekkikomposiitti saa pitkän `flame-breathe`-skaalan: `scaleY(0.96) → scaleY(1.05) → scaleY(0.96)` 6s syklillä. Yhdistettynä nopeaan flickeriin → liekki näyttää HENGITTÄVÄLTÄ, ei vain värisevältä. Eri vaihe per instanssi (`animation-delay: calc(var(--flame-breath-offset) * 1s)`) ettei kaikki sykähdä yhdessä.

**11. True heat haze** (Blazing+, vain size ≥ 56)
Ohut SVG-overlay liekin **TAUSTALLE** (`z-index: -1`, `mix-blend-mode: screen`) joka käyttää `feDisplacementMap`-filtteriä → tausta vääristyy oikeasti. Käytetään olemassa olevaa `turbSlow`-filtteriä, mutta levitetään 1.6× liekin koon yli.

**12. Living ember field** (Diamond+)
Korvataan nykyinen statinen `crown` reaktiivisella ember-kentällä:
- 6–12 hiukkasta (size-mukaan)
- Jokaisella oma noise-pohjainen polku (`flame-ember-float` keyframe joka käyttää `--wind-x` ja `--pointer-wind-x` CSS-vareja translateX:ssä)
- Fade-in pohjasta, fade-out korkeuteen `size * 1.8`
- Sammuvat embers-asteittaiseen punaisesta mustaan (Inferno: → cyan)

### 3. Pointer-reaktio

`RealisticFlame` saa uuden propin `interactive?: boolean` (default `true` size ≥ 64). Kun pointer on 80px sisällä:
- `windTransform` lisää `calc(var(--pointer-wind-x, 0) * 6deg)` rotateen
- Liekki taipuu osoittimen suuntaan, **kuin tuulisuoja olisi siirretty**

Toteutus: pieni `useEffect` joka kuuntelee `mousemove` containerin BoundingRectiin nähden ja kirjoittaa lokaalin CSS-varin elementtiin (ei root). Throttle 60fps. Cleanup unmountissa.

### 4. Milestone shockwave (Apex/Legend/Inferno)

Lisätään `triggerFlameShockwave(element)` apufunktio joka injektoi yhden kerran toistuvan `<span>` shockwave-ringin:
- `scale: 0 → 4`, `opacity: 0.7 → 0` 800ms
- Käytetään tier-värissä (gold / amber / plasma)
- API: `RealisticFlame` exposetaa `ref`-imperative handlen `shockwave()` jota kutsutaan esim. tier-up-juhlinnassa

Tämä on vain valmius — ei kytketä mihinkään tässä iteraatiossa, jätetään hookki tuleville celebrationeille.

### 5. `src/index.css` — uudet keyframet

```css
@keyframes flame-breathe {
  0%, 100% { transform: scaleY(0.96) scaleX(1.02); }
  50%      { transform: scaleY(1.05) scaleX(0.97); }
}

@keyframes flame-ground-cast {
  0%, 100% { opacity: 0.55; transform: translateX(-50%) scaleX(1); }
  50%      { opacity: 0.78; transform: translateX(-50%) scaleX(1.12); }
}

@keyframes flame-ember-float {
  0%   { transform: translate(0, 0) scale(0.6); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translate(calc(var(--wind-x, 0) * 18px + var(--pointer-wind-x, 0) * 8px), calc(var(--ember-rise, -60px))) scale(0.2); opacity: 0; }
}

@keyframes flame-shockwave {
  0%   { transform: translate(-50%, -50%) scale(0.2); opacity: 0.7; }
  100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
}
```

Kaikki uudet animaatiot `prefers-reduced-motion`-guardeilla → poistuvat → liekki säilyy mutta ei animoidu uusilla kerroksilla.

## Suorituskykyrajat

- **Pointer wind** vain `interactive && size ≥ 64` → ei kuormita feed-listoja jossa flame size 16–28
- **Heat haze SVG** vain `size ≥ 56` (sama logiikka kuin nykyiset Inferno-kerrokset)
- **Ember field** korvaa crown'in → ei lisää DOM-noodien määrää (max 12 vs nykyiset 6)
- **Breath-animaatio** GPU-only `transform` → ilmainen
- **Ground cast** yksi `<span>` lisää per liekki, opacity+transform
- Kokonaislisäys: ~6 DOM-noodia per iso liekki, ei FPS-vaikutusta (testataan TribeFireHero + StreakDisplay + SplashScreen)

## Mitä EI muuteta

- `RealisticFlame` API säilyy taaksepäin yhteensopivana — `tier`, `accent`, `size`, `className` toimii kuten ennen
- Pienet liekit (`size < 56`) saavat **vain** breathing-paranuksen ja ground cast'in — eivät pointer-windiä, heat-hazea tai ember-fieldia
- Olemassa olevat `flame-mid-flicker`, `flame-tongue-rise`, `flame-spark-arc`, `flame-aurora-hue`, `flame-plasma-hue` säilyvät täysin
- `WindProvider` säilyy — pointer-wind on additio, ei korvaaja
- Tribe collective flame, splash screen, streak display, leaderboard inline — saavat kaikki upgraden automaattisesti ilman call-site-muutoksia

## Lopputulos

Kun käyttäjä avaa profiilin, liekki **hengittää näkyvästi**. Kun hän liikuttaa sormea sen lähellä iPhonella, liekki **taipuu sormen perään** kuin oikea tuli. Maan päällä näkyy **valaistu rinki** liekin alla. Diamond+-tiereillä **kipinät leijuvat** osoittimen ja tuulen mukana, ei satunnaisesti. Inferno saa **vääristyneen taustan** liekin ympärille. Liekki ei ole enää animaatio — se on **ilmiö**.

