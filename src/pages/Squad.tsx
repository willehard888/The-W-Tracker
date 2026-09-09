import { useNavigate, useSearchParams } from "react-router-dom";
import { Flame, MessageCircle, Users } from "lucide-react";
import EliteFeed from "./EliteFeed";
import Tribes from "./Tribes";
import { cn } from "@/lib/utils";
import { SEGMENT_TRACK, SEGMENT_ACTIVE, SEGMENT_IDLE } from "@/components/ui/segment";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { useUnreadMessageCount } from "@/hooks/use-messages";
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

// Module-level, not state: leaving the Squad tab unmounts the page, and a
// per-mount set meant Feed and Tribes were rebuilt from scratch on every
// return (their queries are cached; their trees were not).
const visited = new Set<string>();

const Squad = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const unread = useUnreadMessageCount().data ?? 0;
  const raw = searchParams.get("tab");
  const tab: "feed" | "tribes" =
    raw === "tribes" || raw === "mine" || raw === "browse" ? "tribes" : "feed";
  // mine/browse aliases pre-select the sub-tab inside Tribes.
  const initialSub = raw === "mine" || raw === "browse" ? raw : undefined;
  const setTab = (next: "feed" | "tribes") =>
    setSearchParams(next === "feed" ? {} : { tab: next }, { replace: true });
  visited.add(tab);
  // Contextual onboarding: first /squad visit → explain the Feed/Tribes split.
  const squadTargetRef = useSpotlightTarget("SQUAD_INTRO");
  useOnboardingTrigger("SQUAD_INTRO", true);

  return (
    <div className="flex flex-col">
      <div className="home-rise px-4 pt-3 pb-2 flex items-center gap-2">
        <div ref={squadTargetRef} className={cn(SEGMENT_TRACK, "flex-1")}>
          {SUB.map((s) => (
            <button
              key={s.key}
              onClick={() => { hapticSelection(); setTab(s.key); }}
              className={cn(
                "relative before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] flex-1 min-h-9 inline-flex items-center justify-center gap-1.5 rounded-lg text-[12px] font-black transition-colors",
                tab === s.key ? SEGMENT_ACTIVE : SEGMENT_IDLE,
              )}
            >
              <s.icon aria-hidden size={14} /> {s.label}
            </button>
          ))}
        </div>
        {/* The door the tab bar always implied: /messages maps to this tab but
            nothing on screen went there. */}
        <button
          type="button"
          aria-label={unread > 0 ? `Messages — ${unread} unread` : "Messages"}
          onClick={() => { hapticImpact("light"); navigate("/messages"); }}
          className="press relative h-11 w-11 rounded-xl inline-flex items-center justify-center text-muted-foreground/80 hover:text-foreground hover:bg-secondary transition-colors"
        >
          <MessageCircle aria-hidden size={18} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-[hsl(var(--ember))] text-white text-[10px] font-black flex items-center justify-center tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </div>

      {/* A visited tab stays mounted and parks under display:none — the
          segment used to destroy and rebuild a 1 000-line tree on every tap. */}
      {visited.has("feed") && <div hidden={tab !== "feed"}><EliteFeed /></div>}
      {visited.has("tribes") && <div hidden={tab !== "tribes"}><Tribes initialSub={initialSub} /></div>}
    </div>
  );
};

export default Squad;
