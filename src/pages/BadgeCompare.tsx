import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { Search, Shield, Check, Minus } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserSearch } from "@/hooks/use-user-search";
import EmptyState from "@/components/ui/empty-state";
import ErrorState from "@/components/ui/error-state";
import { DoorRow } from "@/components/coach/rows";
import { backOr } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** One cell of the comparison: a check that is gold for you, muted for them. */
const Has = ({ yes, mine }: { yes: boolean; mine?: boolean }) => (
  <span className="w-8 shrink-0 flex justify-center" role="img" aria-label={yes ? "has it" : "does not have it"}>
    {yes
      ? <Check size={16} strokeWidth={2.5} className={mine ? "text-gold" : "text-muted-foreground"} aria-hidden />
      : <Minus size={16} className="text-muted-foreground/35" aria-hidden />}
  </span>
);

/**
 * /badges/compare — the badges between you. The beat says who is ahead and
 * by how much; the list is the graphic: every badge, two columns, the
 * differences on top.
 */
const BadgeCompare = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  // A profile's Compare button arrives with ?user=<username>; the page used
  // to drop it and open on "Pick someone".
  const [searchParams] = useSearchParams();
  const preset = searchParams.get("user") ?? "";
  const [searchQuery, setSearchQuery] = useState(preset);
  const [selectedUser, setSelectedUser] = useState<{ user_id: string; username: string } | null>(null);

  const badgesQ = useQuery({
    queryKey: ["all-badges"],
    queryFn: async () => {
      const { data } = await supabase.from("badges").select("*").order("rarity");
      return data || [];
    },
  });

  const { data: myBadgeIds } = useQuery({
    queryKey: ["my-badges", profile?.user_id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", profile.user_id);
      return data?.map((b) => b.badge_id) || [];
    },
    enabled: !!profile,
  });

  const { results: users } = useUserSearch(searchQuery, 10);
  useEffect(() => {
    if (selectedUser || !preset || !users) return;
    const hit = users.find((u) => u.username.toLowerCase() === preset.toLowerCase());
    if (hit) setSelectedUser(hit);
  }, [users, preset, selectedUser]);

  const theirsQ = useQuery({
    queryKey: ["their-badges", selectedUser?.user_id],
    queryFn: async () => {
      if (!selectedUser) return [];
      const { data } = await supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", selectedUser.user_id);
      return data?.map((b) => b.badge_id) || [];
    },
    enabled: !!selectedUser,
  });

  const mine = useMemo(() => new Set(myBadgeIds ?? []), [myBadgeIds]);
  const theirs = useMemo(() => new Set(theirsQ.data ?? []), [theirsQ.data]);
  const ready = !!selectedUser && badgesQ.data != null && theirsQ.data != null;

  // Differences first, then shared, then the ones neither has earned.
  const rows = useMemo(
    () =>
      (badgesQ.data ?? [])
        .map((b) => ({ b, me: mine.has(b.id), them: theirs.has(b.id) }))
        .sort((x, y) => (x.me !== x.them ? 0 : x.me ? 1 : 2) - (y.me !== y.them ? 0 : y.me ? 1 : 2)),
    [badgesQ.data, mine, theirs],
  );
  const youOnly = rows.filter((r) => r.me && !r.them).length;
  const themOnly = rows.filter((r) => r.them && !r.me).length;
  const even = ready && youOnly === 0 && themOnly === 0;
  const failed = badgesQ.isError ? badgesQ : theirsQ.isError ? theirsQ : null;

  const beat = !selectedUser
    ? "The badges between you."
    : !ready
      ? `@${selectedUser.username} and you.`
      : youOnly > 0
        ? <>You have <span className="text-gold glow-gold-text tabular-nums">{youOnly}</span> they don't.</>
        : themOnly > 0
          ? `They have ${themOnly} you don't.`
          : "Nothing between you.";

  return (
    <div className="min-h-full">
      <PageBar title="Badge compare" onBack={() => backOr(navigate, "/profile")} />

      <div className="px-4 pt-4 pb-6">
        <header className="home-rise">
          <h2 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">{beat}</h2>
          {ready && (
            <p className="mt-1.5 text-[13px] text-muted-foreground leading-snug tabular-nums">
              {mine.size} badge{mine.size === 1 ? "" : "s"} to @{selectedUser!.username}'s {theirs.size}.
            </p>
          )}
        </header>

        <div className="relative home-rise home-rise-1 mt-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="text"
            placeholder="Search by username"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.length < 2) setSelectedUser(null);
            }}
            className="h-11 rounded-xl pl-10 text-sm"
          />
        </div>

        {!selectedUser && users && users.length > 0 && (
          <div className="mt-2 divide-y divide-border/35 border-t border-border/35">
            {users.map((u) => (
              <DoorRow
                key={u.user_id}
                label={`@${u.username}`}
                onClick={() => { setSelectedUser(u); setSearchQuery(u.username); }}
              />
            ))}
          </div>
        )}

        {!selectedUser && (!users || users.length === 0) && (
          <div className="home-rise home-rise-2 mt-6">
            <EmptyState
              icon={Shield}
              title="Pick someone"
              description="Search a username. Every badge, two columns: yours and theirs."
            />
          </div>
        )}

        {selectedUser && (
          <div className="home-rise home-rise-2 mt-5">
            {failed ? (
              <ErrorState title="Couldn't load the badges" onRetry={failed.refetch} />
            ) : !ready ? (
              <div className="space-y-1">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl bg-card/40 skeleton-block" />)}
              </div>
            ) : even ? (
              <EmptyState
                icon={Shield}
                title={mine.size === 0 ? "No badges yet" : "Dead even"}
                description={
                  mine.size === 0
                    ? "Neither of you has earned one. Yours start with a check-in."
                    : `You and @${selectedUser.username} hold the same ${mine.size} badge${mine.size === 1 ? "" : "s"}.`
                }
              />
            ) : (
              <>
                <div className="flex items-center gap-3 pb-1 text-[11px] font-bold text-muted-foreground">
                  <span className="flex-1" />
                  <span className="w-8 text-center">You</span>
                  <span className="w-8 text-center truncate">Them</span>
                </div>
                <ul className="divide-y divide-border/35 border-t border-border/35">
                  {rows.map(({ b, me, them }) => (
                    <li key={b.id} className={cn("flex items-center gap-3 py-2.5", !me && !them && "text-muted-foreground")}>
                      <span className="w-8 shrink-0 text-center text-lg leading-none" aria-hidden>{b.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-bold leading-tight truncate">{b.name}</span>
                        <span className="block text-[12px] text-muted-foreground leading-snug capitalize">{b.rarity}</span>
                      </span>
                      <Has yes={me} mine />
                      <Has yes={them} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BadgeCompare;
