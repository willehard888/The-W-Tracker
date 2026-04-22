

# Premium Buttons — Polish Pass v2 + Page-by-Page Audit

Vie napit huippuunsa ja varmista että jokainen sivu hyödyntää uutta järjestelmää. Ei animaatiomuutoksia, ei layout-muutoksia.

## 1. `button.tsx` — viimeistely seuraavalle tasolle

**Materiaaliparannukset:**

- **`default`** (obsidian): lisätään hienovarainen sisäinen vinjetti `inset 0 0 18px hsl(0 0% 0% / 0.25)` jotta keskikohta tummenee reunoja vasten — antaa "kuperan" napin tunteen. Yläspekkulaarinen highlight muutetaan kahteen viivaan: `0px white/14%` + `1px white/4%` jolloin nappi näyttää pyöristetyltä reunoilta.

- **`gold`**: lisätään ohut sisäinen lämmin sävy alaosaan `inset 0 -8px 18px -8px hsl(28 90% 35% / 0.55)` joka antaa kullalle aitoa metallin syvyyttä — kuten valettu kulta heijastaa lämpimämpää alapuolelta. Yläspekkulaarinen viiva tulee kahdesta kerroksesta: `inset 0 0.5px 0 white/65%` + `inset 0 1px 0 white/15%`. Disabled state lisää `grayscale-[0.3]` jotta nuhraantunut kulta näyttää oikeasti kuluneelta.

- **`destructive`**: sama vinjetti-resepti kuin defaultilla mutta punaisena.

- **`outline`**: korvataan static border gradient-hairline-bordilla: `border-image: linear-gradient(180deg, hsl(border-strong/0.9), hsl(border/0.5)) 1`. Tämä tekee reunasta valmiiksi 3D:n ilman extra shadowia.

- **`ghost`**: hover-tilaan lisätään `1px sisäinen ylähighlight white/6%` jotta hover-nosto tuntuu materiaaliselta eikä pelkältä värilaikulta.

- **`glass`**: lisätään saturate-fallback `backdrop-saturate-150` jotta lasi todella suodattaa taustan värejä, ei vain himmennä.

- **`tier`**: tarjoaa vaihtoehtoiset CSS-muuttujat `--tier-color` ja `--tier-color-deep` joista jälkimmäinen tummempaan alapintaan. Komponentti voi asettaa nämä parentista `style={{ "--tier-color": "...", "--tier-color-deep": "..." }}`-propilla.

**Uudet variantit:**

- **`success`**: vihreä metalli-resepti (`140 55% 38% → 140 60% 26%`) — käytetään confirm-painikkeissa (Battles accept, Tribe approve, Quest claim).
- **`warning`**: amber-metalli (`38 90% 52% → 38 80% 38%`) — käytetään riskinotto-CTA:issa (decline, leave tribe, demote-warningit).
- **`danger-outline`**: hairline destructive-väriltä, läpinäkyvä pohja — käytetään delete-account, leave-tribe, withdraw-battle -toiminnoissa joissa destructive on liian vahva.

**Koot:**

- Lisätään `pill` -kokovariantti (h-9, px-5, rounded-full) chipeille ja toolbar-actioneille (Leaderboard period switch, Tabs, filter chips). Tällä hetkellä ne ovat custom buttoneita — saadaan yhdenmukaiset.
- `xl` saa `font-display`-ladun automaattisesti jotta hero-CTA:t (Paywall, Onboarding) hyödyntävät Space Groteskia.

**Mikrointeraktion viimeistely (ei uusia animaatioita):**

- Lisätään `[&:active>span]:translate-y-[0.5px]` napin sisältöön — sisältö "painuu" 0.5px alas samalla scale-transformilla. Hyödyntää olemassa olevaa `transition-[transform]`-listausta.
- Disabled-tilaan `cursor-not-allowed` jotta kursori antaa palautteen.

## 2. Sivukohtainen audit — varmistetaan että jokainen sivu hyötyy

Käydään jokainen sivu läpi ja vaihdetaan ad-hoc napit oikeisiin variantteihin. Vain `<button>`/`<Button>` -kutsujen variantti/koko-vaihtoja, ei layoutia tai logiikkaa.

**Auth & Onboarding:**
- `Auth.tsx` — primary login → `gold` xl, secondary "back" → `ghost`.
- `Onboarding.tsx` — "Continue" → `gold` xl, "Skip" → `ghost`.
- `Paywall.tsx` — varmistetaan että jokainen tier-CTA käyttää joko `gold` (Elite) tai `tier` (Apex) varianttia. `Restore purchases` → `link`. Close → `icon-sm` + `ghost`.

**Hero & koti:**
- `Index.tsx` (CommandDeck, RankProgressHub) — kaikki "Open" / "View" → `outline` size sm. Pääsy paywalliin → `gold`. Loading-tilat käyttävät `loading`-propia.
- `CoachStrip.tsx`, `CoachNudgeCard.tsx` — "Open coach" → `glass` size sm.

**Profile-perhe:**
- `Profile.tsx` — Edit → `outline`, Logout → `danger-outline`, Delete account → `destructive`. Settings rows → `secondary` size sm.
- `PublicProfile.tsx`, `UserProfile.tsx` — Add friend → `gold-outline`, Message → `outline`, Block → `danger-outline`, Share → `glass` icon.

**Leaderboard & Tribes:**
- `Leaderboard.tsx`, `TribeLeaderboard.tsx` — period switcher chipit → `pill` koko + `secondary`/`gold` aktiiville. "Join" → `gold`, "View" → `outline`.
- `Tribes.tsx` — Create tribe → `gold`, Search → `outline`. Filter chipit → `pill`.
- `TribeDetail.tsx` — Join → `gold`, Leave → `danger-outline`, Invite → `gold-outline`, Manage → `outline`. Approve/decline pending → `success`/`warning`.
- `TribeNew.tsx` — Submit → `gold` xl, Cancel → `ghost`.

