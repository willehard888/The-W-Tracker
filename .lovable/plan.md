# Premium Vault: Evidence-Based Library

Korvataan nykyinen "tulossa pian" -teaseri toimivalla, tutkimuspohjaisella sisältökirjastolla. 20 artikkelia jaettuna 5 kategorian kesken (4 per kategoria). Jokainen artikkeli sisältää selkeän toimintamallin (kesto/intensiteetti/frekvenssi), odotetut hyödyt, riskit/rajoitteet, ja näytön tason (strong / promising / speculative) viittauksineen.

## Mitä rakennetaan

### 1. Supabase-taulu `vault_articles`

Kentät:
- `category_id` — recipes | training | recovery | mind | nervous-system
- `slug` — unique URL-friendly tunniste
- `title`, `subtitle`, `summary` (lyhyt teaseri)
- `evidence_tier` — strong | promising | speculative
- `read_time_min` — arvioitu lukuaika
- `protocol` — jsonb: { duration, intensity, frequency, prerequisites }
- `benefits` — text[] (3–5 odotettua hyötyä)
- `risks` — text[] (rajoitteet, kontraindikaatiot)
- `body_md` — koko artikkeli markdownina
- `references` — jsonb[]: { author, title, year, url? }
- `published_at`, `display_order`

RLS: `SELECT` vain premium-käyttäjille (`has_premium(auth.uid())`). Ei suoria kirjoituksia — admin lisää uudet artikkelit migraatioilla. Indeksi `(category_id, display_order)`.

### 2. Sisältö (20 artikkelia)

**Performance Nutrition (4):** Protein 1.6 g/kg evidence brief · Pre/intra/post-workout fueling · Mediterranean pattern + glycemic control · Caffeine timing (3–6 mg/kg, 45–60 min ennen).

**Strength & Conditioning (4):** Progressive overload mechanics · Zone 2 prescription (180 min/wk) · 4×4 VO₂max protocol (Tabata/Norwegian) · Deload-periodisointi (4. viikko -40 % volume).

**Recovery & Sleep (4):** Sleep architecture & 7–9 h dose · Morning light 10 min (circadian anchor) · Caffeine half-life & 8 h cutoff · CWT/cold (≤15 °C, 2–3 min, ei strength-päivinä).

**Mind & Emotional Skill (4):** Box breathing 4-4-4-4 (acute stress) · Physiological sigh (Huberman/Stanford) · Mindfulness 10 min/päivä (MBSR) · Cognitive reframing -malli (CBT-pohja).

**Nervous System (4):** Polyvagal-perusteet (vagus tone) · NSDR/Yoga Nidra 10–20 min · 5.5 bpm coherent breathing (HRV) · Cold face immersion (mammalian dive reflex).

Jokainen artikkeli viittaa avainlähteisiin: Walker (Why We Sleep), Attia (Outlive), Schoenfeld (hypertrofia), ACSM, Huberman Lab, Stanford Mindfulness, Polyvagal Theory (Porges), PubMed-meta-analyysit.

### 3. UI-muutokset `src/pages/Vault.tsx`

- Poistetaan `comingSoon`-flagit ja "in production" -merkit
- Korvataan `preview`-staattiset listat oikealla artikkelilistalla (haetaan `useVaultArticles(categoryId)` -hookilla)
- Klikkaa kategoria → laajenee paljastaen 4 artikkelikorttia (evidence-chip + read time)
- Klikkaa artikkeli → `<VaultArticleSheet>` (Radix Sheet alhaalta) avaa täydet tiedot:
  - Hero: title + evidence tier + category color
  - **Protocol** -laatikko (kesto/intensiteetti/frekvenssi)
  - **Expected benefits** (✓ lista)
  - **Risks & limits** (⚠ lista)
  - **The science** (markdown body)
  - **References** (numeroidut linkit)
- Päivitetään stat trio: "20 artikkelia · 5 kategoriaa · 200+ viittausta"

### 4. Uudet tiedostot

- `supabase/migrations/<ts>_vault_articles.sql` — taulu + RLS + indeksi
- `supabase/migrations/<ts>_seed_vault_articles.sql` — 20 artikkelin seed (täysi sisältö SQL:nä)
- `src/hooks/use-vault-articles.ts` — `useVaultArticles(categoryId?)` ja `useVaultArticle(slug)`
- `src/components/vault/VaultArticleSheet.tsx` — modal-lukija (Radix Sheet + ReactMarkdown)
- `src/components/vault/EvidenceChip.tsx` — strong / promising / speculative -badge

### 5. Mitä ei tehdä nyt

- Ei admin-paneelia artikkelien CRUD:ille (tulee myöhemmin tarvittaessa)
- Ei käyttäjäkohtaisia bookmarkeja / luettu-merkkejä (voi lisätä myöhemmin omana taulunaan)
- Ei AI-generointia (tämä on kuratoitu starter)
- Ei video/audio-protokollia tässä vaiheessa — vain teksti + viittaukset

## Tekniset huomiot

- Kaikki sisältö on englanniksi (Core-sääntö)
- Evidence-luokitus seuraa olemassa olevaa `wellness-framework.ts` -konventiota
- Sheet käyttää nykyistä Radix Sheet -komponenttia (`@/components/ui/sheet`) — sama kokemus kuin muualla appissa
- Premium-gate säilyy: `useEffect` redirectaa paywallille jos ei premium
- `display_order` mahdollistaa artikkelien uudelleenjärjestämisen ilman koodimuutosta

Kysy "tee" niin alan rakentaa.