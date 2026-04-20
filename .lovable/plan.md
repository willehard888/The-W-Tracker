

## Hard paywall + 7 päivän koukuttava kokeilu (RevenueCat-fokus)

Lukitaan koko app 7 päivän ilmaisen kokeilun taakse. RevenueCat hoitaa maksuflow'n iOS-puolella (Stripe vain webissä). Trial muutetaan 9→7 päivään ja appi tehdään psykologisesti koukuttavaksi: jokainen päivä jättää selvän jäljen, FOMO kasvaa loppua kohti, ja päättymispäivänä lukko iskee.

### 1. RevenueCat-integraation viimeistely

**Mitä on jo paikallaan:**
- `RevenueCatContext` lataa packages, hoitaa `purchase`, `purchaseProduct`, `restorePurchases`
- `revenuecat-webhook` edge function käsittelee `INITIAL_PURCHASE`, `RENEWAL`, `EXPIRATION`, `CANCELLATION`, `BILLING_ISSUE` → päivittää `profiles.is_elite`
- `Paywall.tsx` käyttää RC:tä natiivilla, Stripeä webissä

**Mitä viimeistellään:**
- **App User ID -alignment:** Varmistetaan että RevenueCat-konteksti kutsuu `Purchases.logIn(user.id)` heti kun Supabase-user on saatavilla, jotta webhookin `app_user_id` matchaa Supabase-user_id:n. Tarkistetaan tämä `RevenueCatContext`:istä — jos puuttuu, lisätään.
- **Trial-tilan luku RC:ltä:** Lisätään `customerInfo.entitlements.active.elite.willRenew` ja `periodType === 'trial'` -lippujen luku RC-konteksiin, jotta UI voi näyttää "RC trial active" -tilan natiivilla (ei sekoiteta omaan 7 päivän appitrialiin)
- **Webhook täydennys:** Lisätään `SUBSCRIPTION_PAUSED` ja `PRODUCT_CHANGE` käsittely + logataan `entitlement_id` debugia varten
- **Restore-flow viimeistely:** Restoren jälkeen pakotetaan `checkSubscription()` + näytetään selkeä toast onnistumisesta/ei-tilauksesta

### 2. Trial-pituuden muutos 9 → 7 päivää

- SQL-migraatio: `has_active_access` → `interval '7 days'`
- `useTrialAccess.ts`: `TRIAL_DURATION_DAYS = 7`
- Kaikki "9 days" → "7 days" copyt

### 3. Trial-banneri koko appiin (intensifioituu päivittäin)

Uusi `TrialBanner` `StatusHeader`:n alle. Klikkaus → `/paywall`. Piilotettu Eliteltä ja auth/legal-reiteiltä.

| Päivät | Tyyli | Teksti |
|---|---|---|
| 7 | Subtle gold | "7 days free — explore everything" |
| 5–6 | Gold pulse | "X days left in your free trial" |
| 3–4 | Amber pulse | "Only X days left — lock in Elite" |
| 1–2 | Red, tuntilaskuri | "Trial ends in Xh — don't lose your streak" |
| 0 | Red, sekuntilaskuri | "Trial ends at 23:59 — Upgrade now" |

### 4. Koukuttavat trial-momentit

**A) Index-sivun `TrialProgressCard`:** 7 ympyrää (päivittäin täyttyvä), iso "Lock it in" CTA (gold, pulse päivänä 5+), näyttää konkreettisesti mitä menettää: "X XP earned · Y day streak · Z badges"

**B) Daily check-in -toast:** "Day X/7 done. After 7 days, only Elite members keep their streak alive."

**C) Feature-teasers:**
- Battles: "Battle wins won't count after trial — go Elite"
- Leaderboard: trial-rivit himmenevät viimeisinä päivinä, "Fading out in Xd" tooltip

**D) Push-notifikaatiot — uusi edge function `trial-nudge` (pg_cron 10:00 UTC päivittäin):**
- Päivä 3: "You're 3 days in. Streak: X. Don't break it."
- Päivä 5: "2 days left. Lock in Elite for €4.99/mo."
- Päivä 6: "Tomorrow your trial ends. Your X-day streak goes with it."
- Päivä 7: "Last day. Continue with Elite to keep everything."

### 5. Paywall-sivun expired-tila

`Paywall.tsx` saa kaksi tilaa:

**A) Trialissa (hasAccess):** yläbanner "X days free trial active", pehmeä CTA, "Maybe later" vie Indexiin

**B) Trial päättynyt (isExpired && !isElite):**
- Hero punaisena: "Your free trial has ended"
- Streak/XP/badges näytetään "FROZEN" -leimalla
- VAIN yksi gold-CTA: "Continue with Elite — €4.99/mo"
- Ei "Maybe later" -linkkiä — vain Sign out alimpana (App Store -vaatimus)
- Native: kutsuu RevenueCat `purchase()`. Web: Stripe checkout.

### 6. AccessGate + BottomNav -lukitus

- `AccessGate` toimii jo — vain trial-pituus muuttuu
- `BottomNav` piilotetaan kun `isExpired && !isElite` (käyttäjä näkee VAIN paywallin)
- `App.tsx`: `TrialBanner` `StatusHeader`:n perään, BottomNav conditional

### 7. Onboarding + demo-tili

- Onboarding viimeisellä stepillä: "7 days completely free · Then €4.99/month · Cancel anytime · No credit card required to start"
- SQL: `demo@thewtracker.com` → `is_elite = true` (App Store -tarkistaja)

### Tekninen yhteenveto

```text
Signup → trial_started_at = now() → Purchases.logIn(user.id)
   │
   ├─ Päivä 1–4: gold banner + progress card
   ├─ Päivä 5–6: amber pulse + push notifications
   ├─ Päivä 7: red countdown + "Last day" push
   └─ Päivä 8+: AccessGate → /paywall (expired, FROZEN-leimat)
        │
        ├─ Native: RevenueCat purchase() → webhook → is_elite=true
        └─ Web:    Stripe checkout    → webhook → is_elite=true
              │
              └─ has_active_access=true → täysi pääsy palautuu
```

### Tiedostot

**Uudet:**
- `src/components/TrialBanner.tsx`
- `src/components/TrialProgressCard.tsx`
- `supabase/functions/trial-nudge/index.ts`
- `supabase/migrations/<ts>_trial_7_days_demo_elite.sql`

**Muokattavat:**
- `src/contexts/RevenueCatContext.tsx` (logIn alignment, trial-info exposure, varmistetaan että `customerInfo` haetaan login-yhteydessä)
- `src/hooks/use-trial-access.ts` (7 päivää, urgencyLevel)
- `src/components/AccessGate.tsx` (BottomNav-flag expired-tilassa)
- `src/App.tsx` (TrialBanner + conditional BottomNav)
- `src/pages/Paywall.tsx` (expired-tila, FROZEN-leimat)
- `src/pages/Index.tsx` (TrialProgressCard)
- `src/pages/DailyCheckin.tsx` (trial-toast)
- `src/pages/Onboarding.tsx` (7 days free copy)
- `supabase/functions/revenuecat-webhook/index.ts` (PAUSED + PRODUCT_CHANGE + parempi loggaus)

### Mitä EI tehdä
- Ei muuteta hintaa (€4.99/mo)
- Ei pakoteta maksukorttia rekisteröinnissä (soft trial)
- Ei lisätä uusia maksutapoja

