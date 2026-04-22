

# Täydellinen UI — Final Polish Pass

Vie koko app valmiiksi tuotteeksi: yhtenäinen materiaali, hierarkia ja viimeistely jokaisella sivulla. Ei animaatiomuutoksia, ei layoutin uusimista — pelkkä lopullinen craft-passi joka tekee apista yhden teoksen.

## 1. Globaali viimeistely (`src/index.css`)

- **Scrollbar**: pinotaan kaikkialle 6px leveä obsidian-scrollbar gold-soft-thumbilla — nyt karkaa default-selainstyyliin sivuilla joissa on pitkä lista (Leaderboard, Tribes, Coach).
- **Selection**: `::selection` → gold/25% pohja, foreground tumma — nyt default-sininen riitelee teeman kanssa.
- **Focus-ring globalisti**: kaikki interaktiiviset elementit (linkit, inputit, menut) saavat saman pehmeän gold-ringin kuin Button. Yksi `:focus-visible` lisäys.
- **Image rendering**: avatareille ja badge-kuville `image-rendering: -webkit-optimize-contrast` jotta retina-pakkaus ei nakerra reunoja.
- **Body antialias**: pakotetaan `-webkit-font-smoothing: antialiased` + `text-rendering: optimizeLegibility` koko appiin — fontit terävöityvät iOS:ssä.
- **Safe-area paddingit** standardoidaan: `--safe-top`, `--safe-bottom` muuttujat. Kaikki sticky/fixed-elementit (StatusHeader, BottomNav, modaalien close) lukevat näistä.

## 2. Komponenttitason yhdenmukaistus

**Card-perhe (`ui/card.tsx`):**
- Pakotetaan käyttämään `surface-panel`-utiliteettia oletuksena. `CardHeader` saa hairline-alaviivan automaattisesti, `CardFooter` hairline-yläviivan. Nyt ne ovat satunnaisia bordereita per call-site.

**Dialog & Sheet (`ui/dialog.tsx`, `ui/sheet.tsx`, `ui/drawer.tsx`):**
- Sisältö → `surface-glass` pohja. Overlay tummennus `black/72%` + `backdrop-blur-md`. Close-X → `Button variant="ghost" size="icon-sm"`. DialogTitle → `text-display-md`, DialogDescription → `text-body` `--foreground-muted`.

**Avatar (`ui/avatar.tsx`):**
- Lisätään 1px sisäinen ringi `white/8%` + 1px ulkoinen `black/40%` jotta avatarit irtoavat taustasta yhtenäisesti — nyt jotkut "kelluvat" tasaisesti, jotkut on jo manuaalisesti reunustettu.

**Toast & Sonner (`ui/sonner.tsx`):**
- Sonner-toastit → `surface-glass` pohja, hairline-border, gold-ikoni success-tilaan, destructive-väri error-tilaan. Position: `top-center` mobiilissa jotta ei mene BottomNavin alle.

**Tooltip (`ui/tooltip.tsx`):**
- Pohja `surface-panel`, hairline border, `text-caption`-ladunnus.

**Skeleton (`ui/skeleton.tsx`):**
- Vaihdetaan harmaa pulssi obsidian-shimmer-gradientiksi (muuttumaton keyframen suhteen, vain värit) — sopii teemaan.

**Switch, Checkbox, Radio (`ui/{switch,checkbox,radio-group}.tsx`):**
- Off-tila: `surface-inset`. On-tila: `gold` metalligradientti samalla reseptillä kuin Button. Antaa lomakkeisiin saman painavan tunteen.

**Select & Dropdown (`ui/{select,dropdown-menu,popover,command}.tsx`):**
- Trigger → `outline` Button-tyyli. Content panel → `surface-glass`, hairline border, item-hover `white/4%` + `text-foreground`. Item active → gold-tint vasen 2px reuna.

**Tabs (`ui/tabs.tsx`):**
- TabsList → `surface-inset` pill-container. Active TabTrigger → gold-metalligradientti pill (sama kuin Button `pill+gold`). Inactive → `--foreground-muted`.

