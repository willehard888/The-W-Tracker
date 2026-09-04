import { ExternalLink } from "lucide-react";

export interface FoodSourceInfo {
  code: string;
  name: string;
  licence: string;
  attribution_text: string;
  attribution_url?: string | null;
  licence_url?: string | null;
}

/** Fallback when the catalog has not been loaded yet — the same six sources the engine seeds. */
const FALLBACK_SOURCES: FoodSourceInfo[] = [
  { code: "fineli", name: "Fineli", licence: "CC BY 4.0", attribution_text: "Lähde: Terveyden ja hyvinvoinnin laitos, Fineli. Units converted; kcal derived from kJ.", attribution_url: "https://fineli.fi", licence_url: "https://creativecommons.org/licenses/by/4.0/" },
  { code: "usda_foundation", name: "USDA FoodData Central", licence: "CC0 1.0", attribution_text: "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.", attribution_url: "https://fdc.nal.usda.gov" },
  { code: "off", name: "Open Food Facts", licence: "ODbL 1.0", attribution_text: "Product data © Open Food Facts contributors, Open Database License.", attribution_url: "https://openfoodfacts.org", licence_url: "https://opendatacommons.org/licenses/odbl/1-0/" },
];

/**
 * The two honesty pages of the nutrition engine in one scrollable body:
 * how estimates are made (and how wrong they can be) and where the numbers
 * come from (with the attribution each licence asks for). Rendered inside
 * whatever sheet/page the caller provides — it owns no chrome.
 */
const NutritionInfoSheet = ({ sources }: { sources?: FoodSourceInfo[] }) => {
  const list = (sources && sources.length > 0 ? sources : FALLBACK_SOURCES).filter(
    (s, i, arr) => arr.findIndex((o) => o.name === s.name) === i,
  );
  return (
    <div className="space-y-7 pb-6">
      <section>
        <p className="eyebrow text-gold/85 mb-2">How estimates work</p>
        <h2 className="font-display text-[22px] font-black tracking-tight leading-tight">Every number here is a measurement of a guess.</h2>
        <ul className="mt-3 space-y-2.5 text-[14px] leading-snug text-foreground/90">
          <li>
            <b>Nutrition always comes from a database record</b> — Fineli, USDA or Open Food Facts — never from the camera. The photo
            scanner only names what it sees and guesses how much.
          </li>
          <li>
            <b>Portions from a photo are ±30 % typical</b>, and up to ±60 % on piled, sauced or reference-less plates. That is why
            every item shows a gram range and why you confirm before anything is saved.
          </li>
          <li>
            <b>Hidden ingredients are not detected.</b> Oil, butter, dressings and sugar in sauces are only added when they are
            visible — restaurant food usually under-counts by 50–150 kcal.
          </li>
          <li>
            <b>A dash means unknown, not zero.</b> Micronutrients are only as complete as the matched record. When a nutrient is
            missing from a food, the day's total says so instead of pretending.
          </li>
          <li>
            <b>Your edit is the truth.</b> Once you change grams or the food, the saved item is yours; the original guess is gone.
          </li>
        </ul>
      </section>

      <section>
        <p className="eyebrow text-gold/85 mb-2">Data sources</p>
        <div className="divide-y divide-border/35">
          {list.map((s) => (
            <div key={s.code} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px] font-bold">{s.name}</p>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">{s.licence}</span>
              </div>
              <p className="text-[13px] text-muted-foreground leading-snug mt-1">{s.attribution_text}</p>
              <div className="flex gap-4 mt-1.5">
                {s.attribution_url && (
                  <a href={s.attribution_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 min-h-11 text-[12px] font-bold text-gold">
                    Source <ExternalLink size={12} aria-hidden />
                  </a>
                )}
                {s.licence_url && (
                  <a href={s.licence_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 min-h-11 text-[12px] font-bold text-muted-foreground">
                    Licence <ExternalLink size={12} aria-hidden />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground/80 leading-snug mt-3">
          Open Food Facts records are kept separate from Fineli and USDA records and are never merged, so their share-alike
          licence stays honoured. Product photos from Open Food Facts are not shown.
        </p>
      </section>
    </div>
  );
};

export default NutritionInfoSheet;
