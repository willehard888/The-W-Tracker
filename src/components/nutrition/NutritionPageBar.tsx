import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The sub-page bar every nutrition screen shares: a 44 pt back target, the
 * screen's name, and one optional right-hand action. Sticky so the way out
 * never scrolls away under a long form.
 */
const NutritionPageBar = ({ title, onBack, action }: { title: string; onBack: () => void; action?: ReactNode }) => (
  <div className="sticky top-0 z-20 page-header-premium px-2 pt-3 pb-2 flex items-center gap-1">
    <Button variant="ghost" size="icon" aria-label="Back" className="min-h-11 min-w-11" onClick={onBack}>
      <ArrowLeft size={18} />
    </Button>
    <h1 className="flex-1 min-w-0 font-display text-base font-black tracking-tight truncate">{title}</h1>
    {action ?? <span className="w-11" aria-hidden />}
  </div>
);

export default NutritionPageBar;