**Battles:**
- `Battles.tsx`, `TribeBattles.tsx` — Challenge → `gold`, Accept → `success`, Decline → `warning`, Submit proof → `gold-outline`. View → `outline`.
- `TribeBattleCard.tsx`, `HeadToHead.tsx`, `LiveRivals.tsx` — kaikki action-napit samaan järjestelmään.

**Coach, Briefing, Feed:**
- `Coach.tsx` — Send → `gold` `icon-lg` + `Send` ikoni, Clear → `ghost` `icon-sm`. Quick prompts → `pill` + `secondary`.
- `WeeklyBriefing.tsx` — Generate → `gold` xl, Share → `glass`.
- `EliteFeed.tsx` — Post → `gold-outline`, Kudos → `pill` + `gold-outline`, Comment send → `gold` `icon-sm`.

**Messages & Chat:**
- `Messages.tsx` — Compose → `gold` `icon-lg`, search clear → `ghost` `icon-sm`.
- `Chat.tsx` — Send → `gold` `icon-lg`, attach → `glass` `icon-sm`. Back → `ghost` `icon-sm`.

**Daily check-in & quests:**
- `DailyCheckin.tsx` — Submit → `gold` xl + `loading`, Cancel → `ghost`. Toggle-chipit (toiminnot kuten "Workout", "Meditation") → `pill` + `outline`/`success` (active).
- `DailyQuests.tsx`, `home/CommandDeck.tsx` — Claim → `gold` size sm + `loading`.

**Modaalit ja dialogit:**
- `BadgeUnlockModal.tsx`, `LevelUpCelebration.tsx`, `EliteUnlockCelebration.tsx`, `TierPromotionCelebration.tsx`, `StoryShareModal.tsx`, `BriefingShareCard.tsx` — primary close/share → `gold`, secondary → `glass`. Ei animaatioiden koskemista.
- `TribeChallengeModal.tsx`, `TribeInviteModal.tsx`, `TribeManageDialog.tsx`, `TribePendingRequestsDialog.tsx`, `TribeReportsDialog.tsx` — Confirm → `gold`, Cancel → `ghost`, Destructive → `destructive`/`danger-outline`.
- `TierLadder.tsx` — paywall CTA jo käyttää `TierUnlockPaywallCard`-komponenttia; vaihdetaan se `gold` xl-nappiin samalla resepti­logiikalla.
- `TierUnlockPaywallCard.tsx`, `PaywallTierCard.tsx` — vaihdetaan custom-luokat `gold`/`tier`-variantteihin niin että ne perivät kaikki materiaalipäivitykset.

**Pikkukomponentit jotka hyötyvät automaattisesti:**
- `InviteCTA`, `XpCounter` claim-CTA, `RankPressureCard` action, `TopInvitersWidget`, `TopTribesWidget`, `EliteFeedTeaser`, `TierRiskBanner`, `BadgeShowcase` "View all" — kaikissa `<Button>`-kutsut variant-passi.

**iOS-specifit (`AppleSignInButton.tsx`, `AccessGate.tsx`):**
- AppleSignInButton säilyttää oman natiivityylinsä (Applen guideline). Vaihtoehtoiset CTA:t alle → `glass` xl.
- AccessGate "Become Elite" → `gold` xl, "Restore" → `link`.

## 3. Mitä EI muuteta

- Ei muutoksia `button.tsx`-propsien APIin (kaikki nykyiset call-sitet jatkavat toimintaansa).
- Ei animaatioita, ei keyframeja, ei framer-motion-säätöä.
- Ei layoutin tai sivurakenteen muutoksia.
- `BottomNav`, `StatusHeader`, `BrandLogo`, `AppLogoHeader`, `SplashScreen` — omat erikoistyylit säilyvät.
- AppleSignInButton — natiivin näköinen.
- Backend, RLS, edge functionit — ei kosketa.

## Tiedostot

- `src/components/ui/button.tsx` — uudet variantit (`success`, `warning`, `danger-outline`), uusi `pill` koko, materiaaliviimeistely, mikrointeraktion painautuminen, disabled grayscale.
- Sivut & komponentit (variant-vaihto):
  - `src/pages/{Auth,Onboarding,Paywall,Profile,PublicProfile,UserProfile,Leaderboard,TribeLeaderboard,Tribes,TribeDetail,TribeNew,Battles,TribeBattles,Coach,WeeklyBriefing,EliteFeed,Messages,Chat,DailyCheckin}.tsx`
  - `src/components/{TierLadder,TierUnlockPaywallCard,PaywallTierCard,TribeBattleCard,HeadToHead,LiveRivals,DailyQuests,InviteCTA,XpCounter,RankPressureCard,TopInvitersWidget,TopTribesWidget,EliteFeedTeaser,TierRiskBanner,BadgeShowcase,BadgeUnlockModal,LevelUpCelebration,EliteUnlockCelebration,TierPromotionCelebration,StoryShareModal,BriefingShareCard,TribeChallengeModal,TribeInviteModal,TribeManageDialog,TribePendingRequestsDialog,TribeReportsDialog,AccessGate,CoachNudgeCard}.tsx`
  - `src/components/home/{CommandDeck,RankProgressHub,CoachStrip}.tsx`

Käydään realistinen subset — keskitytään korkean näkyvyyden CTA:ihin (Paywall, Auth, Coach, Tribes, Battles, Leaderboard, modaalit). Pikkukomponentit perivät tyylin automaattisesti `<Button>`-kutsujen kautta heti kun variant on oikea.

