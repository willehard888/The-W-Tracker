import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Search, Flame, ChevronRight, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFriends, type Friend } from "@/hooks/use-friends";
import { cn } from "@/lib/utils";
import { avatarUrl } from "@/lib/img";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  /** user_ids to hide (e.g. existing pod members). */
  excludeIds?: string[];
  /** Called when a friend is tapped. Return a promise to show a spinner. */
  onPick: (friend: Friend) => void | Promise<void>;
  busyId?: string | null;
}

/** Bottom-sheet that lets the user pick one of their friends. */
const FriendPickerSheet = ({ open, onOpenChange, title, subtitle, excludeIds = [], onPick, busyId }: Props) => {
  const navigate = useNavigate();
  const { data: friends, isLoading } = useFriends();
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const ex = new Set(excludeIds);
    return (friends ?? [])
      .filter((f) => !ex.has(f.user_id))
      .filter((f) => f.username?.toLowerCase().includes(q.trim().toLowerCase()));
  }, [friends, excludeIds, q]);

  return (
    <BottomSheet open={open} onClose={() => onOpenChange(false)} label={title} title={title} subtitle={subtitle}>
        <div className="pt-1 pb-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search friends"
              className="h-11 rounded-xl pl-9 pr-9 text-[13px]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          {isLoading ? (
            <div className="h-16 rounded-xl bg-card/60 animate-pulse" />
          ) : list.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[13px] font-bold text-foreground">
                {(friends ?? []).length === 0 ? "No friends yet" : "No one to pick"}
              </p>
              <p className="text-[12px] text-muted-foreground mt-1 mb-4 leading-snug">
                {(friends ?? []).length === 0
                  ? "Add friends to invite them and challenge them."
                  : "Everyone's already here."}
              </p>
              {(friends ?? []).length === 0 && (
                <button
                  onClick={() => { onOpenChange(false); navigate("/friends"); }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2.5 text-[12px] font-black text-primary-foreground"
                >
                  <UserPlus size={14} /> Add friends
                </button>
              )}
            </div>
          ) : (
            list.map((f) => (
              <button
                key={f.user_id}
                disabled={busyId === f.user_id}
                onClick={() => onPick(f)}
                className="press w-full flex items-center gap-3 surface-card p-2.5 text-left transition-transform disabled:opacity-50"
              >
                <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-gold/40 to-card flex items-center justify-center text-[13px] font-black text-gold shrink-0">
                  {f.avatar_url ? (
                    <img src={avatarUrl(f.avatar_url, 40)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    (f.username?.charAt(0) || "?").toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate">@{f.username}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span>Lv {f.level ?? 1}</span>
                    {(f.streak ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[hsl(var(--streak-orange))]">
                        <Flame size={11} /> {f.streak}
                      </span>
                    )}
                  </p>
                </div>
                {busyId === f.user_id ? (
                  <span className="text-[12px] text-muted-foreground">…</span>
                ) : (
                  <ChevronRight size={16} className={cn("text-gold/60 shrink-0")} />
                )}
              </button>
            ))
          )}
        </div>
    </BottomSheet>
  );
};

export default FriendPickerSheet;
