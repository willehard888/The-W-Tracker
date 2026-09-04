import { useEffect, useRef } from "react";
import { Camera, ChefHat, Globe, Loader2, ScanBarcode, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import FoodResultRow, { type FoodResultView } from "@/components/nutrition/FoodResultRow";

export type SearchFilter = "all" | "favorites" | "mine";
export type OnlineState = "idle" | "loading" | "done" | "rate_limited" | "error";

/**
 * Search content for the diary sheet. One list, two tiers: instant local
 * hits (favorites, frequent, recent) first, then the server's results under a
 * hairline divider. The online lookup is an explicit tap, never per keystroke
 * — Open Food Facts rate-limits per IP and the catalog answers most queries.
 * Zero results say so and offer the honest exits: create the food, or search
 * online. Nothing is ever fabricated for a miss.
 */
const FoodSearchPanel = ({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  localResults,
  results,
  loading,
  onlineState = "idle",
  onPick,
  onToggleFavorite,
  barcodeSupported,
  onScanBarcode,
  onEnterBarcode,
  onCreateFood,
  onSearchOnline,
  onScanPhoto,
  onOpenRecipes,
  autoFocus = true,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  filter: SearchFilter;
  onFilterChange: (f: SearchFilter) => void;
  localResults: FoodResultView[];
  results: FoodResultView[];
  loading: boolean;
  onlineState?: OnlineState;
  onPick: (food: FoodResultView) => void;
  onToggleFavorite?: (food: FoodResultView) => void;
  barcodeSupported: boolean;
  onScanBarcode?: () => void;
  onEnterBarcode?: () => void;
  onCreateFood: () => void;
  onSearchOnline?: () => void;
  /** Opens the photo-scan review (its picker offers camera or library). */
  onScanPhoto?: () => void;
  /** Opens the recipe list — the only way in, so it lives where people look for "my recipes". */
  onOpenRecipes?: () => void;
  autoFocus?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const q = query.trim();
  const searching = q.length >= 2;
  const localIds = new Set(localResults.map((f) => f.id));
  const serverOnly = results.filter((f) => !localIds.has(f.id));
  const nothing = searching && !loading && localResults.length === 0 && serverOnly.length === 0;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search foods or brands"
          aria-label="Search foods"
          className="w-full surface-inset rounded-xl h-11 pl-9 pr-24 text-[15px] outline-none focus:border-gold/50 transition-colors"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
          {query && (
            <button type="button" onClick={() => onQueryChange("")} aria-label="Clear search" className="h-11 w-9 flex items-center justify-center text-muted-foreground">
              <X size={15} />
            </button>
          )}
          {barcodeSupported && onScanBarcode && (
            <button type="button" onClick={onScanBarcode} aria-label="Scan a barcode" className="h-11 w-11 flex items-center justify-center text-gold active:scale-95 transition-transform">
              <ScanBarcode size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-0.5" role="group" aria-label="Filter">
        {(
          [
            ["all", "All"],
            ["favorites", "Favorites"],
            ["mine", "Mine"],
          ] as const
        ).map(([key, label]) => (
          <Button key={key} size="pill" variant={filter === key ? "gold-outline" : "outline"} aria-pressed={filter === key} className="shrink-0" onClick={() => onFilterChange(key)}>
            {label}
          </Button>
        ))}
        {!barcodeSupported && onEnterBarcode && (
          <Button size="pill" variant="outline" className="shrink-0" onClick={onEnterBarcode}>
            <ScanBarcode aria-hidden /> Barcode
          </Button>
        )}
        {onScanPhoto && (
          <Button size="pill" variant="outline" className="shrink-0" onClick={onScanPhoto}>
            <Camera aria-hidden /> Photo
          </Button>
        )}
        {onOpenRecipes && (
          <Button size="pill" variant="outline" className="shrink-0" onClick={onOpenRecipes}>
            <ChefHat aria-hidden /> Recipes
          </Button>
        )}
      </div>

      {localResults.length > 0 && (
        <section aria-label={searching ? "From your foods" : "Recent and favorites"}>
          {!searching && <p className="eyebrow text-muted-foreground/80 mb-1">Recent · favorites</p>}
          <div className="divide-y divide-border/35">
            {localResults.map((f) => (
              <FoodResultRow key={f.id} food={f} onPick={onPick} onToggleFavorite={onToggleFavorite} />
            ))}
          </div>
        </section>
      )}

      {searching && (
        <section aria-label="Search results" aria-busy={loading}>
          <div className="flex items-center gap-2 mt-1 mb-1">
            <span className="h-px flex-1 bg-border/50" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {loading ? "Searching" : `${serverOnly.length} result${serverOnly.length === 1 ? "" : "s"}`}
            </span>
            {loading && <Loader2 size={12} className="animate-spin text-muted-foreground" aria-hidden />}
            <span className="h-px flex-1 bg-border/50" aria-hidden />
          </div>
          {serverOnly.length > 0 && (
            <div className="divide-y divide-border/35">
              {serverOnly.map((f) => (
                <FoodResultRow key={f.id} food={f} onPick={onPick} onToggleFavorite={onToggleFavorite} />
              ))}
            </div>
          )}
          {nothing && (
            <div className="py-6 text-center">
              <p className="text-[14px] font-bold">No match for “{q}”</p>
              <p className="text-[12px] text-muted-foreground mt-1">Try fewer words, search the online databases, or add it yourself.</p>
            </div>
          )}
          {(nothing || (!loading && serverOnly.length < 5)) && (
            <div className={cn("flex flex-col gap-2 mt-3", !nothing && "pt-3 border-t border-border/35")}>
              {onSearchOnline && (
                <Button
                  variant="outline"
                  className="w-full"
                  loading={onlineState === "loading"}
                  disabled={onlineState === "done"}
                  onClick={onSearchOnline}
                >
                  <Globe aria-hidden /> {onlineState === "done" ? "Online results included" : "Search online databases"}
                </Button>
              )}
              {onlineState === "rate_limited" && (
                <p className="text-[12px] text-muted-foreground text-center">The online databases are busy — try again in a minute.</p>
              )}
              {onlineState === "error" && <p className="text-[12px] text-muted-foreground text-center">Online search didn't answer. Nothing was invented.</p>}
              <Button variant="ember-outline" className="w-full" onClick={onCreateFood}>
                Create “{q.length > 24 ? `${q.slice(0, 24)}…` : q}” as a food
              </Button>
            </div>
          )}
        </section>
      )}

      {!searching && localResults.length === 0 && (
        <p className="text-[13px] text-muted-foreground text-center py-8">Type a food or brand — or scan a barcode.</p>
      )}
    </div>
  );
};

export default FoodSearchPanel;
