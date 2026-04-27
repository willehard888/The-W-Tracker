# Native-feel mobile upgrade — last 10%

Ei uusia ominaisuuksia. Vain feel, performance ja interaction.

---

## 1. Root cause — miksi tuntuu webiltä

**Rendering**
- `AnimatePresence` ympäröi koko `<Routes>` → jokainen tab-vaihto unmountaa kokonaisen sivun ja sen react-query-konsumerit. Skroll, lokaali state, in-flight haut, IntersectionObserverit ja video-alustat heitetään pois → "lataa uudestaan"-tunne.
- Suspense-fallback (`RouteFallback` / skeletons) renderöityy AnimatePresencen sisällä → uudelleenmount + skeleton flash, vaikka chunk olisi jo prefetched.
- Tab-transition on cross-fade jossa `exit.opacity:0` (160 ms) — silmä näkee mustan välin ennen `enter`. Native iOS-tab vaihtuu **0 ms**.

**Navigation**
- Ei view-stackia. Tabit ovat siskoja `<Routes>`-rakenteessa, joten paluu ei palauta state/scrollia muusta kuin kahdesta rAF:stä → näkyvä hyppy.
- Modaalit (paywall, chat, briefing) jakavat saman AnimatePresencen popLayout-moodissa → "hard transition" peittäen toisensa.
- iOS:n swipe-back ei ole kytketty router-historiaan visuaalisesti.

**State**
- Hookit fetcheröivät kohdekomponentin `useEffect`issa eikä reactin queryClientin prefetchillä → ensikerralla aina blank.
- `staleTime: 30s` on OK, mutta ilman per-route prefetchia ja `keepPreviousData`-käytäntöä lista-sivut näyttävät tyhjältä joka mountilla.
- `placeholderData: prev` on globaali, mutta uudelleenmount tappaa "prev"-cachen samasta avaimesta toisessa mountin queryclientissa kun key muuttuu.

**Network/loading**
- Splash näkyy joka cold-startissa. Auth-loading + profile-loading + subscription-loading sarjana → blank-state ennen ekaa screen-paint.
- `RouteFallback` on visuaalisesti eri kuin oikea sivu (eri taustat, eri kortit) → flash-of-skeleton.

---

## 2. Zero-loading -järjestelmä

**Aina mountattuna sessiossa (persistent stack):**
`/`, `/checkin`, `/feed`, `/tribes`, `/messages`, `/leaderboard`, `/battles`, `/profile`. Tabit pidetään DOMissa, näkymättömät tabit `display:none`-piilossa. Scroll, state, query-cache pysyy.

**Aina preloadattu (chunkit):** kaikki tab-sivut + `Paywall`, `Coach` käynnistyvät splashin jälkeen idle-aikana (`route-preload.ts` jo olemassa — ulotetaan kaikkiin tabeihin).

**Background:** detail-sivut (TribeDetail, UserProfile, Chat, BadgeCompare, Briefing) prefetchataan kun käyttäjä hover/pointerdown linkkiä.

**Blank state pois:** placeholderit eivät ole skeletoneita vaan **viimeisin tunnettu data** (prev cache + `keepPreviousData` per query). Skeletons vain ensimmäisellä laitteen-elinaikaisella avauksella; tab-vaihtoon **ei koskaan**.

**Splash:** näytetään vain ekalla session-cold-startilla (jo nyt). Kuvaikkunassa lyhennetään minimi 800 ms → 400 ms ja AppRoutes mountataan splashin alle, jotta paint on heti splashin alaslähdön jälkeen.

---

## 3. Navigation rewrite — persistent tab stack

**Uusi malli:**

```text
<RouterRoot>
  <StatusHeader/>
  <TabStack>                  ← always mounted, only top tab visible
    <TabScreen path="/"/>     ← display:none kun ei aktiivinen
    <TabScreen path="/checkin"/>
    ...
  </TabStack>
  <ModalStack/>               ← /paywall, /chat/:id, /briefing/:id, detail-sivut
  <BottomNav/>
</RouterRoot>
```

