

# Suunnitelma: Tee referral-loopista rahakone

Nykyisessä referral-systeemissä on 3 kriittistä vikaa: (1) `?ref=`-parametria ei tallenneta mihinkään signupin yhteydessä, (2) `referrals`-tauluun ei synny rivejä, (3) palkintoja ei jaeta automaattisesti. Eli koko loop on rikki. Korjataan + muutetaan malli aidoksi referral-rahakoneeksi.

---

## Ydinmalli: molemminpuolinen + konversiopohjainen

**Kutsuttu saa:** 14 päivän trial (normaalin 7 sijaan) → matalampi kynnys liittyä.
**Kutsuja saa:** porrastetut palkinnot, joista isoimmat laukeavat vasta **kun kutsuttu maksaa** ensimmäisen kuukauden.

```text
Kutsuttu signup (vahvistettu sähköposti)  →  kutsuja saa pienen XP-bumpin
Kutsuttu maksaa 1. kuun (€4.99)           →  kutsuja saa iso palkinto + cash-credit
```

Cash-credit = ilmainen kuukausi (= €4.99 arvoa) per 3 maksavaa kutsuttua. Skaalautuu:

| Maksavat kutsutut | Palkinto kutsujalle |
|---|---|
| 1 | +250 XP + "Recruiter"-badge |
| 3 | **1 kk ilmainen membership** (credit) |
| 5 | 2 kk ilmainen + "Ambassador"-badge |
| 10 | 6 kk ilmainen + Founder-status + profiiliglow |
| 25 | **Lifetime free membership** + Legend-badge |

Signup-palkinto (ei maksua): +50 XP kutsujalle per vahvistettu uusi tili (spam-suoja: cap 20/kk).

---

## 1. Korjataan tracking (pakollinen pohja)

**Auth.tsx:** Kun `signUp` onnistuu ja URL:ssa on `?ref=<code>`, tallennetaan `ref`-koodi `localStorage`iin `pending_referral_code`-avaimella (ennen email-vahvistusta tiliä ei vielä ole).

**Uusi edge function `claim-referral`:** Kutsutaan kerran onnistuneen sisäänkirjautumisen jälkeen jos `pending_referral_code` löytyy. Tekee:
1. Etsii `referrer_id` = `profiles.user_id WHERE referral_code = :code`.
2. Validoi: ei self-referral, user ei jo ole `referred_by`-kentässä.
3. `UPDATE profiles SET referred_by = referrer_id WHERE user_id = :new_user`.
4. `INSERT INTO referrals (referrer_id, referred_id)` (unique `referred_id`).
5. Myöntää +50 XP kutsujalle + tarkistaa signup-milestonet.
6. Palauttaa onnistumisen → client tyhjentää `localStorage`.

**Trial-extensio:** Jos `referred_by IS NOT NULL`, `trial_started_at`-logiikka käyttää 14 päivää 7:n sijaan. Toteutetaan päivittämällä `has_active_access`: `trial_started_at > now() - interval (CASE WHEN referred_by IS NULL THEN '7 days' ELSE '14 days' END)`.

## 2. Konversiopalkinnon laukaisu

Webhookit (RevenueCat + Stripe) päivittävät jo `is_elite = true` kun maksu onnistuu. Lisätään niihin loppuun kutsu uudelle RPC:lle `reward_referral_conversion(user_id)`:

```sql
-- pseudo
IF user.referred_by IS NOT NULL 
   AND NOT EXISTS (converted=true in referrals WHERE referred_id=user)
THEN
  UPDATE referrals SET converted=true, converted_at=now() WHERE referred_id=user;
  INCREMENT profiles.referral_count WHERE user_id=referrer;
  GRANT +500 XP to referrer;
  CHECK milestone thresholds → grant credits/badges atomically
END IF;
```

Uusi sarake: `referrals.converted boolean default false`, `referrals.converted_at timestamptz`. Pidetään `rewarded` legacy-yhteensopivuuden vuoksi.

## 3. Cash credits (ilmaiset kuukaudet)

Uusi taulu `membership_credits`:
- `user_id`, `months_credited int`, `source text ('referral')`, `consumed boolean default false`, `created_at`, `consumed_at`, `expires_at`.
- RLS: user näkee omat.

`has_active_access` laajennetaan tarkastamaan myös: onko ei-kulutettua, ei-vanhentunutta credit-riviä → palauttaa `true`. Kulutus: päivittäinen cron (tai "lazy" kulutus kun käyttäjä avaa appin ja ei ole muuta aktiivista oikeutta → consume one credit, set `consumed_at = now()`, anna 30 päivää lisää accessia merkitsemällä uusi `credit_active_until`-kenttä profiles-tauluun).

Yksinkertaisempi ratkaisu (valitaan tämä): lisätään `profiles.membership_credits_until timestamptz nullable`. Kun myönnetään N kuukautta, asetetaan `GREATEST(now(), current_value) + N*30 days`. `has_active_access` tsekkaa: `OR membership_credits_until > now()`. Yksi kenttä, zero cron-tarvetta.

## 4. UI: tee se näkyväksi ja palkitsevaksi

