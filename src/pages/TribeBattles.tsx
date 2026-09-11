import { useEffect, useState, useCallback } from "react";
import { Block } from "@/components/skeletons/PageSkeleton";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Flame, History, Swords } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import EmptyState from "@/components/ui/empty-state";
import { DoorRow } from "@/components/coach/rows";
import { SEGMENT_TRACK, SEGMENT_ACTIVE, SEGMENT_IDLE } from "@/components/ui/segment";
import { hapticSelection } from "@/lib/haptics";
import { backOr } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { fmtInt } from "@/lib/format";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import TribeBattleCard, { TribeBattleRow, type TribeBattle } from "@/components/TribeBattleCard";
import TribeChallengeModal from "@/components/TribeChallengeModal";
import {
  collectiveTierName,
  collectiveStreakTier,
  collectivePalette,
  fetchTribeCollectiveStreak,
  fetchTribeCollectiveStreaks,
} from "@/lib/tribe-streak";
import TribeFireLite from "@/components/TribeFireLite";
import { daysLeft, daysLeftLine } from "@/components/battles/battle-time";
import { captureException } from "@/lib/observability";
import { ErrorState } from "@/components/ui/error-state";

type Tab = "active" | "pending" | "history";
const TABS: { id: Tab; label: string }[] = [
  { id: "active", label: "Live" },
  { id: "pending", label: "Pending" },
  { id: "history", label: "Past" },
];

/** The screen's silhouette while the arena resolves: the beat, the hero, the segment, rows. */
const TribeBattlesSkeleton = () => (
  <div className="animate-fade-in">
    <Block height={30} className="w-4/5 !rounded-lg" />
    <Block height={220} delay={60} className="mt-5 !rounded-2xl" />
    <Block height={44} delay={120} className="mt-6" />
    {[0, 1].map((i) => <Block key={i} height={52} delay={180 + i * 40} className="mt-3" />)}
  </div>
);