- Tab-vaihto: `display:none` → `display:block`, **ei mitään animaatiota tabin sisällön ulkonäköön**, vain BottomNavin pill liikkuu (jo on). Aktivoituvan tabin scrollPosition säilyy DOMissa luonnostaan.
- Detail-pushit (`/user/:id`, `/tribes/:id`, `/chat/:id`): renderöidään modal-stackissa **tab-tasolla aktiivisen tabin päälle** → swipe-back paljastaa alta tabin staattisena (ei mounttausta).
- Pop: framer-motion translate `x: 100%` → `0` enter, paluulla translate `0` → `100%` exit, taustalla tab näkyy. 240 ms cubic-bezier(0.32, 0.72, 0, 1).
- Modaalit (paywall, briefing): translate `y: 100%` → `0`. 280 ms.
- iOS swipe-back: kuuntelijan touchmove `pageX > 24px from left edge` → seuraa sormea live-translateilla → release > 50% tai velocity > 0.5 → `navigate(-1)`.

---

## 4. Rendering & state strategy

- **TabHost** -komponentti: pitää sisällään `<Outlet>`-tyylisesti renderöidyt tab-sivut, valitsee `data-active` className-kytkimellä. Yksi kerros `position:absolute; inset:0; visibility:hidden;` epäaktiiveille → ei layout-laskentaa, ei IntersectionObserver-laukauksia.
- Sivu-komponentti EI saa unmounttautua tabin vaihtuessa → kaikki react-query-tilat säilyvät ilman cachen kiertotietä.
- Per-query: lisätään `placeholderData: keepPreviousData` ja `staleTime` per use case (60 s leaderboardille, 15 s feedille, 0 messages-listalle realtimen alla).
- `framer-motion` `<motion.div>` ei käytä `key={pathname}` modaaleille → pelkkä mountti/unmount transformilla.
- `contain: layout paint` lisätty isoille listoille (Feed, Leaderboard, Tribes) → reflow eristyy.

---

## 5. Touch response

**Säännöt:**
- Visuaalinen feedback **≤ 16 ms** pointerdownista → CSS `:active` + `transform: scale(0.97)` heti.
- Navigaatio **pointerup**:lla, mutta haptic + prefetch **pointerdown**:lla (jo BottomNavissa — laajennetaan kaikkiin korteihin/buttoneihin).
- `touch-action: manipulation; -webkit-tap-highlight-color: transparent` globaalisti `<button>`, `[role=button]`, `<a>`-elementeille `index.css`:ssä.
- Haptic-kartta:
  - `light` — tab-switch, kortti-tap
  - `medium` — submit, modal open
  - `heavy` — destructive confirm, level-up
- Press-state utility-luokka `.press` → kaikki interactive-kortit saavat sen.

---

## 6. Motion system

- **Transition durations**:
  - micro (toggle, ripple, press): 120 ms
  - element (modal sheet, kortti enter): 220 ms
  - screen (push/pop): 260 ms
  - modal: 280 ms
