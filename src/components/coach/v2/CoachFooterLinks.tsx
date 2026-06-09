import { useNavigate } from "react-router-dom";
import {
  Brain, Target, Moon, BarChart3, BookOpen, ChevronRight, User,
} from "lucide-react";

/**
 * "More" footer for the Coach landing.
 *
 * Replaces the previous wall of stacked cards with explicit named doors.
 * Each link is a single tap into the relevant sub-page.
 */
const CoachFooterLinks = () => {
  const navigate = useNavigate();
  const links = [
    { icon: Target, label: "Long-term goal", path: "/coach/goal" },
    { icon: Moon, label: "Evening reflection", path: "/coach/reflect" },
    { icon: BarChart3, label: "Weekly review", path: "/coach/progress" },
    { icon: BookOpen, label: "Protocol library", path: "/coach/library" },
    { icon: Brain, label: "Coach memory", path: "/coach/memory" },
    { icon: User, label: "Trainer profile", path: "/coach/profile" },
  ];

  return (
    <div className="mt-2 rounded-3xl border border-border/40 bg-card/30 overflow-hidden">
      <p className="px-4 pt-3 pb-2 text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/85">
        More
      </p>
      {links.map((l, i) => (
        <button
          key={l.path}
          type="button"
          onClick={() => navigate(l.path)}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-card/60 transition-colors active:scale-[0.99] ${
            i > 0 ? "border-t border-border/30" : ""
          }`}
        >
          <l.icon size={14} className="text-gold/85 shrink-0" />
          <span className="flex-1 text-[13px] font-semibold">{l.label}</span>
          <ChevronRight size={14} className="text-muted-foreground/60 shrink-0" />
        </button>
      ))}
    </div>
  );
};

export default CoachFooterLinks;
