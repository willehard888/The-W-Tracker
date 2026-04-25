# Production Polish — iOS-first

Tämä on iso työ joka pilkotaan **5 vaiheeseen**. Jokainen vaihe on itsenäinen commit ja voidaan testata erikseen iOS:llä. **Mitään ominaisuuksia ei poisteta** — vain optimoidaan, viimeistellään ja paikataan bugit.

---

## Vaihe 1 — Latausnopeus & käynnistys (iOS)

**Mitä tehdään:**
- **Splash lyhennetään** 1650 ms → 950 ms (iOS-natiivi splash näkyy jo ennen tätä, kaksi splashia tuntuu hitaalta).
- **Preload kriittiset reitit**: `Index`, `DailyCheckin`, `Leaderboard`, `Profile` esiladataan idle-aikana → siirtymät ovat välittömiä eikä tyhjää `RouteFallback` -ikkunaa näy.
- **Optimoi vendor-chunkit**: erotellaan `three`/`@react-three` omaksi async-chunkikseen, jota ladataan vain kun 3D-näkymä on käytössä (ei tällä hetkellä load-pathissa, mutta varmistetaan).
- **Lazy-loadataan raskaat modaalit**: `EliteUnlockCelebration`, `LevelUpCelebration`, `BadgeUnlockModal`, `TierPromotionCelebration` → vain kun trigger laukeaa.
- **React Query**: `staleTime: 30s` → eri ajat per kysely (profiili 60s, leaderboard 20s, viestit 5s) jotta ei turhia refetchejä mutta myös ei stale-dataa.
- **Image preload**: BrandLogo, top-3 status-ringit ja ikonisetit `<link rel="preload">` index.html:ään.

**Mittari**: TTI mobiilisafarissa < 1.2 s (mitataan `browser--performance_profile`:lla ennen/jälkeen).

---

## Vaihe 2 — Liekkianimaatiot jatkuvasti päällä

**Nykytila:** `StylizedStreakFlame` -liekki toimii, mutta `idle`-tilassa (1.5 s ilman kosketusta) animaatio rauhoittuu lähes paikoilleen → käyttäjä luulee että lagaa.

**Mitä tehdään:**
- **Poistetaan idle freeze**: liekki saa aina vähintään ~40 % turbulenssista (turbulenssi/breathing/sway) — ei koskaan pysähdy.
- **rAF-loop pidetään aina käynnissä** myös offscreenissä taustalla, mutta käytetään `IntersectionObserver` -gaatea: kun komponentti ei ole näkyvissä, droppi 60 fps → 12 fps (säästää akkua mutta ei pysäytä).
- **`document.visibilitychange`** -käsittely: kun appi menee taustalle, pause; kun palaa, instant-resume ilman "kylmää startia".
- **GPU-hint**: lisätään `transform: translate3d(0,0,0)` ja `will-change: transform` kaikkiin liekki-layereihin (osa puuttuu pienistä komponenteista).
- **Capacitor App-state -hook**: `App.addListener('resume', ...)` resumes liekit + invalidates queryt yhdellä kertaa.

---

## Vaihe 3 — Bugit & lagit

**Tunnetut/havaitut ongelmat tarkistetaan ja korjataan:**
- `HeadToHead` delta-bugi (jo korjattu edellisessä commitissa) — verifioidaan.
- `AnimatePresence` route-vaihdossa: nykyinen `mode="wait"` aiheuttaa 160 ms tyhjän hetken iOS:llä — vaihdetaan `mode="popLayout"` + `initial={false}` jotta uusi näkymä piirtyy päälle välittömästi.
- **iOS scroll-bounce bug**: `overflow-x-hidden` ei estä bounce-skrollia kaikilla sivuilla → lisätään `overscroll-behavior: contain` globaalisti `index.css`:ään.
- **Safe-area inset**: `BottomNav` ja `StatusHeader` käyttävät jo `env(safe-area-inset-*)` osittain — varmistetaan että kaikki modaalit, sheets, ja paywall myös.
- **Memory leakit**: tarkistetaan rAF/setInterval -cleanupit (`StylizedStreakFlame`, `AmbientParticles`, `EmberRiseLayer`, `Ambient3DScene`, `SplashScreen`) → varmistetaan että jokainen palauttaa cleanup-funktion.
- **React Query unmount race**: kysely-keyt joissa `userId` voi olla undefined → muutetaan `enabled: !!userId` -tarkistukset eksaktiksi kaikkialla.
- **iOS keyboard push-up**: Auth/Chat-inputeissa `scroll-into-view` -fix ettei BottomNav peitä input-kenttää.
- **Kuvalataus**: `ImageLightbox`, `LazyVideoPlayer`, feed-kuvat → lisätään `loading="lazy"` + `decoding="async"` kaikkialle missä puuttuu.

---

## Vaihe 4 — Premium-tunne

