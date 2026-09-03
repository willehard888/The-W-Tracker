import { useParams } from "react-router-dom";
import { RECIPES, type Recipe } from "@/data/recipes";
import { recipeSquare } from "@/lib/recipe-images";

/**
 * Recipe poster, rendered from data — a DEV-ONLY export surface.
 *
 * The shipped posters are cream-background JPEGs with black text: a different
 * visual world from the app they live in, which is dark-only Obsidian & Gold.
 * They also hard-code every ingredient quantity and method step as pixels, so
 * the poster and `src/data/recipes.ts` can silently disagree the moment either
 * is edited.
 *
 * This renders the same fields the app renders, from the same array, so the
 * text on the poster cannot drift from the text in the product — it is the
 * same source. The food photograph is the existing square crop, which is
 * already a clean, text-free image; nothing is regenerated, so no photo
 * quality is lost and no AI is asked to spell "1/2 tsp garlic powder".
 *
 * Exported by screenshotting this route at 1080×1620 (the 2:3 the app's
 * `aspect-[2/3]` frame expects). Not linked from anywhere and gated on
 * import.meta.env.DEV at the route, so it never ships.
 */

const GOLD = "hsl(42 88% 60%)";
const GOLD_DIM = "hsl(42 60% 52%)";
const INK = "hsl(258 18% 5%)";

const Badge = ({ label, value }: { label: string; value: string }) => (
  <div
    className="flex-1 rounded-xl px-3 py-2.5 text-center"
    style={{ background: "hsl(258 14% 10%)", border: "1px solid hsl(42 40% 30% / 0.5)" }}
  >
    <p className="text-[34px] font-black leading-none" style={{ color: GOLD }}>{value}</p>
    <p className="text-[15px] font-bold uppercase tracking-[0.16em] mt-2" style={{ color: "hsl(40 12% 62%)" }}>
      {label}
    </p>
  </div>
);

