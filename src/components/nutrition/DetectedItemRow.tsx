import { useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEGMENT_ACTIVE, SEGMENT_IDLE, SEGMENT_TRACK } from "@/components/ui/segment";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";
import { confidenceTier, type ScanItem } from "@/lib/nutrition/scan-types";

const QUICK = [50, 100, 150, 200];

const TIER_LABEL = { solid: null, estimated: "Estimated", check: "Check this" } as const;

/**
 * One detected food on the photo-review screen. The row never presents the
 * model's guess as fact: grams show their range, the confidence tier is a
 * visible chip, and an ambiguous match forces a candidate choice before the
 * item can be saved. Nutrition figures come from the chosen database row.
 */
const DetectedItemRow = ({
  item,
  onGramsChange,
  onPickCandidate,
  onReplace,
  onRemove,
}: {
  item: ScanItem;
  onGramsChange: (id: string, grams: number) => void;
  onPickCandidate: (id: string, foodId: string) => void;
  onReplace: (id: string) => void;
  onRemove: (id: string) => void;
}) => {
  const [open, setOpen] = useState(item.needs_user_choice);
  const tier = confidenceTier(item);
  const chosen = item.candidates.find((c) => c.food_id === item.selected_food_id) ?? null;
  const label = TIER_LABEL[tier];
  const range = item.grams_low !== item.grams_high ? `${Math.round(item.grams_low)}–${Math.round(item.grams_high)} g` : null;

  return (
    <div className="py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight">
            {chosen ? chosen.name : item.name}
            {chosen?.brand && <span className="text-muted-foreground font-medium"> · {chosen.brand}</span>}
          </p>
          <p className="text-[12px] text-muted-foreground leading-snug mt-0.5 flex items-center gap-1.5 flex-wrap">
            {!chosen && <span>{item.name}</span>}
            {item.preparation !== "unknown" && <span>{item.preparation}</span>}
            {range && <span>≈ {Math.round(item.grams)} g ({range})</span>}
            {label && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                  tier === "check" ? "border-[hsl(var(--ember))]/50 text-[hsl(var(--ember))]" : "border-border text-muted-foreground",
                )}
              >
                {label}
              </span>
            )}
          </p>
          {item.preview && chosen && (
            <p className="text-[12px] tabular-nums text-muted-foreground mt-1">
              {item.preview.kcal != null ? `${Math.round(item.preview.kcal)} kcal` : "— kcal"}
              {item.preview.protein_g != null && ` · P ${Math.round(item.preview.protein_g)}`}
              {item.preview.carbs_g != null && ` · C ${Math.round(item.preview.carbs_g)}`}
              {item.preview.fat_g != null && ` · F ${Math.round(item.preview.fat_g)}`}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${item.name}`}
          className="relative before:absolute before:-inset-2 before:content-[''] text-muted-foreground shrink-0"
          onClick={() => onRemove(item.id)}
        >
          <X />
        </Button>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <label className="shrink-0">
          <span className="sr-only">Grams for {item.name}</span>
          <input
            type="text"
            inputMode="decimal"
            value={String(Math.round(item.grams))}
            aria-label={`Grams for ${item.name}`}
            onChange={(e) => {
              const n = Number(e.target.value.replace(",", "."));
              if (Number.isFinite(n) && n > 0) onGramsChange(item.id, n);
            }}
            className="w-20 surface-inset rounded-xl h-11 px-3 text-[15px] font-black tabular-nums outline-none focus:border-gold/50"
          />
        </label>
        <span className="text-[12px] font-bold text-muted-foreground">g</span>
        <div className={cn(SEGMENT_TRACK, "flex-1")} role="group" aria-label="Quick grams">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={Math.round(item.grams) === q}
              onClick={() => {
                hapticSelection();
                onGramsChange(item.id, q);
              }}
              className={cn("flex-1 h-11 rounded-lg text-[12px] font-black tabular-nums transition-all active:scale-[0.97]", Math.round(item.grams) === q ? SEGMENT_ACTIVE : SEGMENT_IDLE)}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {item.candidates.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="min-h-11 inline-flex items-center gap-1 text-[12px] font-bold text-muted-foreground active:opacity-70"
          >
            {chosen ? "Change match" : "Choose the right match"}
            <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
          </button>
        )}
        <Button variant="ghost" size="xs" className="ml-auto relative before:absolute before:-inset-2 before:content-['']" onClick={() => onReplace(item.id)}>
          <Search aria-hidden /> Search instead
        </Button>
      </div>

      {open && item.candidates.length > 0 && (
        <div role="radiogroup" aria-label={`Matches for ${item.name}`} className="mt-1 divide-y divide-border/35 rounded-xl border border-border/50 overflow-hidden">
          {item.candidates.map((c) => {
            const active = c.food_id === item.selected_food_id;
            return (
              <button
                key={c.food_id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  hapticSelection();
                  onPickCandidate(item.id, c.food_id);
                  setOpen(false);
                }}
                className={cn("w-full min-h-11 px-3 py-2 text-left flex items-center gap-3 active:opacity-70", active && "bg-gold/[0.06]")}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[14px] font-bold leading-tight truncate", active && "text-gold")}>{c.name}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {c.brand ? `${c.brand} · ` : ""}
                    {c.per_100g.kcal != null ? `${Math.round(c.per_100g.kcal)} kcal` : "— kcal"} / 100 g
                  </span>
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">{Math.round(c.similarity * 100)}%</span>
              </button>
            );
          })}
        </div>
      )}
      {item.candidates.length === 0 && (
        <p className="text-[12px] text-[hsl(var(--ember))] mt-1">Not in the database yet — search for it, or remove this item.</p>
      )}
    </div>
  );
};

export default DetectedItemRow;