**Paranneltu `Referrals.tsx`:**
- Hero: "**€X earned this month**" — lasketaan `converted = true` × €4.99 (bruttoarvo kutsujalle, esitetään "Your friends' value to the community").
- Kaksi erillistä statistiikkaa: **Signups** (kpl) + **Converted** (maksanut kpl) — korostaa että oikea kullannuppu on maksavat.
- Milestone-kortit näyttävät paitsi kpl myös **kuinka monta puuttuu** ja progress-bar.
- **Credits banner:** jos `membership_credits_until > now()`, näytetään kullanvärinen "🎁 **Free until 18 May** (next payment auto-skipped)".
- **Shared-leaderboard-teaser:** "Top Inviters this month" — top 10 kutsujaa. Kilpailu + social proof.

**Uusi komponentti `InviteCTA` (BottomNav-yläpuolella Index-sivulla viikoittain):**
- Rotatoiva viesti: "Invite 1 friend → they get 14 days trial, you get +50 XP" / "3 paying friends = 1 month free for you".
- Yksi tap → Referrals-sivu.
- Näytetään vain kun `referral_count < 3` (ei spämmiä jo aktiivisille).

**Share-sisältö upgrade:**
- Uusi query param ladattuun jakolinkkiin sisältää käyttäjänimen: `/auth?ref=<code>&from=<username>`.
- Signup-sivulla näytetään: "**@juha** invited you → **14-day free trial** (normally 7)" — dopamiini kutsutulle.
- Edge function `og-invite`: generoi käyttäjäkohtainen OG-kuva ("Join @juha on The W Tracker") → parempi CTR sosiaalisessa mediassa.

## 5. Spam- ja väärinkäyttösuojat

- **Self-referral blokki**: RPC rejectoi jos `referrer_id = referred_id`.
- **Email-domain cap**: Max 5 referralia / 30 pv per sama `@domain.com` (paitsi gmail/outlook/yahoo). SQL-funktio tarkistaa.
- **Email-vahvistus pakollinen**: Signup-palkinto laukeaa vasta kun user on vahvistanut emailin (tarkistetaan `auth.users.email_confirmed_at`).
- **Maksukonversio vaadittu isoille palkinnoille**: Credit-palkinnot vain `converted = true` kautta → RevenueCat/Stripe-webhook on ainoa laukaisin → ei voi väärentää.
- **Milestone-idempotenssi**: `profiles.referral_milestones_hit jsonb default '[]'` — sama milestone ei laukea kahdesti.

## 6. Tekniset yksityiskohdat

**Uudet tiedostot:**
- `supabase/functions/claim-referral/index.ts` — tallentaa signup-referraalin + jakaa +50 XP.
- `src/components/InviteCTA.tsx` — viikoittainen nudge Indexissä.
- `src/hooks/use-referral-stats.ts` — laskee signup/converted/€-arvot.

**Muokattavat:**
- `src/pages/Auth.tsx` — tallenna `?ref`-koodi localStorageen ennen signupia.
- `src/contexts/AuthContext.tsx` — signIn/sessionListener: jos `pending_referral_code` löytyy, kutsu `claim-referral` ja tyhjennä.
- `src/pages/Referrals.tsx` — uusi UI (€ earned, signups vs converted, credits banner, top inviters).
- `supabase/functions/revenuecat-webhook/index.ts` + `supabase/functions/stripe-webhook/index.ts` — kutsuu `reward_referral_conversion` kun `is_elite` muuttuu `true`:ksi.
- `src/pages/Paywall.tsx` — näytä "Free until X" jos `membership_credits_until > now()`.

**DB-migraatio (yksi tiedosto):**
- `referrals.converted boolean default false`, `referrals.converted_at timestamptz` + index.
- `profiles.membership_credits_until timestamptz nullable`.
- `profiles.referral_milestones_hit jsonb default '[]'`.
- RPC `reward_referral_conversion(p_user uuid)` — SECURITY DEFINER, atominen, idempotentti.
- RPC `claim_referral(p_referrer_code text)` — SECURITY DEFINER, suojattu self-referralilta ja duplikoinneilta. (Edge function kutsuu tätä service-clientillä JWT:n kera.)
- Päivitä `has_active_access`: trial 7→14 päivää jos `referred_by IS NOT NULL`, OR `membership_credits_until > now()`.
- RPC `get_top_inviters(p_limit int)` — palauttaa kk:n top kutsujat (username + converted_count).

**Konservatiivinen scope:**
- Ei muutosta itse maksuprovidereihin (RevenueCat & Stripe ennallaan, vain webhookiin lisäys).
- Ei muutosta onboardingiin.
- Nykyinen "rewards"-lista korvataan uudella, mutta kaikki aiemmat `referrals`-rivit säilyvät — `converted = false` oletuksena, joten kukaan ei saa takautuvia palkintoja (turvallinen pohja).
- Cache-pohjainen spam-suoja tehdään SQL-funktiona — ei kolmannen osapuolen palveluita.

**Muistipäivitykset:**
- Uusi `mem://features/referral-money-machine` — dokumentoi loop, palkinnot, credits, spam-suojat.
- `mem://monetization/membership` — lisätään maininta 14-päivän trial:ista referraalisignupeilla ja credit-systeemistä.