- **Easing** kaikkialla: `cubic-bezier(0.32, 0.72, 0, 1)` (iOS-tyyli). Mikrointeraktioissa decelerate `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Suunta**: push siirtyy oikealta sisään, pop oikealle ulos. Modaali ylhäältä? Ei — alhaalta ylös (sheet).
- **Tab**: ei mitään. Vain BottomNav-pill animoituu.
- **Listojen item-enter**: ei staggered fade-iniä — vain ensimmäisellä päivittymisellä. Uudelleenrender ei animoi.

---

## 7. Scroll & gesture

- iOS overscroll lukitus tab-konttiin: `overscroll-behavior: contain`, ei `bounce` body-tasolla.
- Scroll-säilyö per tab natively koska tab pysyy DOMissa (ei enää manuaalista `useRouteScrollMemory` tabeille — pidetään detail-sivuille).
- Pull-to-refresh `use-pull-refresh` jo on; kytketään tab-host-tasolle vain `/`, `/feed`, `/messages`, `/leaderboard`.
- Swipe-back kuvattu kohdassa 3.

---

## 8. Loading & data flow

- `Index`-sivun 4 useQuery:tä rinnakkaisesti — varmistetaan `enabled: !!user.id` ja kaikilla `staleTime: 60_000`, `placeholderData: keepPreviousData`. Ei muutoksia sopimuksiin.
- Optimistinen UI:
  - `feed_reactions` insert → invalidate vasta onSettledissa, optimistinen `queryClient.setQueryData` heti.
  - `daily_checkins` submit → optimistinen profile.xp + streak päivitys.
  - `friendships`/`tribe_invites` accept → optimistinen status-flip.
- Realtime (chat, feed) — jo tehty; varmistetaan ettei `subscribe → unsubscribe` tapahdu tab-vaihdossa (persistent mount korjaa tämän automaattisesti).

---

## 9. Visual stability

- Kaikki tab-rootit saavat `min-h-[100dvh]` ja `aspect-ratio` -placeholderit kuville (`avatar`, `tribe-cover`, `feed-image`).
- Status header korkeus jo on lukittu — varmistetaan `flex-shrink-0` ja että trial-banneria ei swappaa korkeutta render-syklin aikana (mountataan `min-h-[40px]` placeholder).
- BottomNav `contain: layout paint` jo asetettu — laajennetaan tab-hostiin.
- `font-display: optional` lisätään brändifonteille → ei FOIT.

---

## 10. "Native feel" -tarkistuslista

Jos jokin näistä toistuu → palaa kohtaan ja korjaa:
1. Pitäisikö skeleton näkyä tab-vaihdossa? **EI koskaan.**
2. Tap-feedback ≤ 16 ms? **Pakko.**
3. Layout-shift mountin jälkeen? **0 px.**
4. "Hard cut" siirtymässä? **Vain tab-vaihtoon — kaikki muut transformeja.**
5. Network-flash listoissa? **Optimistinen + keepPrevious.**
6. Splash 2× session aikana? **Ei. Vain ensimmäinen kerta.**
7. Backswipen alla tyhjä tausta? **Ei. Edellinen näkymä paljastuu live.**

---

## 11. Suoritusjärjestys

**Vaihe A — Suurin vaikutus (heti):**
1. **Persistent tab-host**: uudelleenrakenna `AppRoutes` niin että tab-routet renderöityvät yhtaikaa `<TabStack>` componentissa, joka kytkee `display`-statet location.pathnamen mukaan. Detail/modal-routet säilyvät framer-motion-stackissa.
2. **Poista tab-tier exit-animaatio**: tab-tier `transition: { duration: 0 }`, ei opacityä.
3. **`placeholderData: keepPreviousData`** kaikkiin Index/Leaderboard/EliteFeed/Tribes-useQueryihin.
4. **Press-state utility** kortteihin (Feed, Leaderboard, Tribes-listat) ja kaikkiin `<button>` -elementteihin (CSS-luokka `index.css`:ssä).

**Vaihe B — Rakenteellinen (medium):**
5. **Modal-stack erilleen** (push/modal/popLayout) AnimatePresencessä, tab-stack ei ole AnimatePresencen alla lainkaan.
6. **Optimistinen UI**: feed-reaction, kudos, friendship-accept, checkin-submit.
7. **Swipe-back gesture** detail-sivuille.
8. **Splash** lyhennys + paint-perfekti (mountti splashin alla).

**Vaihe C — Polish:**
9. iOS overscroll-lukitus + `font-display: optional`.
10. Haptic-mappi laajennetaan kaikkiin CTA-buttoneihin yhtenäisellä helperillä.
11. Tarkistus performance-profilerilla (long tasks ≤ 50 ms, INP ≤ 200 ms).

---

## Tekninen yhteenveto (devs)

- `App.tsx`: `<AppRoutes>` uudistuu — sisältää `<TabHost>` + `<ModalStack>` rinnan. AnimatePresence vain modal-stackiin.
- Uusi `src/components/TabHost.tsx`: renderöi 8 tab-sivua sisäkkäin `display:none|block` `data-active`-attributtien mukaan, käyttää `useLocation`a aktiivisen tabin valintaan.
- Uusi `src/components/ModalStack.tsx`: hallitsee push/modal-routet `AnimatePresence mode="popLayout"`:lla.
- `route-transitions.ts`: tab-variant duration 0; push/modal säilyy.
- `BottomNav`: pysyy nykyisellään (jo OK).
- `index.css`: globaali `.press`, `touch-action: manipulation`, `font-display: optional`.
- React Query: yhtenäinen `keepPreviousData`-helper `src/lib/query-defaults.ts`:ssä, käytetään isoilla useQueryillä.
- `use-route-scroll-memory.ts`: jätetään detail-sivuille; tab-sivut säilyttävät scrollin DOMissa luonnollisesti.
- Ei muutoksia sopimuksiin Supabasea kohti, ei uusia tauluja, ei uusia komponentteja UI-puolella.