**Slider (`ui/slider.tsx`):**
- Track `surface-inset`, range gold-gradientti, thumb gold-pallo `shadow + ring`.

**Progress (`ui/progress.tsx`):**
- Indicator gold-gradientti default. Tier-prop tapauksissa käyttää `--tier-color`-muuttujaa.

**Separator (`ui/separator.tsx`):**
- Aina `hairline`-utiliteetti, ei enää solid border.

## 3. Sivukohtainen viimeistely

**Hero (`Index.tsx`, `home/*`):**
- StatusHeader: title → `text-display-lg`, alaviiva hairline. Tier-badge → standardisoitu pill.
- CommandDeck, RankProgressHub, CoachStrip: kaikki `surface-glass` hero-cardeina, sisäiset rivit `surface-panel`.
- Caption-tekstit kaikki `text-caption`-luokkaan.
- DailyStatusPulse, StreakDisplay → kortin pinta yhtenäisesti.

**Auth, Onboarding, Paywall:**
- Otsikot → `text-display-xl` (Auth/Paywall hero), `text-display-lg` (Onboarding stepit).
- Inputit jo `surface-inset`. Lisätään hairline-erotin "or"-divideriin gradient-versiona.
- Paywall: tier-cardit (`PaywallTierCard`) saavat saman `surface-glass`-pohjan + gold/tier-button v2.
- Onboarding: stepin alanavi hairline-yläviiva, indikaattorit gold-gradientti aktiiviselle.

**Profile-perhe (`Profile`, `PublicProfile`, `UserProfile`):**
- Header → `surface-glass` hero. Stat-tiles (XP, Streak, Rank, Badges) → `surface-panel`, ikonit `--foreground-muted`, arvot `text-display-md`, labelit `text-caption`.
- Tabs ladun yli (Overview / Activity / Badges / Posts) → uusi Tabs-tyyli.
- Action-rivi (Edit, Share, Settings) → Button-variantit kunnolla (jo edellisessä passissa).
- Settings-sektion rivit → `surface-panel` listana, hairline-erottimet.

**Leaderboard & TribeLeaderboard:**
- Period switcher → uusi Tabs (gold pill active).
- Top-3 podium → `surface-glass` korotetut kortit, 1./2./3. paikka tier-väreillä reunalla (vain reuna, ei taustaa — pitää teemarauhan).
- Listarivit → `surface-panel`, hairline-erotin, position-numero `text-display-md` `--foreground-muted`, käyttäjätieto oikein typografioitu.
- Hall of Champions → erillinen `surface-glass` -sektio.

**Tribes-perhe:**
- `Tribes.tsx`: hero search → `surface-inset` input, tribe-kortit `surface-panel` grid. Featured tribe → `surface-glass`.
- `TribeDetail.tsx`: header `surface-glass`, member-list `surface-panel` rivit, action-bar hairline yläviiva.
- `TribeNew.tsx`: form-cardit `surface-panel`, submit `gold xl`.
- Tribe modaalit (Manage, Pending, Reports, Invite, Challenge): kaikki Dialog-päivityksen myötä yhtenäisiä.
- TribePostCard, TribeBattleCard, TribeChallengeModal: `surface-panel` runko, gold-action.

**Battles & TribeBattles:**
- Active battle hero → `surface-glass` + tier-värinen gold-corner-glow vain head-to-headissa.
- Battle-listat → `surface-panel` rivit. HeadToHead vs-näyttö keskelle hairline-jakoviiva.
- LiveRivals widget → `surface-panel` strip, gold-aksentti score-eroon.

**Coach & WeeklyBriefing & EliteFeed:**
- Coach: chat-bubblet → user `surface-panel` + hieno gold-soft border, AI `surface-glass`. Inputin pohja jo `surface-inset`. Quick-prompt chipit → uusi Tabs/pill.
- WeeklyBriefing: hero metric-cardit `surface-glass`, body sections `surface-panel`. Share-CTA `gold xl`.
- EliteFeed: post-cardit `surface-panel`, media full-bleed kortin yläosaan, kudos-CTA `pill + gold-outline`. Composer `surface-inset`.

