
# Polish: Latausnopeus & sulavuus (Web + iOS Native)

Tavoite: nopeampi cold-start, sulavammat siirtymät ja vähemmän jankia — **mitään featurea, animaatiota tai visuaalia ei poisteta**. Vain optimointi, prefetch, lazy ja virhekorjaukset.

---

## 1. Cold start (latausnopeus)

**index.html**
- Lisää `<link rel="preconnect">` ja `<link rel="dns-prefetch">` Supabase-domainille (`zjdljojkgrpgxurugixf.supabase.co`) niin että ensimmäinen API-kutsu lähtee ~200 ms aiemmin.
- Lisää `<link rel="modulepreload" href="/src/main.tsx">` jotta JS-bundle alkaa latautua heti `<head>` parsetessa.
- Korvaa `apple-touch-icon` osoittamaan kevyempään `/app-icon.webp` -versioon (1.2 MB → 6 KB) — natiivi-iOS PWA-icon ei muutu, vain web-välimuisti kevenee.
- Lisää korkean prioriteetin font-display & system-font fallback `<style>`-blokkiin niin että teksti renderöityy heti.

**vite.config.ts**
- Lisää `chunkSizeWarningLimit: 1200` ja jaa `manualChunks` hienommin: erota `supabase` (`@supabase/supabase-js`) omaan chunkkiinsa (ladataan lazy auth-flowin yhteydessä) ja `capacitor` (`@capacitor/*`) omaansa (ei ladata webissä).
- Lisää `build.target: "es2020"` ja `cssCodeSplit: true` (oletus mutta varmistetaan) — pienempi initial CSS.

**src/lib/route-preload.ts**
- Käytä `link rel="modulepreload"` -injektiota `import()`-kutsujen sijaan priority-routeille → selain alkaa ladata bundleja parallel ilman että execution lukitsee main threadin.
- Lisää `connection.saveData` / `effectiveType === "2g"` -tarkistus → skippaa secondary-route preloadin hitaalla yhteydellä.

**src/main.tsx**
- Siirrä iOS-debug logging -callit `Capacitor.isNativePlatform()` -haaraan kokonaan (web-bundle ei sisällä `pushIosDebugLog` -kutsuja → pienempi initial JS).
- `createRoot(...).render(<App />)` `requestIdleCallback`-wrapperin sijaan suora — varmistus että render alkaa heti, mutta `initNativeShell()` ja deep-link listenerit jätetään fire-and-forget mikrotehtäviin.

---

## 2. Sulavuus (smoothness / jank)

**src/App.tsx**
- Memoize `queryClient` (jo on module-scope, OK), mutta käärittele `<RevenueCatProvider>`/`<WindProvider>` `React.memo`:lla niin etteivät uudelleenrenderöidy splash-state-muutoksen yhteydessä.
- Splash → app -siirtymä: lisää `requestAnimationFrame`-pohjainen siirtymä `setSplashDone(true)`:lle → ei "double-paint flash" ensimmäisellä framella.

**src/components/SplashScreen.tsx**
- Splash sisältää tällä hetkellä `<RealisticFlame>` + 12 sparks + 8 embers + 2 shockwave-rinkiä — pidetään, mutta:
  - Lisää `prefers-reduced-motion` -tarkistus joka skippaa partikkelit (säilyttää logon + word-mark) → reduced-motion käyttäjälle välitön.
  - Pakota `contain: strict` koko containeriin (nyt `layout paint size`) → eristää paint splash-fadeoutin aikana.

**src/components/AmbientParticles.tsx**
- Lisää passive-detection: jos `(navigator as any).connection?.saveData` → skippaa kokonaan.
- Vähennä `FRAME_MS`-throttle iOS:llä 18 fps (nyt 20) — silmä ei huomaa, mutta säästää ~10 % main-threadia.

