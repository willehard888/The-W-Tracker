# Premium Polish — Gold · Fire/Lava · Obsidian

Tavoite: nostaa koko appi yhtenäiseen "Obsidian Gold" -tunnelmaan ilman että mikään olemassa oleva toiminto, komponentti tai sivu poistuu tai rikkoutuu. Kaikki muutokset ovat **additiivisia tai värinvaihtoja olemassa oleviin tokeneihin** — komponenttien rakenne, propsit ja logiikka säilyvät.

---

## 1. Theme unification — Gold / Fire / Black

Tällä hetkellä `index.css`:ssä elää neljä rinnakkaista aksenttiväriä (`--purple`, `--teal`, `--rose`, `--amber`) ja `glass-card`, `aura-halo-*`, `gradient-border-animated` ym. käyttävät niitä. Pidämme tokenit olemassa (jotta mikään ei rikkoonnu), mutta **uudelleenmäärittelemme niiden HSL-arvot lämpimäksi tuli/laava/kulta -spektriksi**:

```text
--gold        42 78% 54%   (säilyy — hero gold)
--gold-light  42 90% 70%
--gold-dark   42 60% 36%
--ember       18 95% 58%   (uusi — orange ember)
--lava        12 92% 50%   (uusi — deep lava red-orange)
--ash         258 14% 11%  (alias — secondary-tumma)

# Re-tinted aliases (säilyvät nimet, vaihtuu sävy)
--purple      → 24 80% 52%   (deep ember orange, korvaa violetin)
--purple-light→ 30 92% 66%
--purple-dark → 14 75% 32%
--teal        → 38 90% 56%   (warm gold-amber, korvaa teal:n)
--teal-light  → 44 95% 70%
--teal-dark   → 32 78% 38%
--rose        → 8 90% 56%    (lava red, korvaa pinkin)
--amber       → säilyy lämpimänä (jo on)
```

Vaikutus: **kaikki** komponentit jotka käyttävät `text-purple-brand`, `glow-teal`, `gradient-rose`, `aura-halo-purple`, `glass-card::before` -kausaaligradientti jne. päivittyvät automaattisesti tuli-paletille — yksikään tiedosto ei tarvitse manuaalisia muutoksia. BadgeRare/Epic säilyttävät omat sinet/violet -värinsä (badge-järjestelmä on tarkoituksellinen ja ei "riko teemaa").

Lisäksi:
- Body-taustan radial gradients (`index.css` rivit 100–111) saavat hieman syvemmän "lava floor" -hehkun alaosaan.
- `--background` nostetaan minimaalisesti puhtaaseen obsidian-mustaan (258 22% 3% → 258 18% 2.5%) jotta kontrasti kultaan kasvaa.

---

## 2. Animation polish — sulavammat siirtymät

Globaalit easing-tokenit (`--ease-spring`, `--ease-soft`) on jo määritelty mutta käyttö on epäjohdonmukaista. Muutokset:

- **`tailwind.config.ts`**: lisää `animation`-bloki uudet luokat: `fade-in`, `fade-in-up`, `scale-in`, `slide-up`, `breathe`, `shimmer`, `ember-rise` (kaikki käyttävät `--ease-soft` / `--ease-spring`).
- **`index.css`**: nykyinen `animate-reveal` -keyframe on hyvä, mutta lisätään stagger-utilities `animate-stagger-1..6` (80ms inkrementit) jotta listat ja gridit voi viimeistellä yhdellä luokalla.
- **Card hover** (`card-hover`, `card-3d`) — nopeutetaan transitionit 300→220 ms ja vaihdetaan easing `--ease-spring`:iin → "kostea" pomppu, premium-feel.
- **Buttons** (`src/components/ui/button.tsx`) — lisätään active-press scale `0.97` + 90 ms transition kaikkiin variantteihin, tactile native-tunnelma.
- **Page transitions** — `RouteFallback.tsx` ja `App.tsx`-tason layout saavat `animate-fade-in-up` -wrappauksen jokaiselle reitille (`<main>` opacity-fade 220 ms, ei rikkomata routing-logiikkaa).
- **Reduced-motion safe** — kaikki uudet animaatiot wrapatataan `@media (prefers-reduced-motion: reduce)` -säännöllä joka jo on käytössä.

---

## 3. Flame system polish

`StylizedStreakFlame.tsx` on jo voimakas, mutta hienoa viimeistelyä:

- **Color grading** — palettin gradient-stopit lämmitetään: nykyinen "deep red base → orange → yellow → near-white" päivitetään käyttämään yhtenäistä kulta-laava -spektriä (12° → 18° → 32° → 45° hue-sweep). Front-row hero saa **valkokultaisen kärjen** (42° 100% 92%) joka korostaa premium-kultaa.
- **Floor pool** (`floorPoolColor`) — rivit 356–359, päivitetään käyttämään uusia `--lava` ja `--ember` tokeneita, jotta tribe collective inferno -laava-allas vastaa teemaa.
- **Aura accent** — ei-tribe -liekeissä otetaan käyttöön hyvin pehmeä kulta-aura (opacity 0.08, ei nykyistä 0.35) jotta jokainen liekki istuu komponenttiinsa ilman että "loistaa läpi" ympäröivän sisällön. Tribe `intensify={10}` säilyy nykyisellä aurallaan.
- **Bob-animaatio** — nykyinen 2.6s on hieman jäykkä; muutetaan 3.4s + ease-soft, lisäksi tinytiny `flame-shimmer` -overlay (1px kulta-glint joka liukuu liekin yli 6 s välein).
- **Cold candle** — nykyinen muted-stroke vaihdetaan `text-gold-soft / 0.35` joten myös "kuollut liekki" pysyy teemassa.
- **Reduced motion** — säilyy: olemassa oleva `[style*="stylized-"]` -globaali sääntö pysyy.

