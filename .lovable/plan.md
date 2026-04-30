# Vaihda appin nimi: The W Tracker → Whealth Factory

## Mitä muutetaan

Appin **näkyvä nimi** vaihtuu kaikkialla **"Whealth Factory"** -muotoon. Kaikki muu (logo W, värit, brändi-ilme, ikonit, URL-osoitteet, RevenueCat-tuotteet, App Store -bundle ID) säilyy ennallaan, jotta:

- iOS-build ei rikkoonnu (sama bundle ID `app.lovable.wtracker`, sama URL scheme, sama RevenueCat entitlement)
- Tilaajat säilyvät (RevenueCat tunnistaa edelleen `"The W Tracker Pro"` entitlementin)
- Lovable-domain ja Supabase-projekti säilyvät ennallaan

## Mitä EI muuteta (tärkeää)

| Asia | Arvo | Miksi säilytetään |
|---|---|---|
| Bundle ID | `app.lovable.wtracker` | Vaihtaminen = uusi App Store -appi, kaikki tilaukset menetetään |
| URL scheme | `app.lovable.wtracker` | Apple Sign-In callback rikkoutuisi |
| RevenueCat entitlement | `"The W Tracker Pro"` | Vaihtaminen vaatii RevenueCat dashboard -muutoksen ja kaikkien tilaajien resyncin |
| `package.json` name | `vite_react_shadcn_ts` | Sisäinen, ei näy käyttäjälle |
| Lovable-domain | `status-level-up.lovable.app` | Tarvitsee custom domain -ostoa erikseen |
| Logo (W-merkki) | sama | Brändi-identiteetti pohjautuu W-kirjaimeen — sopii edelleen "Whealth"iin |
| Tukisähköposti | `support@wtracker.app` | Voi vaihtaa erikseen kun uusi domain on hankittu |

## Tiedostot joihin tehdään muutoksia

### Native shell (näkyy iOS-laitteen kotinäytöllä ja App Storessa)
- `capacitor.config.json` → `appName: "Whealth Factory"`
- `ios/App/App/Info.plist` → `CFBundleDisplayName: "Whealth Factory"`
- `index.html` → `<title>`, `apple-mobile-web-app-title`, OG/Twitter -tagit, meta description, author

### Pää-UI (näkyy joka sivulla)
- `src/components/AppLogoHeader.tsx` — header-otsikko
- `src/components/StatusHeader.tsx` — pää-headerin teksti + aria-label
- `src/components/BrandLogo.tsx` — `alt`-teksti
- `src/components/SplashScreen.tsx` — splash-ruudun nimi
- `src/pages/Landing.tsx` — landing-headerin teksti

### Sisältösivut & jaot
- `src/pages/PublicProfile.tsx` — `document.title` (3 paikkaa) + "doesn't exist on…" + "Open…" -nappi
- `src/pages/UserProfile.tsx` — share title + footer-merkintä
- `src/pages/Referrals.tsx` — referral share title + text
- `src/pages/TermsOfUse.tsx` — käyttöehtojen tekstit (3 mainintaa)
- `src/pages/PrivacyPolicy.tsx` — tukisähköpostin yhteydessä oleva viittaus säilyy mutta nimi vaihtuu siellä missä mainittu
- `src/components/StoryShareModal.tsx` — jaettavan kortin teksti (2 paikkaa) + share API title + viestit (3 paikkaa) + "THE W TRACKER" -tunnus → "WHEALTH FACTORY"
- `src/components/BriefingShareCard.tsx` — `thewtracker.com` -merkintä
- `src/lib/status-tiers.ts` — kommenttiotsikko

## Toteutusstrategia

Tehdään yhdellä erällä — jokainen muutos on yksittäinen tekstikorvaus. Käytän `code--exec` + `sed` -ajoa kaikille `.tsx/.ts`-tiedostoille kerralla, ja erilliset tarkat editit `index.html`, `Info.plist`, `capacitor.config.json` -tiedostoihin.

**Vaihto-säännöt** (sovelletaan tässä järjestyksessä):
1. `THE W TRACKER` → `WHEALTH FACTORY` (caps)
2. `The W-Tracker` → `Whealth Factory`
3. `The W Tracker` → `Whealth Factory`
4. `W Tracker` → `Whealth Factory` (muut esiintymät)
5. Manuaalisesti `thewtracker.com` -teksti `BriefingShareCard.tsx`:ssä → `whealthfactory.app` (placeholder kunnes domain hankittu)

## QA-vaihe

Muutosten jälkeen ajetaan vahvistus:
```
rg -i "w tracker|w-tracker|thewtracker" src public index.html capacitor.config.json ios/App/App/Info.plist
```
Pitäisi palauttaa **0 osumaa** ulkopuolella tarkoituksellisten paikkojen (RevenueCat entitlement, bundle ID, package.json sisäinen nimi).

## Mitä käyttäjä huomaa

- **Heti webissä:** Selaintabin otsikko, jaettavat linkit, splash, header, kaikki sivut, share-kortit, käyttöehdot
- **iOS-buildin jälkeen:** Kotinäytön ikonin nimi vaihtuu "Whealth Factory":ksi seuraavassa Xcode Cloud -buildissa
- **App Store -listaus:** Ei muutu automaattisesti — pitää päivittää erikseen App Store Connectissa (display name App Storessa on eri asia kuin `CFBundleDisplayName`)
