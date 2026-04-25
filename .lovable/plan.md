## Goal

Tee liekistä **paljon reaktiivisempi** käyttäjän eleisiin ja yhdistä jokainen interaktio **natiiviin haptiseen palautteeseen** iOS:lla / Androidilla. Ei progression-muutoksia, ei uusia stage-tasoja — keskitytään puhtaasti tunteeseen.

---

## Mitä lisätään

### 1. Tap-blast (containerin tap)
- `pointerdown` liekin päällä laukaisee **valkoisen rengasvälähdyksen** + **8 kipunaa** sinkoutuu radiaalisesti ulos liekistä.
- Liekki **pomppaa** (scaleY-pop ~120 ms, easeOutBack).
- Haptic: `Haptics.impact({ style: "Medium" })` — tuntuva napsahdus iPhonella.

### 2. Multi-axis lean (pointer follow-up)
- Nykyinen X-tuuli säilyy ja vahvistuu hieman.
- **Uusi Y-akseli**: kun pointer on liekin yläpuolella → liekki **kurottaa kohti** (scaleY +0.15). Kun alapuolella → painautuu (scaleY −0.08). Tuntuu kuin liekki "haistaisi" käden.

### 3. Proximity bloom + kevyt haptic
- Mitä lähempänä pointer on, sitä **kirkkaammaksi & saturoituneemmaksi** liekki muuttuu (filter brightness +25 %, saturate +30 %).
- Kun pointer **astuu lähikenttään** (proximity > 0.7) → kertaluonteinen `Haptics.selectionStart/Changed/End` (kevyt klik) — ei toistu ennen kuin pointer poistuu (proximity < 0.4) → hysteresis estää spam-haptic-tärinän.

### 4. Scroll-momentum gust + haptic
- Sivun scrollaus → laskee velocity → **työntää gust-arvoa** ja heilauttaa liekkiä lyhyesti scroll-suuntaa vasten (alas-scroll = liekki taipuu vasemmalle, ylös = oikealle).
- Erittäin nopea scroll (yli kynnyksen) → `Haptics.impact({ style: "Light" })` — pieni napsahdus joka kruunaa "tuulen" tunteen.

### 5. Idle breath
- 4 s ilman inputtia → liekki vaimenee (`--ssf-idle: 1`): bob-amplitudi −40 %, brightness −10 %, sway hidastuu.
- Ensimmäinen pointer/scroll **herättää** liekin: 600 ms easeOut wake-up-pulssi (lyhyt scaleY-pop ja brightness-flash).

---

## Tekniset muutokset

### `src/components/home/StylizedStreakFlame.tsx`
- Korvaa nykyinen pointer-effect uudella, joka kirjoittaa containerille 6 CSS-muuttujaa: `--ssf-wind-x`, `--ssf-wind-y`, `--ssf-gust`, `--ssf-proximity`, `--ssf-blast`, `--ssf-idle`.
- Lisää `pointerdown`-listener → `triggerBlast()` → asettaa blast-arvon, spawnaa spark-state-arrayn ja kutsuu `hapticImpact("medium")`.
- Lisää `scroll`-listener → momentum-pohjainen gust + `hapticImpact("light")` korkeilla nopeuksilla.
- Lisää proximity-hysteresis joka kutsuu `hapticSelection()` lähikenttään tullessa (kerran).
- Idle-tila tracking RAF-loopissa: `lastInputT` → `idle` lerppaa 0:sta 1:een 4 s:n hiljaisuuden jälkeen.
- Renderoi state-pohjaiset overlayt: `<BlastRing>` (kun `blastRing` increments) ja `<BlastSparks>` (kun `blastSparks.length > 0`). Molemmat poistetaan `setTimeout`illa 850 ms.
- Container-stylesta luetaan `--ssf-blast` ja `--ssf-idle` brightness/saturate-filterissä, jotta blast välähtää ja idle-tila vaimentaa kokonaisuuden.
- Dynaaminen import: `import("@/lib/haptics")` jotta web-buildi ei kaadu.

### `src/index.css`
- Päivitetään `@keyframes stylized-flame-sway` lukemaan myös `--ssf-wind-y` (scaleY-vaikutus) ja `--ssf-blast` (lyhyt scaleY-pop).
- Lisätään `@keyframes ssf-blast-ring` (renkaan välähdys: scale 0.4 → 1.6, opacity 0.9 → 0).
- Lisätään `@keyframes ssf-blast-spark` (kipinä: translate radial → fade out 0.85 s).
- Päivitetään reduced-motion-block kattamaan uudet keyframet.

### Haptics
- Käytetään olemassa olevaa `src/lib/haptics.ts`-helperia (jo paketoitu, `@capacitor/haptics` ^8.0.2 asennettu).
- Helper no-op-aa webissä → ei hajota selainkäyttöä.
- Native-puolella käyttäjä ajaa `npx cap sync` git pull:in jälkeen — ei uusia natiiviplugineja, joten ei rebuild-vaatimusta.

---

## Mitä ei muuteta

- Stage-progression logiikka, persoonataulukot, milestone-räjähdykset → ei kosketa.
- Liekkien lukumäärä, värigradientit, ääriviivat → säilyvät ennallaan.
- Muut komponentit (`Flame.tsx`, `RealisticFlame.tsx`, `TribeFireHero.tsx`) → ei muutoksia; ne käyttävät nykyisin samaa pohjaa.
- Tribe-inferno (`intensify > 1`) → toimii kuten ennen, mutta nauttii samasta reaktiivisuudesta.

---

## ASCII-kartta

```text
INPUT                    HAPTIC                CSS VAR              VISUAL
─────                    ──────                ────────             ──────
pointerdown    →   Impact("medium")   →   --ssf-blast 1→0   →   ring + 8 sparks + scale-pop
pointermove    →   (lean tracking)    →   --ssf-wind-x/y    →   sway + reach toward pointer
proximity>0.7  →   Selection (1×)     →   --ssf-proximity   →   brightness/saturation bloom
fast scroll    →   Impact("light")    →   --ssf-gust        →   gust burst + brief lean
idle 4s        →   —                  →   --ssf-idle 0→1    →   slow breath, dim
next input     →   —                  →   --ssf-idle 1→0    →   wake-up flash
```
