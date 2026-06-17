import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Users, UserPlus } from "lucide-react";
import EliteFeed from "./EliteFeed";
import Tribes from "./Tribes";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";

/**
 * Squad — the single social home. Merges the old Feed and Tribe tabs behind one
 * segmented control (freeing a nav slot for Coach) and keeps Friends one tap
 * away. The Pod lives on Today; DMs are reached from Friends.
 */
const SUB = [
  { key: "feed", label: "Feed", icon: Flame },
  { key: "tribes", label: "Tribes", icon: Users },
] as const;

const Squad = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"feed" | "tribes">("feed");

  return (
    <div className="flex flex-col">
      <div className="page-header-premium px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="flex-1 flex gap-1 rounded-xl bg-card/50 border border-border/50 p-1">
          {SUB.map((s) => (
            <button
              key={s.key}
              onClick={() => { hapticSelection(); setTab(s.key); }}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-black transition-all active:scale-[0.98]",
                tab === s.key ? "bg-gold text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <s.icon size={14} /> {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => navigate("/friends")}
          aria-label="Friends"
          className="h-9 w-9 rounded-full bg-secondary/70 border border-border flex items-center justify-center text-foreground/90 shrink-0 active:scale-95 transition-transform"
        >
          <UserPlus size={17} />
        </button>
      </div>

      {tab === "feed" ? <EliteFeed /> : <Tribes />}
    </div>
  );
};

export default Squad;
