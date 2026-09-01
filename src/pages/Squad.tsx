import { useSearchParams } from "react-router-dom";
import { Flame, Users } from "lucide-react";
import EliteFeed from "./EliteFeed";
import Tribes from "./Tribes";
import { cn } from "@/lib/utils";
import { SEGMENT_ACTIVE } from "@/components/ui/segment";
import { hapticSelection } from "@/lib/haptics";
import { useOnboardingTrigger, useSpotlightTarget } from "@/components/onboarding/onboarding-context";

/**
 * Squad — the single social home. Feed and Tribes stay SEPARATE top-level
 * destinations behind one gold segmented control (founder call). Inside
 * Tribes, the My Tribes/Browse split renders as quiet underline tabs — a
 * subordinate visual language, never a second gold pill row stacked under
 * this one (that stack was the "looks cheap" complaint).
 *
 * The active tab lives in the URL so back-links from tribe screens land
 * right: `?tab=tribes` (canonical), with `?tab=mine|browse` accepted as
 * aliases that also pre-select the sub-tab.
 */
const SUB = [
  { key: "feed", label: "Feed", icon: Flame },
  { key: "tribes", label: "Tribes", icon: Users },
] as const;

const Squad = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const tab: "feed" | "tribes" =
    raw === "tribes" || raw === "mine" || raw === "browse" ? "tribes" : "feed";
  // mine/browse aliases pre-select the sub-tab inside Tribes.
  const initialSub = raw === "mine" || raw === "browse" ? raw : undefined;
  const setTab = (next: "feed" | "tribes") =>
    setSearchParams(next === "feed" ? {} : { tab: next }, { replace: true });
  // Contextual onboarding: first /squad visit → explain the Feed/Tribes split.
  const squadTargetRef = useSpotlightTarget("SQUAD_INTRO");
  useOnboardingTrigger("SQUAD_INTRO", true);

  return (
    <div className="flex flex-col">
      <div className="page-header-premium px-4 pt-3 pb-2 flex items-center gap-2">
        <div ref={squadTargetRef} className="flex-1 flex gap-1 surface-inset rounded-xl p-1">
          {SUB.map((s) => (
            <button
              key={s.key}
              onClick={() => { hapticSelection(); setTab(s.key); }}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-black transition-all active:scale-[0.98]",
                tab === s.key ? SEGMENT_ACTIVE : "text-muted-foreground",
              )}
            >
              <s.icon aria-hidden size={14} /> {s.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "feed" ? <EliteFeed /> : <Tribes initialSub={initialSub} />}
    </div>
  );
};

export default Squad;