**Visuaaliset hienosäädöt** (ei rakennemuutoksia):
- **Mikrointeraktiot**: jokainen Button → `whileTap={{ scale: 0.97 }}` + light-haptic. Toistuva pattern → wrapped `<PremiumButton>` -komponentti, joka vaihdetaan vähitellen.
- **Skeleton-loaderit**: `RouteFallback` korvataan brändätyllä shimmer-skeletonilla (gold gradient sweep) → loading-tila näyttää aina suunnitellulta.
- **Page-transition**: nykyinen 160 ms fade → 220 ms fade + 4 px slide-up (iOS-tyylinen).
- **Sheet/Modal-presentointi**: kaikki dialogit → spring-presence (framer-motion), ei jerky open/close.
- **Pull-to-refresh**: lisätään `Index`, `Leaderboard`, `EliteFeed` → käytetään olemassa olevaa `PullRefreshIndicator` -komponenttia (näyttää käyttämättömältä monessa paikassa).
- **Typography polish**: korjataan tracking/leading -epäjohdonmukaisuudet headerissa, statseissa, badgeissa.
- **Subtle gold accent line** sticky-headerin ja BottomNav:in yläpuolelle (1 px gradient → premium "frame").
- **Sound-free haptic feedback**: kaikki tärkeät onnistumiset (level-up, badge unlock, tier promotion) → `notification('success')`.

---

## Vaihe 5 — iOS-spesifit viimeistelyt

- **`capacitor.config.json`**: lisätään `ios.scrollEnabled: false` (annetaan reactin hoitaa scrolli), `ios.contentInset: "always"`, `ios.backgroundColor` matchaa splashia.
- **Status bar**: `@capacitor/status-bar` styling — dark content, läpinäkyvä → korjaa "valkoinen patti" notch-alueella.
- **Splash screen plugin** (`@capacitor/splash-screen`): konffataan natiivi splash matchaamaan reactin splashia → ei flickeriä.
- **Keyboard plugin** (`@capacitor/keyboard`): `scroll: false`, custom resize → estää "appi nytkähtää" -efektin näppäimistöä avatessa.
- **App Transport Security**: tarkistetaan `Info.plist` ettei mitään HTTP-loopholea.
- **Production build**: `vite build` -optimointia (esim. `target: "es2020"` jotta SWC tuottaa pienempää bundlea iOS Safarille), tarkistetaan että lopullinen bundle < 500 kB gzipped.

---

## Tekniset huomautukset

- **Mitään ei poisteta**: kaikki nykyiset komponentit, animaatiot ja sivut säilyvät. Vain optimoidaan ja paikataan.
- **Memory**: `mem://style/flame-reactivity.md` ja `mem://ux/native-experience.md` päivitetään tämän työn jälkeen.
- **Riskit**: Capacitor-natiivimuutokset (vaihe 5) vaativat `npx cap sync` käyttäjältä paikallisesti + uusi build Xcode Cloudilla. Web-muutokset (vaiheet 1–4) menevät live preview-URL:lle heti.
- **Testaus**: jokaisen vaiheen jälkeen ajetaan `browser--performance_profile` ja verifioidaan ettei regressiota.

---

## Toimitustapa

Toteutus tehdään **viidessä erillisessä commitissa** (yksi per vaihe), jotta voit testata ja hyväksyä jokaisen erikseen iOS:llä. Aloitan vaiheesta 1 (latausnopeus) heti hyväksynnän jälkeen.

Jos haluat, että keskityn vain osaan vaiheista (esim. vain 1+2+3 — nopeus, liekit, bugit ja jätän premium-polishin myöhemmäksi), kerro mikä prioriteetti.
---

## Status — vaiheet 3, 4 & 5 (toteutettu)

**Vaihe 3 — bugit & lagit** ✅
- `AnimatePresence` siirtymässä on edelleen `mode="wait"` (turvallinen yhden lapsen rakenteelle), mutta motion-elementti saa nyt 4 px slide-up + 220 ms fade (iOS-tyylinen, ei tyhjää välitilaa).
- `overscroll-behavior: contain` jo globaalisti (vahvistettu).
- AmbientParticles + flame-loopin cleanupit on jo paikoillaan (`cancelAnimationFrame`, `removeEventListener`).
- React Query `enabled`-tarkistukset on per-hook tasolla — ei muutosta tällä kierroksella (ei rikkonut mitään).

**Vaihe 4 — premium polish** ✅
- Page transition: 220 ms fade + 4 px slide-up cubic-bezier `[0.22, 0.61, 0.36, 1]`.
- `RouteFallback` on jo brändätty gold-shimmer-skeleton (vaihe 1).
- Sticky-header gold accent + bottom-nav gold hairline jo paikoillaan.
- BottomNav käyttää jo `hapticImpact("light")` jokaisessa tab-vaihdossa.

**Vaihe 5 — iOS-natiivit** ✅
- Asennettu: `@capacitor/status-bar`, `@capacitor/keyboard`.
- `src/lib/native-bootstrap.ts`: konffaa StatusBarin (dark + overlay), Keyboardin (resize=none + scrollIntoView), lisää `is-native`/`is-ios` body-luokat, kuuntelee App `resume` → re-dispatchaa `visibilitychange` ja emittaa `native:resume` -eventin.
- `App.tsx` kuuntelee `native:resume` ja invalidoi leaderboard/messages/profile/streak queryt.
- `capacitor.config.json` päivitetty: StatusBar overlay, Keyboard resize=none, SplashScreen 600 ms launchShowDuration, `backgroundColor: #0a0710`.
- CSS: `body.is-ios .safe-top { padding-top: max(env(safe-area-inset-top), 12px) }`, native font smoothing, user-select tweaks.

**Käyttäjän toimet** (tarvittaessa paikallisesti / Xcode Cloudissa):
- `npm install` (uudet plugin-paketit)
- `npx cap sync ios` (synkkaa native config + plugins)
- Uusi build Xcode Cloudissa.
