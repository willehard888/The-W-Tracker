
Buildin nykyinen vika näyttää olevan kahden iOS-puolen ongelman yhdistelmä, ei enää npm-lockfile.

## Mitä korjataan

### 1. Korjataan Podfile-strategia kokonaan
Nykyinen Podfile tekee ristiriitaisen asian:
- se pakottaa `:modular_headers => true`
- mutta samalla poistaa Capacitorin `module_map`-määrittelyt

Tämä on todennäköinen syy virheeseen:
`CapacitorCordova does not define modules`

Teen nämä muutokset:
- poistan `patch_capacitor_module_maps`-logiikan Podfilesta
- poistan myös saman podspec-muokkauksen CI-skripteistä
- vaihdan Podfileen yhden selkeän, pysyvän modulaarisen asetuksen koko pod-resoluutiolle (`use_modular_headers!`)
- pidän nykyiset Xcode 26 -yhteensopivuuskorjaukset (`SWIFT_ENABLE_EXPLICIT_MODULES = NO`, `CLANG_ENABLE_EXPLICIT_MODULES = NO`, MetalToolchain-polun siivous)
- varmistan, että Capacitor-, CapacitorCordova- ja RevenueCat-podit integroituvat samalla tavalla sekä `cap sync`-vaiheessa että suorassa `pod install` -vaiheessa

Tavoite: `npx cap sync ios` ei enää kaadu analysointivaiheessa ennen varsinaista CI:n pod-installia.

### 2. Yhtenäistetään CocoaPods fallback kunnolla
Nykyinen retry-logiikka auttaa vain osittain. Korjaan sen niin, että kaikki iOS-skriptit käyttävät samaa vakaata polkua:

- ensin tarkistus, vastaako CocoaPods CDN
- jos ei vastaa, lisätään GitHub Specs -fallback
- `pod install` ajetaan retry-loopilla ilman `--repo-update` ensin
- vasta epäonnistumisen jälkeen `--repo-update`
- viimeisillä yrityksillä vaihto fallback-repoon
- lopuksi selkeä fail only if all options are exhausted

Päivitettävät tiedostot:
- `ios/App/ci_scripts/ci_post_clone.sh`
- `ios/App/ci_scripts/ci_pre_xcodebuild.sh`
- `scripts/ios-clean.sh`

### 3. Poistetaan kovat absoluuttiset polut
Skripteissä on nyt kovakoodattuja polkuja kuten:
- `/Volumes/workspace/repository/...`
- `/dev-server/...`

Ne tekevät skripteistä hauraita ja voivat rikkoa CI:n tai paikallisen buildin eri ympäristöissä.

Teen niistä dynaamiset:
- kaikki polut johdetaan `SCRIPT_DIR` / `ROOT_DIR` / `IOS_APP_DIR` muuttujista
- sama skripti toimii Xcode Cloudissa, Lovablessa ja paikallisella Macilla ilman erillisiä polkuja

### 4. Korjataan `ios-clean.sh` oikeasti toimivaksi
`ios-clean.sh` viittaa Swift package -manifestiin, jota projektipuussa ei tällä hetkellä näy (`ios/App/CapApp-SPM/Package.swift`).

Korjaan skriptin niin, että se:
- ei kaadu puuttuvaan manifestiin
- tarkistaa ensin löytyykö oikea SPM-manifesti / Package.resolved-polku
- generoi tai validoi `Package.resolved` vain jos siihen on oikeasti tarvittavat tiedostot
- avaa lopuksi Xcoden edelleen automaattisesti

Tämä estää paikallisen “all-in-one” komennon hajoamisen myöhemmin.

## Toteutusjärjestys

1. Siivotaan Podfile
2. Poistetaan podspec-patchit CI-skripteistä
3. Yhtenäistetään CocoaPods fallback + retry kaikkiin 3 skriptiin
4. Korvataan absoluuttiset polut dynaamisilla
5. Korjataan `ios-clean.sh` Package.resolved-logiikka
6. Varmistetaan, että skriptit tarkistavat oikeat artefaktit:
   - `Pods/Local Podspecs/Capacitor.podspec.json`
   - `Pods/Local Podspecs/CapacitorCordova.podspec.json`
   - `Pods/Target Support Files/CapacitorCordova`
   - `Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig`

## Odotettu lopputulos

Tämän jälkeen buildin pitäisi edetä näin:
- `npm ci` toimii lockfilen kanssa
- `npm run build` onnistuu
- `npx cap sync ios` ei enää kaadu `CapacitorCordova does not define modules` -virheeseen
- `ci_post_clone.sh` kestää myös CDN-katkokset
- sama logiikka toimii sekä Xcode Cloudissa että paikallisesti

## Tekniset tiedostot
- `ios/App/Podfile`
- `ios/App/ci_scripts/ci_post_clone.sh`
- `ios/App/ci_scripts/ci_pre_xcodebuild.sh`
- `scripts/ios-clean.sh`