`Flame.tsx`, `RealisticFlame.tsx`, `TribeFireHero.tsx`, `TribeCollectiveFlame.tsx` toimivat sellaisenaan koska ne ovat jo wrapper-pohjaisia engineä kohti — saavat parannukset automaattisesti.

---

## 4. Surfaces & cards

- **`surface-glass`** — bottom shadow saa `+ 0 32px 64px -28px hsl(42 78% 54% / 0.18)` jotta kortit "leijuvat" lämpimällä kultahehkulla mustaa taustaa vasten.
- **`card-3d`** hover — nykyinen `gold/0.08 + purple/0.12` -hover-hehku korvataan **puhtaalla `gold/0.18` + `ember/0.10`** -kombolla.
- **Buttons (`button.tsx`)** — `default` varianttiin lisätään hienovarainen `inset 0 1px 0 hsl(42 90% 75% / 0.25)` highlight-rivi → metallinen kulta-kosketus.
- **Inputs** — focus-ring jo on kullan sävyinen, OK.
- **Dialog / Sheet** — backdrop päivitetään `bg-black/72 backdrop-blur-md` → `bg-[hsl(258_30%_2%/0.78)] backdrop-blur-lg` jotta dialogin alla oleva tausta vaihtuu mustempaan obsidian-sävyyn.

---

## 5. Bottom nav & header

- **`BottomNav.tsx`** — aktiivisen tab-ikonin alla oleva indicator (jos käyttää muuta kuin kultaa) vaihdetaan `bg-[hsl(var(--gold))]`. Inaktiivinen state pysyy `text-foreground-faint`. Lisätään spring-transition aktiivisen tabin vaihtuessa (220 ms `--ease-spring`).
- **`AppLogoHeader.tsx`** — säilyy ennallaan, mutta gradient-glow pulssi hidastetaan 4 s → 6 s, premium-tunne.

---

## 6. Tarkistuskohteet (no-break guarantee)

Käyn kaikki tiedostot jotka osuvat muuttuneisiin tokeneihin:

- `Ambient3DScene.tsx`, `EliteFeed.tsx`, `WeeklyBriefing.tsx`, `LevelCard.tsx`, `RankProgressHub.tsx`, `StatusBadge.tsx`, `StatusAvatar.tsx`, `StatusNameplate.tsx`, `TierLadder.tsx`, `Onboarding.tsx`, `Coach.tsx`, `DailyCheckin.tsx`, `DailyQuests.tsx`, `RankPressureCard.tsx`, `Battles.tsx`, `Leaderboard.tsx`, `PublicProfile.tsx`, `Profile.tsx`, `Referrals.tsx`, `TopInvitersWidget.tsx`, `TribePostCard.tsx`, `StatCard.tsx`, `StatusPreview.tsx`, `StatusHeader.tsx`, `ProfileActivityPulse.tsx`, `Messages.tsx`, `ImageLightbox.tsx`, `CheckinTierHeader.tsx`, `CheckinTierSummary.tsx`.

→ **Ei muuteta logiikkaa eikä JSX-rakennetta.** Värit virtaavat tokenien kautta. Koska `--purple` jne. säilyvät `tailwind.config.ts`:n mappauksissa, jokainen `text-purple`, `bg-teal`, `from-rose-dark` jne. jatkaa toimintaansa mutta **renderöi nyt lämpimän tuli/kulta-sävyn**.

Badge-järjestelmän `--badge-rare` (sininen) ja `--badge-epic` (violetti) jätetään koskematta — ne ovat tarkoituksellinen tier-signal.

---

## 7. Tiedostot joita muokataan

**Muokattavat (vain värit / animaatiot, ei rakenteita):**
- `src/index.css` — token-uudelleenmäärittely, body-gradient -hieno säätö, animation-utilities, surface-glass / card-3d / button hover -hehkut, dialog-backdrop.
- `tailwind.config.ts` — uudet `animation`-luokat (fade-in-up, scale-in, ember-rise, breathe, stagger).
- `src/components/home/StylizedStreakFlame.tsx` — gradient-stopit, floor pool, aura accent, bob-keston säätö.
- `src/components/ui/button.tsx` — active-press scale, kulta-highlight inset.
- `src/components/BottomNav.tsx` — aktiivisen tabin kulta-indicator + spring-transition.
- `src/components/AppLogoHeader.tsx` — pulse-keston säätö.

**Ei muuteta:** mikään muu komponentti tai sivu. Logiikka, propsit, RPC-kutsut, RLS, reititys, auth, tribet, badgeen liittyvät RPC:t, edge-functionit — kaikki säilyvät bittinä bitiltä.

---

## 8. Visuaalinen tulos

```text
ENNEN                          JÄLKEEN
─────────────────────         ─────────────────────
Obsidian + gold + violet      Obsidian + gold + lava ember
+ teal + rose accents         (yksi lämmin spektri)

Stiff hover transitions       Spring-eased magnetic hover
(300ms linear)                (220ms cubic-bezier 0.16,1.2,0.32,1)

Flame: red→orange→yellow      Flame: lava→ember→gold→white-gold
                              (premium kulta-kärki hero-liekissä)

Glass card halo: violet drift Glass card halo: ember drift
                              + lämmin kulta-pohjavarjostus
```

Lopputulos: yhden teemainen, sulava, premium "Obsidian × Liquid Gold × Living Fire" -tunnelma — ilman että yhtäkään ominaisuutta katoaa.
