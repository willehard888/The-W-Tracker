import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DoorRow } from "@/components/coach/rows";
import { Block } from "@/components/skeletons/PageSkeleton";
import { TribeBattleRow, type TribeBattleLite } from "@/components/TribeBattleCard";

interface MyTribe {
  id: string;
  name: string;
}

/** The label above the rows. Plain 11 px, ember only when something is live. */
const Label = ({ live }: { live: number }) => (
  <h3 className="text-[11px] font-bold text-muted-foreground">
    Tribe battles{live > 0 && <span className="text-[hsl(var(--ember))]"> · {live} live</span>}
  </h3>
);

/**
 * Tribe wars on the Battles page: the same hairline row grammar one level
 * down, and one door to the arena. Rows lead to the tribe's own arena.
 */
const MyTribeBattles = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tribes, setTribes] = useState<MyTribe[]>([]);
  const [battles, setBattles] = useState<TribeBattleLite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.user_id) return;
    setLoading(true);

    // Best-effort auto-resolve expired battles. rpc() resolves with { error }
    // rather than rejecting, so the old catch never saw a failure.
    const { error: resolveErr } = await supabase.rpc("auto_resolve_expired_tribe_battles");
    if (resolveErr) console.warn("[battles] auto-resolve failed", resolveErr);

    // Find tribes the user belongs to
    const { data: mems } = await supabase
      .from("tribe_members")
      .select("tribe_id")
      .eq("user_id", profile.user_id)
      .eq("status", "active");

    const tribeIds: string[] = (mems ?? []).map((m) => m.tribe_id);
    if (tribeIds.length === 0) {
      setTribes([]);
      setBattles([]);
      setLoading(false);
      return;
    }

    const { data: tribesData } = await supabase
      .from("tribes")
      .select("id, name")
      .in("id", tribeIds);
    setTribes(tribesData ?? []);

    // Fetch battles where any of my tribes participate
    const orFilter = tribeIds
      .flatMap((id) => [`challenger_tribe_id.eq.${id}`, `opponent_tribe_id.eq.${id}`])
      .join(",");

    const { data: battleData } = await supabase
      .from("tribe_battles")
      .select(
        "id, status, challenger_tribe_id, opponent_tribe_id, challenger_score, opponent_score, duration_days, started_at, ended_at, winner_tribe_id, created_at",
      )
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(20);

    const raw: TribeBattleLite[] = (battleData ?? []) as TribeBattleLite[];
    const allTribeIds = Array.from(
      new Set(raw.flatMap((b) => [b.challenger_tribe_id, b.opponent_tribe_id])),
    );
    if (allTribeIds.length > 0) {
      const { data: nameRows } = await supabase
        .from("tribes")
        .select("id, name")
        .in("id", allTribeIds);
      const sides = new Map((nameRows ?? []).map((t) => [t.id, t]));
      raw.forEach((b) => {
        b.challenger = sides.get(b.challenger_tribe_id);
        b.opponent = sides.get(b.opponent_tribe_id);
      });
    }

    setBattles(raw);
    setLoading(false);
  }, [profile?.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <section>
        <Label live={0} />
        <div className="mt-1 animate-fade-in">
          {[0, 1].map((i) => <Block key={i} height={52} delay={i * 40} className="mt-2" />)}
        </div>
      </section>
    );
  }

  if (tribes.length === 0) {
    return (
      <section>
        <Label live={0} />
        <div className="mt-1 border-y border-border/35">
          <DoorRow
            icon={Swords}
            label="Find a tribe"
            sub="Join or found one to wage collective battles."
            onClick={() => navigate("/squad?tab=tribes")}
          />
        </div>
      </section>
    );
  }

  const active = battles.filter((b) => b.status === "active");
  const pending = battles.filter((b) => b.status === "pending");
  const recent = battles.filter((b) => ["completed", "expired", "declined"].includes(b.status)).slice(0, 3);
  const rows = [...active, ...pending, ...recent];

  const tribeIdSet = new Set(tribes.map((t) => t.id));
  const myTribeIdOf = (b: TribeBattleLite) =>
    tribeIdSet.has(b.challenger_tribe_id) ? b.challenger_tribe_id : b.opponent_tribe_id;
  const arena = tribes.length === 1 ? `/tribes/${tribes[0].id}/battles` : "/squad?tab=tribes";

  return (
    <section>
      <Label live={active.length} />
      <div className="mt-1 divide-y divide-border/35 border-y border-border/35">
        {rows.map((b) => (
          <TribeBattleRow
            key={b.id}
            battle={b}
            myTribeId={myTribeIdOf(b)}
            onClick={() => navigate(`/tribes/${myTribeIdOf(b)}/battles`)}
          />
        ))}
        <DoorRow
          icon={Swords}
          label={tribes.length === 1 ? "Open the arena" : "My tribes"}
          sub={rows.length === 0 ? "No tribe battles yet. Challenge another tribe." : undefined}
          onClick={() => navigate(arena)}
        />
      </div>
    </section>
  );
};

export default MyTribeBattles;
