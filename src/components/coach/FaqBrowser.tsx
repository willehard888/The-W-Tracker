import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { COACH_FAQ, FaqEntry, FaqCategory } from "@/lib/coach-faq";
import { hapticImpact } from "@/lib/haptics";

const CATEGORIES: FaqCategory[] = ["Training", "Recovery", "Nutrition", "Mindset", "Program"];

interface Props {
  onSelect: (entry: FaqEntry) => void;
  onClose: () => void;
}

const FaqBrowser = ({ onSelect, onClose }: Props) => {
  const [active, setActive] = useState<FaqCategory | "All">("All");
  const list = active === "All" ? COACH_FAQ : COACH_FAQ.filter((f) => f.category === active);

  return (
    <div className="absolute inset-0 z-50 bg-background flex flex-col">
      <div className="shrink-0 px-3 pt-3 pb-2 flex items-center gap-2 border-b border-border/30">
        <button
          onClick={() => { hapticImpact("light"); onClose(); }}
          className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-card/60"
          aria-label="Back"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="font-display text-sm font-black tracking-tight">Coach Playbook</p>
      </div>

      <div className="shrink-0 px-3 pt-2 pb-1 flex gap-1.5 overflow-x-auto no-scrollbar">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={`shrink-0 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition ${
              active === c
                ? "border-gold/60 bg-gold/15 text-gold"
                : "border-border/40 text-muted-foreground hover:border-border"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {list.map((f) => (
          <button
            key={f.id}
            onClick={() => { hapticImpact("light"); onSelect(f); }}
            className="w-full text-left rounded-2xl border border-border/40 bg-card/60 p-3.5 hover:border-gold/40 hover:bg-card/80 transition"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-gold/80 mb-1">
              {f.category}
            </p>
            <p className="text-sm text-foreground">{f.question}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FaqBrowser;
