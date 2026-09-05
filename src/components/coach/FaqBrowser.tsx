import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COACH_FAQ, FaqEntry, FaqCategory } from "@/lib/coach-faq";
import { hapticImpact } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const CATEGORIES: FaqCategory[] = ["Training", "Recovery", "Nutrition", "Mindset", "Program"];

interface Props {
  onSelect: (entry: FaqEntry) => void;
  onClose: () => void;
}

/** The playbook, as a full overlay of the chat sheet's panel. */
const FaqBrowser = ({ onSelect, onClose }: Props) => {
  const [active, setActive] = useState<FaqCategory | "All">("All");
  const list = active === "All" ? COACH_FAQ : COACH_FAQ.filter((f) => f.category === active);

  return (
    <div className="absolute inset-0 z-50 bg-background flex flex-col" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="shrink-0 px-2 pt-2 pb-1 flex items-center gap-1 border-b border-border/30">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => { hapticImpact("light"); onClose(); }}>
          <ChevronLeft size={18} />
        </Button>
        <p className="font-display text-[15px] font-black tracking-tight">Coach Playbook</p>
      </div>

      <div className="shrink-0 px-3 pt-2 pb-1 flex gap-1.5 overflow-x-auto no-scrollbar">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActive(c)}
            className={cn(
              "press shrink-0 min-h-11 text-[12px] font-bold px-3 rounded-full border transition-colors",
              active === c ? "border-gold/60 bg-gold/15 text-gold" : "border-border/40 text-muted-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {list.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => { hapticImpact("light"); onSelect(f); }}
            className="press w-full min-h-11 text-left surface-card surface-card-quiet p-3.5"
          >
            <p className="text-[11px] text-muted-foreground mb-0.5">{f.category}</p>
            <p className="text-sm text-foreground">{f.question}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FaqBrowser;