**src/components/home/CommandDeck.tsx**
- Korjaa konsolivaroitus: `background: ctaGradient` + `backgroundSize: "200% 200%"` aiheuttaa shorthand-collision warningin React-rerenderissä. Vaihda `background` → `backgroundImage` jolloin ei konfliktoi `backgroundSize`:n kanssa.

**src/components/AppleSignInButton.tsx**
- Korjaa konsolivaroitus: "Function components cannot be given refs" — kääri `forwardRef`:iin (Auth-page passaa refin saavutettavuus-syistä).

**src/components/ModalStack.tsx**
- Lisää `layoutId`-poisto modal-routeilta jotka eivät tarvitse layoutia → vähemmän framer-motion measurea.
- `AnimatePresence mode="popLayout"` → vaihdetaan `"wait"`-moodiin **vain** modaaleille jotta exit-frame ei kilpaile enter-framen kanssa iOS Safarissa (push-routet pidetään popLayout-modessa).

**src/components/TabHost.tsx**
- Tabit pidetään mountattuna (jo on), mutta lisää `content-visibility: auto` + `contain-intrinsic-size: 100% 800px` ei-aktiivisille TabPaneille → selain skippaa paintin/layoutin off-screen tabeille kokonaan, palaa instantisti kun aktiivinen.

**src/contexts/WindProvider.tsx + src/lib/wind.ts**
- Lisää page-visibility -kuuntelija joka pysäyttää wind-rAF-loopin kun tab piilossa (säästää batteryä iOS:llä taustalla).
- Throttle wind-tickrate 30 Hz → 24 Hz (käyttäjä ei näe eroa, säästää ~20 % CSS-var writeistä).

---

## 3. iOS native -spesifit

**capacitor.config.json**
- Vahvista `SplashScreen.launchShowDuration: 600` (nyt OK) ja lisää `SplashScreen.backgroundColor: "#0a0710"` matchaamaan React-splashin gradienttia (estää native→react flash).
- `iosScheme: "app"` -varmistus jotta service-worker ei kaappaa initial loadia.

**ios/App/App/Info.plist**
- Lisää `WKAppBoundDomains` jos vielä puuttuu → nopeampi WKWebView-startup.

**src/lib/native-bootstrap.ts**
- Käännä Keyboard `keyboardWillShow` -listenerin `scrollIntoView` käyttämään `block: "nearest"` (nyt `"center"`) → estää isot scrollijumpit chat- ja checkin-näytöillä.

---

## 4. Mitä EI muuteta

- AmbientParticles, splash-flame, ember-rain, sparkit, shockwavet, glow-haalot, story-share-grafiikat, tribe fire fieldit, AI Coach, Elite-feed — **kaikki säilytetään pikselilleen**.
- Apple-sign-in -flow, RevenueCat, Supabase RLS, edge-functionit — ei muutoksia.
- Brändi, värit, tekstit, navigaatio — ei muutoksia.

---

## Tiedostot joita muokataan

```
index.html
vite.config.ts
src/main.tsx
src/App.tsx
src/lib/route-preload.ts
src/lib/native-bootstrap.ts
src/lib/wind.ts
src/contexts/WindProvider.tsx
src/components/SplashScreen.tsx
src/components/AmbientParticles.tsx
src/components/AppleSignInButton.tsx
src/components/ModalStack.tsx
src/components/TabHost.tsx
src/components/home/CommandDeck.tsx
capacitor.config.json
ios/App/App/Info.plist
```

## Odotettu vaikutus

- **Cold start:** -300…-600 ms First Contentful Paint webissä; -200 ms iOS WKWebView startup.
- **Tab-switch:** instant (jo nyt mountattu, mutta `content-visibility` poistaa paint-lagin uudelleen-aktivoinnista).
- **Konsoli:** kaksi React-warningia poistuu (CommandDeck shorthand, AppleSignInButton ref).
- **Akku iOS:** wind/particle-loopit pysähtyvät kun appi taustalla.