**Messages & Chat:**
- Messages-lista → `surface-panel` rivit, viimeisin viesti `--foreground-muted`, aikaleima `text-caption`. Search `surface-inset`.
- Chat: vastaanotetut `surface-panel`, lähetetyt soft gold tint (`gold/12%` tausta + foreground gold-shaded). Composer `surface-inset` baari.

**DailyCheckin:**
- Stepin runko `surface-glass`. Aktiviteetti-chipit → `pill` Button (toggle: outline / success).
- Submit → `gold xl loading`-prop hyödynnettynä.

**Modaalit/celebrations:**
- LevelUp, EliteUnlock, TierPromotion, BadgeUnlock, StoryShare, Briefing → kaikki kortit `surface-glass` keskellä, hairline-erottimet, primary CTA `gold xl`, secondary `glass`. Animaatioiden keyframet ennallaan.

## 4. Tila-empty/error/loading -ilmeet

- **Empty states**: yhtenäinen layout (ikoni 28px `--foreground-faint`, otsikko `text-display-md`, kuvaus `text-body` `--foreground-muted`, primary CTA `gold` size lg) — käytetään Tribes/Messages/Battles/EliteFeed/Coach kun lista tyhjä.
- **Error states**: punainen ikoni, `text-display-md`, retry-CTA `outline`.
- **Loading skeletonit**: kaikki listat käyttävät uutta Skeleton-shimmeriä — yhdenmukainen.

## 5. Mitä EI muuteta

- Animaatiot, keyframet, framer-motion, page-transitionit — ennallaan.
- Layout, sivurakenne, navigointi, reititys — ennallaan.
- Backend, RLS, edge functionit, auth — ei kosketa.
- BrandLogo, AppLogoHeader, SplashScreen, AppleSignInButton — säilyttävät erikoistyylinsä.
- Button-variantit jo viimeistelty edellisessä passissa, niiden API ja tyyli pysyy.

## Tiedostot

**UI primitiivit:**
- `src/index.css` — scrollbar, selection, focus-visible, antialias, safe-area
- `src/components/ui/{card,dialog,sheet,drawer,avatar,sonner,tooltip,skeleton,switch,checkbox,radio-group,select,dropdown-menu,popover,command,tabs,slider,progress,separator}.tsx`

**Sivut (visuaalinen passi):**
- `src/pages/{Index,Auth,Onboarding,Paywall,Profile,PublicProfile,UserProfile,Leaderboard,TribeLeaderboard,Tribes,TribeDetail,TribeNew,Battles,TribeBattles,Coach,WeeklyBriefing,EliteFeed,Messages,Chat,DailyCheckin,Referrals,WeeklyBriefing}.tsx`

**Komponentit:**
- `src/components/{StatusHeader,LevelCard,StatCard,TierLadder,RankPressureCard,BadgeCard,BadgeShowcase,TribePostCard,TribeBattleCard,LiveRivals,HeadToHead,ProfileActivityPulse,StreakDisplay,XpCounter,InviteCTA,CoachNudgeCard,DailyQuests,DailyStatusPulse,EliteFeedTeaser,TierRiskBanner,TopInvitersWidget,TopTribesWidget,FeatureGateScreen,RouteFallback,BadgeUnlockModal,LevelUpCelebration,EliteUnlockCelebration,TierPromotionCelebration,StoryShareModal,BriefingShareCard,TribeChallengeModal,TribeInviteModal,TribeManageDialog,TribePendingRequestsDialog,TribeReportsDialog}.tsx`
- `src/components/home/{CommandDeck,RankProgressHub,CoachStrip,CompactStreakPanel,SegmentedTabs,Reveal}.tsx`

Painopiste high-impact-näytöissä (Hero, Profile, Leaderboard, Tribes, Coach, Paywall, modaalit). UI-primitiivien päivitys vie koko apin samaan ilmeeseen automaattisesti — myös sivut joita emme erikseen muokkaa.