export const RecipePosterCard = ({ recipe }: { recipe: Recipe }) => {
  const photo = recipeSquare(recipe.id);

  return (
    <div
      className="relative overflow-hidden flex flex-col"
      style={{ width: 1080, height: 1620, background: INK, fontFeatureSettings: '"tnum"' }}
    >
      {/* Warm floor glow — the same ember cast the app uses behind its cards. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[620px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 100% at 50% 100%, hsl(28 80% 40% / 0.16), transparent 70%)" }}
      />

      {/* ── Head: wordmark, title, blurb, photo ───────────────────────── */}
      <div className="relative flex gap-8 px-14 pt-12">
        <div className="flex-1 min-w-0">
          <p className="text-[19px] font-black uppercase tracking-[0.34em]" style={{ color: GOLD }}>
            Whealth Factory
          </p>
          <h1
            className="font-display font-black leading-[0.92] tracking-tight mt-5"
            style={{ fontSize: 92, color: "hsl(40 20% 96%)" }}
          >
            {recipe.title}
          </h1>
          <div className="mt-5 h-[3px] w-24 rounded-full" style={{ background: GOLD }} />
          <p className="text-[26px] leading-snug mt-6" style={{ color: "hsl(40 10% 70%)" }}>
            {recipe.blurb}
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {recipe.tags.map((t) => (
              <span
                key={t}
                className="rounded-full px-3.5 py-1.5 text-[17px] font-black uppercase tracking-[0.12em]"
                style={{ color: GOLD_DIM, border: "1px solid hsl(42 40% 34% / 0.6)" }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {photo && (
          <div
            className="shrink-0 overflow-hidden rounded-3xl"
            style={{
              width: 470,
              height: 470,
              border: "1px solid hsl(42 50% 42% / 0.55)",
              boxShadow: "0 30px 80px -30px hsl(28 90% 30% / 0.7)",
            }}
          >
            <img src={photo} alt="" className="h-full w-full object-cover" />
          </div>
        )}
      </div>

      {/* ── Macros + timing ───────────────────────────────────────────── */}
      <div className="relative flex gap-2.5 px-14 mt-10">
        <Badge label="kcal" value={String(recipe.nutrition.calories)} />
        <Badge label="Protein" value={`${recipe.nutrition.protein}g`} />
        <Badge label="Carbs" value={`${recipe.nutrition.carbs}g`} />
        <Badge label="Fat" value={`${recipe.nutrition.fat}g`} />
        <Badge label="Prep" value={`${recipe.prepMin}m`} />
        <Badge label="Cook" value={`${recipe.cookMin}m`} />
      </div>

      {/* ── Ingredients | Method ──────────────────────────────────────── */}
      <div className="relative flex gap-10 px-14 mt-11 flex-1 min-h-0">
        <div style={{ width: 440 }} className="shrink-0">
          <p className="text-[21px] font-black uppercase tracking-[0.26em] mb-6" style={{ color: GOLD }}>
            Ingredients
          </p>
          <div className="space-y-5">
            {recipe.groups.map((g) => (
              <div key={g.title}>
                <p
                  className="text-[17px] font-black uppercase tracking-[0.14em] mb-2.5"
                  style={{ color: "hsl(40 12% 58%)" }}
                >
                  {g.title}
                </p>
                <ul className="space-y-1.5">
                  {g.items.map((it, i) => (
                    <li key={i} className="text-[22px] leading-snug" style={{ color: "hsl(40 14% 88%)" }}>
                      {it.qty != null && (
                        <span className="font-black" style={{ color: GOLD }}>
                          {it.qty}
                          {it.unit ? ` ${it.unit}` : ""}{" "}
                        </span>
                      )}
                      {it.item}
                      {it.note && <span style={{ color: "hsl(40 8% 52%)" }}> ({it.note})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[21px] font-black uppercase tracking-[0.26em] mb-6" style={{ color: GOLD }}>
            Method
          </p>
          <div className="space-y-5">
            {recipe.method.map((phase, pi) => (
              <div key={phase.title} className="flex gap-4">
                <span
                  className="shrink-0 flex items-center justify-center rounded-full text-[22px] font-black"
                  style={{ width: 48, height: 48, background: GOLD, color: INK }}
                >
                  {pi + 1}
                </span>
                <div className="min-w-0">
                  <p
                    className="text-[21px] font-black uppercase tracking-[0.1em] mb-2"
                    style={{ color: "hsl(40 20% 94%)" }}
                  >
                    {phase.title}
                  </p>
                  <ol className="space-y-1">
                    {phase.steps.map((s, i) => (
                      <li key={i} className="text-[20px] leading-snug" style={{ color: "hsl(40 10% 74%)" }}>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Storage strip ─────────────────────────────────────────────── */}
      <div
        className="relative mt-8 px-14 py-6 flex items-center gap-8"
        style={{ background: "hsl(258 16% 8%)", borderTop: "1px solid hsl(42 40% 30% / 0.45)" }}
      >
        <div>
          <p className="text-[12px] font-black uppercase tracking-[0.2em]" style={{ color: "hsl(40 12% 55%)" }}>
            Fridge
          </p>
          <p className="text-[21px] font-black leading-tight" style={{ color: GOLD }}>
            {recipe.mealPrep.fridgeDays} days
          </p>
        </div>
        {recipe.mealPrep.freezerWeeks != null && (
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.2em]" style={{ color: "hsl(40 12% 55%)" }}>
              Freezer
            </p>
            <p className="text-[21px] font-black leading-tight" style={{ color: GOLD }}>
              {recipe.mealPrep.freezerWeeks} weeks
            </p>
          </div>
        )}
        <p className="text-[16px] leading-snug flex-1" style={{ color: "hsl(40 10% 72%)" }}>
          <span className="font-black" style={{ color: "hsl(40 18% 90%)" }}>Reheat: </span>
          {recipe.mealPrep.reheat}
        </p>
      </div>
    </div>
  );
};

/**
 * Route wrapper — /dev/recipe-poster/:id, or the first recipe if no id.
 *
 * `fixed inset-0` on purpose: App.tsx wraps every route in a `max-w-md`
 * column with the bottom nav below it, which is right for the product and
 * wrong for a 1080px export canvas — it squeezed the poster into a phone
 * column. This escapes the shell so a screenshot at 1080×1620 captures the
 * poster and nothing else.
 */
const RecipePoster = () => {
  const { id } = useParams<{ id: string }>();
  const recipe = RECIPES.find((r) => r.id === id) ?? RECIPES[0];
  return (
    <div
      className="fixed inset-0 z-[999] overflow-auto flex items-start justify-start"
      style={{ background: "hsl(0 0% 8%)" }}
    >
      <RecipePosterCard recipe={recipe} />
    </div>
  );
};

export default RecipePoster;
