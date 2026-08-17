import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Swords, Loader2, ChevronRight, Flame, Clock, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface MyTribe {
  id: string;
  name: string;
}

interface TribeBattleRow {
  id: string;
  status: "pending" | "active" | "completed" | "declined" | "expired";
  challenger_tribe_id: string;
  opponent_tribe_id: string;
  challenger_score: number;
  opponent_score: number;
  duration_days: number;
  started_at: string | null;
  ended_at: string | null;
  winner_tribe_id: string | null;
  challenger_name?: string;
  opponent_name?: string;
}

const MyTribeBattles = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tribes, setTribes] = useState<MyTribe[]>([]);
  const [battles, setBattles] = useState<TribeBattleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.user_id) return;
    setLoading(true);

    // Best-effort auto-resolve expired battles
    try {
      await supabase.rpc("auto_resolve_expired_tribe_battles" as any);
    } catch {
      // ignore
    }

    // Find tribes the user belongs to
    const { data: mems } = await supabase
      .from("tribe_members")
      .select("tribe_id")
      .eq("user_id", profile.user_id)
      .eq("status", "active");

    const tribeIds: string[] = ((mems as any) ?? []).map((m: any) => m.tribe_id);
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
    setTribes(((tribesData as any) ?? []) as MyTribe[]);

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

    const raw: TribeBattleRow[] = ((battleData as any) ?? []) as any[];
    const allTribeIds = Array.from(
      new Set(raw.flatMap((b) => [b.challenger_tribe_id, b.opponent_tribe_id])),
    );
    if (allTribeIds.length > 0) {
      const { data: nameRows } = await supabase
        .from("tribes")
        .select("id, name")
        .in("id", allTribeIds);
      const nameMap = new Map<string, string>(
        ((nameRows as any) ?? []).map((t: any) => [t.id as string, t.name as string]),
      );
      raw.forEach((b) => {
        b.challenger_name = nameMap.get(b.challenger_tribe_id);
        b.opponent_name = nameMap.get(b.opponent_tribe_id);
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
      <div className="flex justify-center py-6">
        <Loader2 size={16} className="animate-spin text-[hsl(var(--ember))]" />
      </div>
    );
  }

  if (tribes.length === 0) {
    // User has no tribes — soft CTA
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <Swords size={14} className="text-[hsl(var(--ember))]" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Tribe Battles
          </p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Join or found a tribe to wage collective battles.
        </p>
        <button
          onClick={() => navigate("/squad?tab=tribes")}
          className="text-[11px] font-black uppercase tracking-widest text-gold inline-flex items-center gap-1"
        >
          Find a tribe <ChevronRight size={12} />
        </button>
      </div>
    );
  }

  const active = battles.filter((b) => b.status === "active");
  const pending = battles.filter((b) => b.status === "pending");
  const recent = battles.filter((b) => ["completed", "expired", "declined"].includes(b.status)).slice(0, 3);

  const tribeIdSet = new Set(tribes.map((t) => t.id));

  const renderRow = (b: TribeBattleRow) => {
    const myIsChallenger = tribeIdSet.has(b.challenger_tribe_id);
    const meName = myIsChallenger ? b.challenger_name : b.opponent_name;
    const themName = myIsChallenger ? b.opponent_name : b.challenger_name;
    const myTribeId = myIsChallenger ? b.challenger_tribe_id : b.opponent_tribe_id;
    const myScore = myIsChallenger ? b.challenger_score : b.opponent_score;
    const theirScore = myIsChallenger ? b.opponent_score : b.challenger_score;
    const totalScore = Math.max(myScore + theirScore, 1);
    const myPct = (myScore / totalScore) * 100;

    const startedAt = b.started_at ? new Date(b.started_at) : null;
    const endsAt = startedAt
      ? new Date(startedAt.getTime() + b.duration_days * 24 * 60 * 60 * 1000)
      : null;
    const daysLeft = endsAt
      ? Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

    const iWon = b.winner_tribe_id === myTribeId;
    const isDraw = b.status === "completed" && !b.winner_tribe_id;

    return (
      <button
        key={b.id}
        onClick={() => navigate(`/tribes/${myTribeId}/battles`)}
        className={cn(
          "w-full text-left rounded-xl border p-3 transition-transform active:scale-[0.99]",
          b.status === "active" &&
            "border-[hsl(var(--ember))]/45 bg-gradient-to-br from-[hsl(var(--ember))]/[0.07] to-card/60 shadow-[0_0_18px_hsl(var(--ember)/0.12)]",
          b.status === "pending" && "border-gold/40 bg-gradient-to-br from-gold/[0.05] to-card/60",
          b.status === "completed" && iWon && "border-gold/50 bg-gradient-to-br from-gold/[0.08] to-card/60",
          b.status === "completed" && !iWon && !isDraw && "border-border/50 bg-card/50",
          b.status === "completed" && isDraw && "border-border/60 bg-card/50",
          (b.status === "declined" || b.status === "expired") && "border-border/40 bg-card/30 opacity-80",
        )}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-black text-muted-foreground">
            <Swords size={10} className="text-[hsl(var(--ember))]" />
            {b.status === "pending" && (myIsChallenger ? "Awaiting" : "Incoming")}
            {b.status === "active" && <span className="text-[hsl(var(--ember))]">Live</span>}
            {b.status === "completed" && (iWon ? <span className="text-gold">Victory</span> : isDraw ? "Draw" : "Defeat")}
            {b.status === "declined" && "Declined"}
            {b.status === "expired" && "Expired"}
          </div>
          {b.status === "active" && daysLeft !== null && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-foreground/80">
              <Clock size={9} /> {daysLeft === 0 ? "Ending" : `${daysLeft}d left`}
            </span>
          )}
          {b.status === "completed" && iWon && <Trophy size={12} className="text-gold" />}
        </div>

        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-display font-black text-xs truncate text-gold flex-1 min-w-0">
            {meName ?? "Your tribe"}
          </span>
          <span className="text-[10px] font-black text-muted-foreground">VS</span>
          <span className="font-display font-black text-xs truncate text-foreground flex-1 min-w-0 text-right">
            {themName ?? "—"}
          </span>
        </div>

        {(b.status === "active" || b.status === "completed") && (
          <>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-black tabular-nums text-gold">{myScore.toLocaleString()} XP</span>
              <span className="text-[11px] font-black tabular-nums text-foreground/80">{theirScore.toLocaleString()} XP</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-gold to-[hsl(var(--ember))] transition-all"
                style={{ width: `${myPct}%` }}
              />
              <div className="h-full bg-foreground/30" style={{ width: `${100 - myPct}%` }} />
            </div>
          </>
        )}
      </button>
    );
  };

  const showSection = active.length + pending.length + recent.length > 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Swords size={13} className="text-[hsl(var(--ember))]" />
          <h2 className="font-display font-bold text-sm tracking-tight">Tribe Battles</h2>
          {active.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[hsl(var(--ember))] px-1.5 py-0.5 rounded-full bg-[hsl(var(--ember))]/10 border border-[hsl(var(--ember))]/30">
              <Flame size={8} /> {active.length} live
            </span>
          )}
        </div>
        {tribes.length === 1 ? (
          <button
            onClick={() => navigate(`/tribes/${tribes[0].id}/battles`)}
            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-gold inline-flex items-center gap-0.5"
          >
            View all <ChevronRight size={10} />
          </button>
        ) : (
          <button
            onClick={() => navigate("/squad?tab=tribes")}
            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-gold inline-flex items-center gap-0.5"
          >
            My tribes <ChevronRight size={10} />
          </button>
        )}
      </div>

      {!showSection ? (
        <div className="rounded-xl border border-dashed border-border/60 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            No tribe battles yet. Owners can challenge another tribe.
          </p>
          {tribes.length === 1 ? (
            <button
              onClick={() => navigate(`/tribes/${tribes[0].id}/battles`)}
              className="text-[11px] font-black uppercase tracking-widest text-[hsl(var(--ember))] inline-flex items-center gap-1"
            >
              Open arena <ChevronRight size={12} />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {[...active, ...pending, ...recent].map(renderRow)}
        </div>
      )}
    </div>
  );
};

export default MyTribeBattles;
