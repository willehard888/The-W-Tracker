import { useNavigate, useSearchParams } from "react-router-dom";
import { Flame, Users, UserPlus } from "lucide-react";
import EliteFeed from "./EliteFeed";
import Tribes from "./Tribes";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";

/**
 * Squad — the single social home. Merges the old Feed and Tribe tabs behind one
 * segmented control (freeing a nav slot for Coach) and keeps Friends one tap
 * away. The Pod lives on Today; DMs are reached from Friends.
 *
 * The active sub-tab lives in the URL (`/squad?tab=tribes`) so back-links from
 * tribe screens land on the right tab and the legacy /feed and /tribes routes
 * can redirect here.
 */
const SUB = [
  { key: "feed", label: "Feed", icon: Flame },
  { key: "tribes", label: "Tribes", icon: Users },
] as const;

const Squad = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: "feed" | "tribes" = searchParams.get("tab") === "tribes" ? "tribes" : "feed";
  const setTab = (next: "feed" | "tribes") =>
    setSearchParams(next === "feed" ? {} : { tab: next }, { replace: true });

  return (
    <div className="flex flex-col">
      <div className="page-header-premium px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="flex-1 flex gap-1 rounded-xl bg-[hsl(258_16%_6%/0.8)] border border-border/60 p-1 shadow-[inset_0_1px_3px_hsl(0_0%_0%/0.45)]">
          {SUB.map((s) => (
            <button
              key={s.key}
              onClick={() => { hapticSelection(); setTab(s.key); }}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-black transition-all active:scale-[0.98]",
                tab === s.key ? "bg-[linear-gradient(180deg,hsl(44_92%_66%),hsl(36_90%_56%)_50%,hsl(28_86%_48%))] text-[hsl(26_85%_10%)] shadow-[0_0_0_1px_hsl(40_80%_70%/0.3),inset_0_1px_0_hsl(48_100%_92%/0.6),inset_0_-1px_2px_hsl(16_80%_24%/0.4),0_2px_8px_-2px_hsl(28_90%_40%/0.5)]" : "text-muted-foreground",
              )}
            >
              <s.icon size={14} /> {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => { hapticSelection(); navigate("/friends"); }}
          aria-label="Friends"
          className="h-11 w-11 rounded-full bg-secondary/70 border border-border flex items-center justify-center text-foreground/90 shrink-0 active:scale-95 transition-transform"
        >
          <UserPlus size={17} />
        </button>
      </div>

      {tab === "feed" ? <EliteFeed /> : <Tribes />}
    </div>
  );
};

export default Squad;
