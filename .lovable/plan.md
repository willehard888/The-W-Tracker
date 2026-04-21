

## Korjataan Xcode Cloud build — lockfile + CocoaPods CDN

Build epäonnistuu kahdesta syystä, jotka molemmat näkyvät lokissa. Korjataan ne kerralla.

### Ongelma 1 — `package-lock.json` ei ole synkassa

`package.json` sisältää `html2canvas@1.4.1` ja `react-markdown@9`, mutta `package-lock.json` ei ole päivitetty. `npm ci` epäonnistuu listaamalla ~80 puuttuvaa pakettia. Skripti kyllä putoaa `npm install` -varareittiin, mutta lockfile pysyy ajossa väärässä tilassa eikä `npm ci` toimi koskaan tulevissa buildeissa.

**Korjaus:** Päivitetään `package-lock.json` paikallisesti ajamalla `npm install` ja committoidaan tulos. (Tässä vaiheessa Lovable päivittää lockin defaultin moodissa.)

### Ongelma 2 — CocoaPods CDN ei vastaa Xcode Cloudissa (fatal)

```
[!] CDN: trunk URL couldn't be downloaded: 
    https://cdn.cocoapods.org/deprecated_podspecs.txt 
    Response: Couldn't connect to server
❌ pod install failed
```

Tämä on Xcode Cloudin tunnettu ajoittainen verkko-ongelma CDN:n kanssa. Korjataan kolmella keinolla:

1. **Retry-loop** `pod install`:lle (3 yritystä, exponential backoff)
2. **Käytetään ensin `pod install` ilman `--repo-update`a** (paikalliset CDN-välimuistit voivat riittää) ja vasta jos epäonnistuu, kokeillaan `--repo-update`
3. **Lisätään `COCOAPODS_DISABLE_STATS=1`** ja **`CP_HOME_DIR`** välimuisti pysyväksi
4. **Lisätään master-spec-repo varareitiksi** jos CDN edelleen pettää

### Tiedostomuutokset

**`ios/App/ci_scripts/ci_post_clone.sh`** — korvataan `pod install --repo-update` blokki (rivit 109-114) seuraavalla logiikalla:

```bash
export COCOAPODS_DISABLE_STATS=1

pod_install_with_retry() {
  local attempt=1
  local max_attempts=3
  local use_repo_update=""

  while [[ $attempt -le $max_attempts ]]; do
    echo "📦 pod install attempt $attempt/$max_attempts $use_repo_update..."
    if pod install $use_repo_update 2>&1; then
      return 0
    fi
    echo "⚠️ pod install attempt $attempt failed"
    
    # Toisesta yrityksestä: pakota repo-update
    if [[ $attempt -ge 2 ]]; then
      use_repo_update="--repo-update"
    fi
    
    # Backoff
    sleep $((attempt * 5))
    attempt=$((attempt + 1))
  done
  
  # Viimeinen oljenkorsi: lisää master-repo manuaalisesti
  echo "🆘 Yritetään lisätä master spec repo manuaalisesti..."
  pod repo add-cdn trunk https://cdn.cocoapods.org/ 2>&1 || true
  pod install --repo-update 2>&1
}

if ! pod_install_with_retry; then
  echo "❌ pod install epäonnistui kaikkien yritysten jälkeen"
  exit 1
fi
```

**`ios/App/ci_scripts/ci_pre_xcodebuild.sh`** — sama retry-logiikka jos Pods-hakemisto puuttuu (rivi ~30-50).

**`scripts/ios-clean.sh`** — sama retry paikalliseen kehitykseen, jotta sama logiikka toimii kaikkialla.

### Mitä EI muuteta

- Ei muuteta Podfileä — `use_modular_headers` on jo paikallaan kohdistetuilla podseilla
- Ei lisätä uusia natiiviriippuvuuksia
- Ei muuteta Capacitor-versioita
- Ei muuteta `ENABLE_USER_SCRIPT_SANDBOXING` tms. Xcode-asetuksia

### Lopputulos

Buildi seuraavalla yrityksellä:
1. Lockfile on synkassa → `npm ci` toimii (~10x nopeampi kuin install)
2. CocoaPods CDN -virhe ei enää tapa buildiä — retry-loop hoitaa hetkelliset verkkokatkokset
3. Edelleen samat 3 verifiointivaihetta (`Capacitor.podspec.json`, `CapacitorCordova`, `Pods-App.release.xcconfig`) varmistavat että `pod install` on oikeasti onnistunut

