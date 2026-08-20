import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Flame, Users, Compass, UserPlus } from "lucide-react";
import EliteFeed from "./EliteFeed";
import Tribes from "./Tribes";
import { cn } from "@/lib/utils";
import { SEGMENT_ACTIVE } from "@/components/ui/segment";
import { hapticSelection } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Squad — the single social home. ONE segmented control: Feed · My Tribes ·
 * Browse. (The tribes area used to render its own second My Tribes/Browse
 * segment right under this one — two stacked gold pill rows read as clutter,
 * so the sub-tabs were promoted into this control and the second row died.)
 *
 * The active sub-tab lives in the URL (`/squad?tab=mine|browse`) so
 * back-links from tribe screens land on the right tab. The legacy
 * `?tab=tribes` (old push routes, old back-links) resolves to My Tribes for
 * members and Browse for newcomers.
 */
const SUB = [
  { key: "feed", label: "Feed", icon: Flame },
  { key: "mine", label: "My Tribes", icon: Users },
  { key: "browse", label: "Browse", icon: Compass },
] as const;

type Tab = (typeof SUB)[number]["key"];

const Squad = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const tab: Tab =
    raw === "mine" || raw === "browse" ? raw : raw === "tribes" ? "mine" : "feed";
  const setTab = (next: Tab) =>
    setSearchParams(next === "feed" ? {} : { tab: next }, { replace: true });

  // Legacy ?tab=tribes → members land on My Tribes, newcomers on Browse.
  useEffect(() => {
    if (raw !== "tribes" || !profile?.user_id) return;
    let alive = true;
    void supabase
      .from("tribe_members")
      .select("tribe_id")
      .eq("user_id", profile.user_id)
      .eq("status", "active")
      .limit(1)
      .then(({ data }) => {
        if (alive) setSearchParams({ tab: (data?.length ?? 0) > 0 ? "mine" : "browse" }, { replace: true });
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, profile?.user_id]);

  return (
    <div className="flex flex-col">
      <div className="page-header-premium px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="flex-1 flex gap-1 rounded-xl bg-[hsl(258_16%_6%/0.8)] border border-border/60 p-1 shadow-[inset_0_1px_3px_hsl(0_0%_0%/0.45)]">
          {SUB.map((s) => (
            <button
              key={s.key}
              onClick={() => { hapticSelection(); setTab(s.key); }}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1 rounded-lg py-2 px-1 text-[11px] font-black transition-all active:scale-[0.98] whitespace-nowrap",
                tab === s.key ? SEGMENT_ACTIVE : "text-muted-foreground",
              )}
            >
              <s.icon size={13} className="shrink-0" /> {s.label}
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

      {tab === "feed" ? <EliteFeed /> : <Tribes tab={tab === "browse" ? "browse" : "mine"} />}
    </div>
  );
};

export default Squad;
