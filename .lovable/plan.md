

# Founding Apex kaupallisemmaksi + Status Tier näyttävämmäksi

Tehdään kaksi asiaa: (1) Founding Apex -merkki rebrändätään selvästi premiumiksi/kaupalliseksi statussymboliksi, ja (2) TierLadder muutetaan staattisesta listasta progressiiviseksi, kinemaattiseksi matkaksi jossa jokainen tier-saavutus tuntuu isolta.

---

## 1. Founding Apex — kaupallisempi premium-vibe

Nykyinen: pieni oranssi pilleri "⚡ Founding Apex".

Uusi premium-versio:
- **Lisätään "FOUNDING MEMBER" -mikrokopio** päämerkin alle/sisään → korostaa exclusiveä Day-One-statusta
- **Crown + Zap -yhdistelmäikoni** Apex-tilaajalle (ei pelkkä Zap) — kruunu = ostettu status, salama = nopeus/instant
- **Vahvempi gradient + sisäinen shimmer**: gold→amber→flame conic-gradient + animoitu shimmer-stripe joka pyyhkii merkin yli ~3s välein (sama tekniikka kuin premium-luottokorteissa)
- **Diamond/sparkle accent**: pieni ✦-ikoni perässä joka pulsoi
- **Tooltipti**: "Founding Apex — €15.99/mo · Day-One Member · Tier locked at Apex"
- **Koko hieman isompi** kuin Earned Apex → visuaalinen hierarkia: kaupallinen status erottuu

Earned Apex (🔥) pidetään hillitympänä — tämä korostaa ostetun statuksen "wow"-tekijän, joka kannustaa konversioita.

**Profile-sivulla**: Founding Apex -merkki saa myös oman pienen "PREMIUM" -lipun otsikon päälle (tag-tyyli), kuten kuvakaappauksessa näkyy mutta vahvempi.

---

## 2. Status Tier näyttävämmäksi — progressiivinen kokemus

Nykyinen TierLadder on flat lista checkmarkeilla. Uusi versio tekee siitä kinemaattisen polun jossa jokainen taso visuaalisesti eskaloituu.

### A. Progressiivinen visuaalinen eskalaatio (alhaalta ylös)

Jokainen tier-rivi saa visuaalisesti vahvemman käsittelyn sitä mukaa kun ranki nousee:

```text
Recruit       → flat, harmaa, ei aurakehystä
Operator      → ohut teal-borderi, hiljainen glow
Performer     → blue-gradient + ikonin valokupla
High Performer→ purple-aura, animoitu sisävalo
Elite         → gold-borderi + pulse-glow + sparkle-partikkeli rivin reunassa
Apex          → flame+gold conic-borderi pyörii hitaasti, isompi rivi (h-16 vs h-12)
Legend        → täysi conic-rainbow border + reunoissa kelluvat partikkelit + isoin rivi
```

Kasvava korkeus + kasvava efekti = visuaalinen "ladder" tuntuu kiipeämiseltä, ei listalta.

### B. "Achievement unlock" -animaatio nykyiselle tierille

- Nykyinen tier (You-rivi) saa **shimmer-sweep** joka pyyhkii rivin yli ~4s välein
- Konfettin/spark-partikkelit reunoissa
- Suurempi kruunu/tier-ikoni jolla on oma 3D-pyöritys hover-tilassa
- "YOU" -tagin sijasta isompi "● CURRENT TIER" -liveri kultaan

### C. Locked tierit — "näytä mitä menetät" -tyyli

- Lukitut tierit eivät enää harmaita läpinäkyvyydellä, vaan **silhuettina** gold-rajalla → "tämä on saavutettavissasi"
- Lukko-ikoni vaihtuu **Trending-up + percent** -merkkiin (esim. "+5% to unlock")
- Hover/tap → preview-animaatio joka näyttää mitä unlocks-listassa on

### D. Progress-track tier-rivien välissä

- Vertikaalinen kultainen viiva yhdistää tierit (kuin metro-kartta)
- Saavutetut välit ovat täytetty gradientilla, lukitut himmenneet
- Nykyisen tierin kohdalla pulssaava "olet täällä" -piste

### E. Header-kohotus

- "Status Ladder" → **"Your Ascension"** + alaotsikko "7 levels of dominance"
- Sparkles-ikonin tilalle pieni live mini-Crown joka pyörii
- Header saa gold-divider alle

---

## 3. Tekniset yksityiskohdat

### Edited / created files
- `src/components/ApexBadge.tsx` — Founding Apex premium-rebrand (Crown+Zap, shimmer, sparkle accent, isompi koko)
- `src/components/TierLadder.tsx` — koko refaktori: progressiiviset tier-rivit, conic-borderit ylätiereille, vertical progress-track, shimmer current-tierille, silhuetti locked-tiereille
- `src/index.css` — uudet CSS-helperit:
  - `.tier-shimmer-sweep` — animoitu valopyyhkäisy
  - `.tier-progress-line` — vertikaalinen gradient-viiva
  - `.founding-premium-shimmer` — premium-luottokortti-tyylinen shimmer
  - `.tier-conic-border-{rank}` — eri intensiteetit per tier
- `.lovable/memory/features/status-hierarchy.md` — päivitys progressiivisesta UI-käsittelystä ja Founding Apex premium-positioinnista

### Ei muuteta
- DB-skeema, RPC:t, tier-vaatimukset (99.9 percentile yms.)
- StatusBadge.tsx (tämä on pieni inline-pilleri, säilyy ennallaan jotta ei riko muita sivuja)
- Tier-järjestys, labelit, viestit (Legend pysyy "Legend" sisältäen Founders Circlen)
- Apex-tilauksen hinnoittelu / RevenueCat-virrat

