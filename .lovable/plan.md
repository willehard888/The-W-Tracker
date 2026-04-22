

# Koukuttavampi Referral Ladder — Apex & Legend palkinnoiksi

Nykyiset 5 milestone-tasoa (1, 3, 5, 10, 25) saavat lisäksi **Apex Instant** ja **Legend / Founders Circle** -kärkipalkinnot, joiden takia ihmiset oikeasti haluavat hustlata referraleja. Lisätään myös koukuttavampi UI: hero-progress, "next reward" lukko-counter, ja status-skin Apex/Legend-tasoille.

## 1. Uusi palkintotikkaiden rakenne

| Refs | Title | Reward | Status pop |
|---|---|---|---|
| 1 | First Recruit | +250 XP · First Recruit badge | 🎯 |
| 3 | 1 Month Free | 30 days membership credits | 🎟️ |
| 5 | 2 Months Free | 60 days credits · Brand Ambassador badge | 🥈 |
| 10 | **1 Month Apex Instant** | 30 days `is_apex_subscriber=true` (Apex tier locked + Tribe creation) · Inner Circle badge | ⚡ |
| 25 | Lifetime Membership | Forever member credits · Kingmaker badge | 👑 |
| **50** | **Founders Circle / Legend Status** | Permanent `is_apex_subscriber` + Legend-tier pin (immune to decay) + exclusive **Founders Circle** badge | 🔱 |

Kaksi korkeinta tasoa (10 ja 50) ovat aspirational drivers — Apex & Legend olivat ennen "kannustamattomia" tikkaiden ulkopuolella; nyt ne ovat the prize.

## 2. Backend (uusi migraatio)

`profiles` saa kaksi uutta saraketta:
- `apex_credits_until timestamptz` — Apex Instant -aikaikkuna (10 referrals → +30 päivää, kumulatiivinen)
- `legend_pinned boolean default false` — true kun 50 referrals saavutettu, lukitsee tier ≥ legend pysyvästi

`claim_referral` RPC laajennetaan:
- **10 ref** milestone → `apex_credits_until = GREATEST(now(), apex_credits_until) + 30 days`, asettaa `is_apex_subscriber=true` jos credits voimassa, antaa Inner Circle Founder -badgen
- **50 ref** milestone → `legend_pinned=true`, `is_apex_subscriber=true` pysyvästi (pidä true), antaa uuden **Founders Circle** -badgen, kutsuu `update_status_tier(user_id)` joka arvostaa pinnauksen

Sivuvaikutukset:
- `update_status_tier()` -funktioon lisätään yläpriority: jos `legend_pinned=true` → tier = `legend` (ei degradeta)
- Uusi cron / triggeri tai `has_active_access`-tarkistus laajennetaan huomaamaan `apex_credits_until > now()` jolloin `is_apex_subscriber` palautetaan trueksi (yhdenmukaisuus lifetime-creditien kanssa)
- Uusi badge-rivi: `paid_referrals` requirement_value 50 → "Founders Circle" badge

## 3. UI — `src/pages/Referrals.tsx`

### 3.1 Hero "Next Reward Lock"
Share-cardin alle uusi pinottu **Next Reward Card**:
- Iso gold/conic-progress-rinki jonka keskellä: `referralCount / nextMilestone` ja seuraavan palkinnon lyhyt teksti ("3 → 1 Month Apex")
- Microcopy alla: *"3 more recruits and you wear ⚡ Apex for 30 days"* — luo urgency
- Koko kortti gold-glow + `apex-conic-border` jos seuraava palkinto on 10 tai 50

### 3.2 Päivitetty Reward-tikas
- Tasot 10 ja 50 saavat **erityiskäsittelyn**:
  - **10 (Apex Instant)**: oranssi-kulta liukuväri-border, `apex-aura-large`-tyylinen glow, ⚡ Zap-ikoni 1-9-numerolaattojen sijaan, label "APEX INSTANT" gold/orange-gradientilla
  - **50 (Founders Circle)**: purple/gold/rose conic-border (Legend-tyyli), Crown+Sparkles -ikonipari, label "FOUNDERS CIRCLE" jewel-gradientilla, "🔱 Legend pin · Lifetime Apex" subteksti
- Lukitut korkeat tasot näyttävät silti mitä on tarjolla — "tease the prize" -periaate
- Progress bar `Next`-tasolle saa shimmer-pyyhkäisyn vain kahdelle ylätasolle (10/50) → erottaa premium-tavoitteet
- Ikonilaattojen koot kasvavat tasoittain (48 → 52 → 56 → 60 → 64 → 72) — visuaalinen hierarkia

### 3.3 Status counter
Stats-rivin kolmanneksi laatikoksi: **"Days as Apex"** — laskee `apex_credits_until - now()` päivinä jos > 0; muuten näyttää "Locked" ja näyttää 10:n etäisyyden.

### 3.4 Microcopy
- Otsikko: "Spread the Discipline" → **"Recruit Your Way to Legend"**
- Alaotsikko: "Share the movement. Earn rewards." → **"Every paid friend pulls you closer to Founders Circle"**
- Top-of-card teaser jos ref ≥ 25 mutta < 50: kovavalo-banner *"You're in the Lifetime club. 25 more for permanent Legend."*

## 4. Muutettavat / luotavat tiedostot

**Backend:**
- Uusi SQL-migraatio:
  - `ALTER TABLE profiles ADD apex_credits_until timestamptz, legend_pinned boolean default false`
  - Päivitetty `claim_referral` (10 & 50 milestones)
  - Päivitetty `update_status_tier` (kunnioittaa `legend_pinned`)
  - Päivitetty `has_active_access` / `is_apex_subscriber`-syncti (apex_credits_until)
  - Insert: uusi badge "Founders Circle" `paid_referrals` = 50 (+ varmistetaan että nimet täsmäävät: "Inner Circle Founder" jo olemassa 10:lle)

**Frontend:**
- `src/pages/Referrals.tsx` — uusi rewards-array (6 tasoa), Next Reward hero card, premium-skin tasoille 10 ja 50, päivitetty stats, microcopy
- `src/hooks/use-referral-stats.ts` — palauttaa `apexCreditsUntil`, `legendPinned`
- `.lovable/memory/monetization/membership.md` — lisätään referral-paths Apex/Legendiin

### Ei muuteta
- `referrals`-taulu, claim-referral edge function (RPC sisäisesti laajenee, kutsuminen ennallaan)
- TopInvitersWidget, `/profile`-sivu, Tier Ladder, Tribe Battles, paywall-hinnat
- Stripe / RevenueCat-virrat (referral-pohjainen Apex/Legend on rinnakkainen, ei korvaa maksuja)

