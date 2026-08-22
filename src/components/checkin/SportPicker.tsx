import { useState } from "react";
import { ChevronDown, Search, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPORTS, sportsByGroup, type Sport } from "@/lib/sports";

interface SportPickerProps {
  forYou: Sport[];
  selectedId: string;
  detectedSportId: string | null;
  onSelect: (id: string) => void;
}

const Row = ({
  sport, selected, detected, onClick,
}: { sport: Sport; selected: boolean; detected?: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full px-4 py-3 text-left transition-colors border-b border-border/50 last:border-0 active:scale-[0.98]",
      selected ? "bg-gold/5" : "hover:bg-secondary/50",
    )}
  >
    <span className="text-lg w-7 text-center">{sport.emoji}</span>
    <span className="text-sm font-medium flex-1 flex items-center gap-1.5">
      {sport.label}
      {detected && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal bg-teal/10 px-1.5 py-0.5 rounded-full">
          <ShieldCheck size={10} /> Detected
        </span>
      )}
    </span>
    {/* Per-sport XP stays (it genuinely differs) — muted unless selected. */}
    <span className={cn("text-xs font-bold tabular-nums", selected ? "text-gold" : "text-muted-foreground/60")}>+{sport.xp}</span>
  </button>
);

/**
 * The sport list — For you → search → groups (always collapsed; a new user
 * with an empty For-you gets the first group open so the list is never blank).
 */
const SportPicker = ({ forYou, selectedId, detectedSportId, onSelect }: SportPickerProps) => {
  const [query, setQuery] = useState("");
  const groups = sportsByGroup();
  const [openGroup, setOpenGroup] = useState<string | null>(forYou.length === 0 ? groups[0]?.group ?? null : null);

  return (
    <div className="mt-1.5 rounded-2xl border border-border bg-card overflow-hidden">
      {forYou.length > 0 && (
        <div>
          <p className="eyebrow px-4 pt-3 pb-1.5 text-gold/80">For you</p>
          {forYou.map((sport) => (
            <Row key={`fy-${sport.id}`} sport={sport} selected={selectedId === sport.id} detected={detectedSportId === sport.id} onClick={() => onSelect(sport.id)} />
          ))}
        </div>
      )}

      <div className="px-3 pt-3 pb-1 relative">
        <Search size={14} className="absolute left-6 top-1/2 mt-1 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sports…"
          autoFocus={forYou.length === 0}
          className="w-full rounded-xl border border-border/50 bg-background/40 pl-9 pr-9 py-2.5 text-[13px] outline-none focus:border-gold/50 transition-colors"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-6 top-1/2 mt-1 -translate-y-1/2 text-muted-foreground/60" aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>

      {query.trim() ? (
        (() => {
          const q = query.trim().toLowerCase();
          const hits = SPORTS.filter((sp) => sp.label.toLowerCase().includes(q) || sp.id.includes(q));
          return hits.length
            ? hits.map((sport) => <Row key={`q-${sport.id}`} sport={sport} selected={selectedId === sport.id} onClick={() => { onSelect(sport.id); setQuery(""); }} />)
            : <p className="px-4 py-4 text-xs text-muted-foreground">No sports match "{query.trim()}"</p>;
        })()
      ) : (
        groups.map(({ group, sports }) => {
          const open = openGroup === group;
          return (
            <div key={group}>
              <button
                onClick={() => setOpenGroup((g) => (g === group ? null : group))}
                className="flex items-center justify-between w-full px-4 pt-3 pb-1.5 text-left"
              >
                <span className="eyebrow">{group} <span className="text-muted-foreground/50">({sports.length})</span></span>
                <ChevronDown size={12} className={cn("text-muted-foreground/60 transition-transform", open && "rotate-180")} />
              </button>
              {open && sports.map((sport) => (
                <Row key={sport.id} sport={sport} selected={selectedId === sport.id} onClick={() => onSelect(sport.id)} />
              ))}
            </div>
          );
        })
      )}
    </div>
  );
};

export default SportPicker;