const TribeBattles = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [tribe, setTribe] = useState<{ id: string; name: string; owner_id: string } | null>(null);
  const [collectiveStreak, setCollectiveStreak] = useState(0);
  const [battles, setBattles] = useState<TribeBattle[]>([]);
  const [loading, setLoading] = useState(true);
  // A failed read left `tribe` null, which rendered "Tribe not found — it may
  // have been disbanded, or the link is old." A network blip told a member
  // their tribe was gone.
  const [failed, setFailed] = useState(false);
  // null until the first tap: the default segment is the first one with rows.
  const [tab, setTab] = useState<Tab | null>(null);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const isOwner = !!profile?.user_id && tribe?.owner_id === profile.user_id;
  const [isMember, setIsMember] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setFailed(false);

    // Any active member can raise a challenge (founder decision) — the old
    // owner-only gate left everyone else with three empty tabs.
    if (profile?.user_id) {
      const { data: mem } = await supabase
        .from("tribe_members")
        .select("status")
        .eq("tribe_id", id)
        .eq("user_id", profile.user_id)
        .eq("status", "active")
        .maybeSingle();
      setIsMember(!!mem);
    }

    // Auto-resolve any expired battles first. Genuinely best-effort — the
    // board still renders without it — but rpc() resolves with { error }
    // rather than rejecting, so the old catch never saw a failure.
    const { error: resolveErr } = await supabase.rpc("auto_resolve_expired_tribe_battles");
    if (resolveErr) console.warn("[battles] auto-resolve failed", resolveErr);

    const [tRes, bRes] = await Promise.all([
      supabase.from("tribes").select("id, name, owner_id").eq("id", id).maybeSingle(),
      supabase
        .from("tribe_battles")
        .select("*")
        .or(`challenger_tribe_id.eq.${id},opponent_tribe_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (tRes.error || bRes.error) {
      captureException(tRes.error ?? bRes.error, { where: "tribeBattles.load", tribeId: id });
      setFailed(true);
      setLoading(false);
      return;
    }

    setTribe(tRes.data ?? null);
    const rawBattles: TribeBattle[] = (bRes.data ?? []) as TribeBattle[];

    // Hydrate tribe info for both sides
    const tribeIds = Array.from(
      new Set(rawBattles.flatMap((b) => [b.challenger_tribe_id, b.opponent_tribe_id])),
    );
    let myStreak = 0;
    if (tribeIds.length > 0) {
      const [{ data: tribesData }, streaksMap] = await Promise.all([
        supabase
          .from("tribes")
          .select("id, name, member_count")
          .in("id", tribeIds),
        fetchTribeCollectiveStreaks(tribeIds),
      ]);
      const tMap = new Map((tribesData ?? []).map((t) => [t.id, t]));
      rawBattles.forEach((b) => {
        const c = tMap.get(b.challenger_tribe_id);
        const o = tMap.get(b.opponent_tribe_id);
        b.challenger = c ? { ...c, collective_streak: streaksMap.get(b.challenger_tribe_id) ?? 0 } : undefined;
        b.opponent = o ? { ...o, collective_streak: streaksMap.get(b.opponent_tribe_id) ?? 0 } : undefined;
      });
      myStreak = streaksMap.get(id) ?? 0;
    }
    // No battles yet → still need our own collective streak for the standing line
    if (myStreak === 0 && tribeIds.length === 0) {
      myStreak = await fetchTribeCollectiveStreak(id);
    }
    setCollectiveStreak(myStreak);

    setBattles(rawBattles);
    setLoading(false);
  }, [id, profile?.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (battleId: string, accept: boolean) => {
    setRespondingId(battleId);
    const { error } = await supabase.rpc("respond_to_tribe_battle", {
      p_battle_id: battleId,
      p_accept: accept,
    });
    setRespondingId(null);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success(accept ? "Battle on." : "Challenge declined");
    load();
  };

  if (loading) {
    return (
      <div className="min-h-full">
        <PageBar onBack={() => backOr(navigate, `/tribes/${id}`)} />
        <div className="px-4 pt-4 pb-6"><TribeBattlesSkeleton /></div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="min-h-full">
        <PageBar title="Tribe battles" onBack={() => backOr(navigate, "/squad?tab=tribes")} />
        <div className="px-4 pt-4 pb-6 home-rise">
          <ErrorState onRetry={load} />
        </div>
      </div>
    );
  }

  if (!tribe) {
    return (
      <div className="min-h-full">
        <PageBar title="Tribe battles" onBack={() => backOr(navigate, "/squad?tab=tribes")} />
        <div className="px-4 pt-4 pb-6 home-rise">
          <EmptyState
            icon={Swords}
            title="Tribe not found"
            description="It may have been disbanded, or the link is old."
            action={
              <Button variant="gold-outline" size="sm" className="min-h-11" onClick={() => navigate("/squad?tab=tribes", { replace: true })}>
                Back to tribes
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  // The hero is the live battle ending soonest, else the challenge waiting on us.
  const active = battles
    .filter((b) => b.status === "active")
    .sort((a, b) => daysLeft(a.started_at, a.duration_days) - daysLeft(b.started_at, b.duration_days));
  const pending = battles.filter((b) => b.status === "pending");
  const history = battles.filter((b) => ["completed", "declined", "expired"].includes(b.status));
  const incoming = pending.filter((b) => b.opponent_tribe_id === id);
  const hero = active[0] ?? incoming[0];
  const rows: Record<Tab, TribeBattle[]> = {
    active: active.filter((b) => b !== hero),
    pending: pending.filter((b) => b !== hero),
    history,
  };
  const hasRows = rows.active.length + rows.pending.length + rows.history.length > 0;
  const shown: Tab = tab ?? (rows.active.length ? "active" : rows.pending.length ? "pending" : "history");

  const rival = (b: TribeBattle) => (b.challenger_tribe_id === id ? b.opponent : b.challenger)?.name ?? "another tribe";
  const beat = hero?.status === "active"
    ? daysLeftLine(daysLeft(hero.started_at, hero.duration_days), rival(hero))
    : hero
      ? incoming.length > 1 ? `${incoming.length} tribes want an answer.` : `${rival(hero)} is coming for you.`
      : pending.length > 0
        ? "Your challenge is out."
        : "No rival yet.";

  const tier = collectiveStreakTier(collectiveStreak);
  const canChallenge = isMember || isOwner;

  return (
    <div className="min-h-full">
      <PageBar title={tribe.name} onBack={() => backOr(navigate, `/tribes/${id}`)} />
      <div className="px-4 pt-4 pb-6">
        {/* Opening beat — who's coming for the tribe, stated once. */}
        <h2 className="home-rise font-display font-black text-[27px] leading-[1.04] tracking-tight">{beat}</h2>

        {hero ? (
          <div className="home-rise home-rise-1 mt-5">
            <TribeBattleCard
              battle={hero}
              myTribeId={id!}
              isOwner={isOwner}
              onAccept={() => respond(hero.id, true)}
              onDecline={() => respond(hero.id, false)}
              responding={respondingId === hero.id}
            />
          </div>
        ) : (
          /* No battle to frame: the tribe's own fire stands alone. */
          <div className="home-rise home-rise-1 mt-5 flex items-center gap-3">
            {/* The lit fire stands on the line's baseline; the cold fallback
                is a plain icon and belongs beside the text, not under it. */}
            <div className={cn("w-10 h-11 flex justify-center shrink-0", tier >= 0 ? "items-end" : "items-center")} aria-hidden>
              {tier >= 0 ? (
                <TribeFireLite tier={tier} palette={collectivePalette(collectiveStreak)} variant="mini" size={32} />
              ) : (
                <Flame aria-hidden size={16} className="text-muted-foreground/75" strokeWidth={1.6} />
              )}
            </div>
            <p className="text-[13px] text-muted-foreground leading-snug">
              Collective streak <span className="font-bold text-foreground tabular-nums">{fmtInt(collectiveStreak)}d</span> · {collectiveTierName(collectiveStreak)}.
            </p>
          </div>
        )}

        {/* The door — one flow: pick a tribe in the challenge sheet. */}
        {canChallenge && (
          <div className="home-rise home-rise-2 mt-6 border-y border-border/35">
            <DoorRow
              icon={Swords}
              label="Challenge another tribe"
              sub="Combined member XP decides. Winners take +50 XP each."
              onClick={() => setChallengeOpen(true)}
            />
          </div>
        )}

        {hasRows && (
          <div className="home-rise home-rise-3 mt-6">
            <div className={SEGMENT_TRACK} role="tablist" aria-label="Battles">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={shown === t.id}
                  onClick={() => { void hapticSelection(); setTab(t.id); }}
                  className={cn("eyebrow flex-1 min-h-11 rounded-lg transition-colors", shown === t.id ? SEGMENT_ACTIVE : SEGMENT_IDLE)}
                >
                  {t.label}{rows[t.id].length > 0 && t.id !== "history" ? ` ${rows[t.id].length}` : ""}
                </button>
              ))}
            </div>

            <div className="mt-2 divide-y divide-border/35">
              {rows[shown].length === 0 ? (
                <EmptyState
                  size="compact"
                  icon={shown === "history" ? History : Swords}
                  title={shown === "active" ? (hero?.status === "active" ? "The live one is above" : "No live battles")
                    : shown === "pending" ? "No pending challenges"
                    : "No past battles"}
                />
              ) : (
                rows[shown].map((b) => (
                  <TribeBattleRow
                    key={b.id}
                    battle={b}
                    myTribeId={id!}
                    onAccept={isOwner && b.status === "pending" && b.opponent_tribe_id === id ? () => respond(b.id, true) : undefined}
                    onDecline={isOwner && b.status === "pending" && b.opponent_tribe_id === id ? () => respond(b.id, false) : undefined}
                    responding={respondingId === b.id}
                  />
                ))
              )}
            </div>
          </div>
        )}

        <TribeChallengeModal
          open={challengeOpen}
          onOpenChange={setChallengeOpen}
          challengerTribeId={id!}
          onCreated={load}
        />
      </div>
    </div>
  );
};

export default TribeBattles;
