import { useEffect, useState, useCallback } from "react";
import { DetailSkeleton } from "@/components/skeletons/PageSkeleton";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Plus, Swords, Clock, History } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import TribeBattleCard, { type TribeBattle } from "@/components/TribeBattleCard";
import TribeChallengeModal from "@/components/TribeChallengeModal";
import EmptyStateUI from "@/components/ui/empty-state";
import {
  collectiveAccent,
  tierPalette,
  collectiveStreakTier,
  fetchTribeCollectiveStreak,
  fetchTribeCollectiveStreaks,
} from "@/lib/tribe-streak";
import TribeFireLite from "@/components/TribeFireLite";

const TribeBattles = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [tribe, setTribe] = useState<{ id: string; name: string; owner_id: string } | null>(null);
  const [collectiveStreak, setCollectiveStreak] = useState(0);
  const [battles, setBattles] = useState<TribeBattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "pending" | "history">("active");
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const isOwner = !!profile?.user_id && tribe?.owner_id === profile.user_id;
  const [isMember, setIsMember] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

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

    // Auto-resolve any expired battles first (best-effort)
    try {
      await supabase.rpc("auto_resolve_expired_tribe_battles" as any);
    } catch {
      // ignore — best-effort auto-resolve
    }

    const [tRes, bRes] = await Promise.all([
      supabase.from("tribes").select("id, name, owner_id").eq("id", id).maybeSingle(),
      supabase
        .from("tribe_battles")
        .select("*")
        .or(`challenger_tribe_id.eq.${id},opponent_tribe_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    setTribe((tRes as any).data ?? null);
    const rawBattles: TribeBattle[] = ((bRes as any).data ?? []) as any[];

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
      const tMap = new Map(((tribesData as any) ?? []).map((t: any) => [t.id, t]));
      rawBattles.forEach((b) => {
        const c = tMap.get(b.challenger_tribe_id) as any;
        const o = tMap.get(b.opponent_tribe_id) as any;
        b.challenger = c ? { ...c, collective_streak: streaksMap.get(b.challenger_tribe_id) ?? 0 } : undefined;
        b.opponent = o ? { ...o, collective_streak: streaksMap.get(b.opponent_tribe_id) ?? 0 } : undefined;
      });
      myStreak = streaksMap.get(id) ?? 0;
    }
    // No battles yet → still need our own collective streak for the hero flame
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
    const { error } = await supabase.rpc("respond_to_tribe_battle" as any, {
      p_battle_id: battleId,
      p_accept: accept,
    });
    setRespondingId(null);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success(accept ? "Battle started ⚔️" : "Challenge declined");
    load();
  };

  const active = battles.filter((b) => b.status === "active");
  const pending = battles.filter((b) => b.status === "pending");
  const history = battles.filter((b) => ["completed", "declined", "expired"].includes(b.status));

  if (loading) {
    return (
      <DetailSkeleton />
    );
  }

  if (!tribe) {
    return <div className="text-center py-12 text-sm text-muted-foreground">Tribe not found.</div>;
  }

  return (
    <div className="min-h-full pb-8 px-4 pt-4">
      <button
        onClick={() => navigate(`/tribes/${id}`)}
        className="flex items-center gap-1 text-xs text-muted-foreground mb-4"
      >
        <ArrowLeft size={14} /> {tribe.name}
      </button>

      {/* Hero — anchored by the tribe's collective war-flame.
          The bigger the combined member streak, the hotter & taller the
          flame burns. This is the largest single flame on the page. */}
      {(() => {
        const heroTier = Math.max(0, Math.min(5, collectiveStreakTier(collectiveStreak)));
        const heroAccent = collectiveAccent(collectiveStreak);
        return (
          <div
            className="relative rounded-2xl border border-[hsl(var(--ember))]/40 bg-gradient-to-br from-[hsl(var(--ember))]/[0.10] via-card/70 to-gold/[0.06] p-4 pl-32 mb-4 overflow-hidden"
            style={{
              boxShadow: `0 0 26px ${heroAccent.replace(")", " / 0.22)")}, inset 0 -32px 60px ${heroAccent.replace(")", " / 0.14)")}`,
            }}
          >
            {/* Giant ambient flame anchored bottom-left */}
            <div className="absolute -left-2 bottom-0 pointer-events-none flex items-end justify-center w-32 h-full">
              <TribeFireLite
                tier={Math.max(heroTier, 3)}
                palette={tierPalette(Math.max(heroTier, 3))}
                variant="hero"
                size={120}
              />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <Swords size={18} className="text-[hsl(var(--ember))]" />
                <p className="text-[10px] uppercase tracking-widest font-black bg-gradient-to-r from-[hsl(var(--ember))] to-gold bg-clip-text text-transparent">
                  Tribe Battles
                </p>
              </div>
              <h1 className="font-display font-black text-xl truncate">{tribe.name}</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Pit your tribe against another. Combined member XP wins. Winning tribe earns +50 XP each.
              </p>

              {(isMember || isOwner) && (
                <Button
                  onClick={() => setChallengeOpen(true)}
                  size="sm"
                  variant="ember"
                  className="mt-3 w-full"
                >
                  <Plus size={14} /> Challenge another tribe
                </Button>
              )}
            </div>
          </div>
        );
      })()}

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">Active {active.length > 0 && `(${active.length})`}</TabsTrigger>
          <TabsTrigger value="pending">Pending {pending.length > 0 && `(${pending.length})`}</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3">
          {active.length === 0 ? (
            <EmptyStateUI
              icon={Swords}
              title="No live battles"
              description="Challenge another tribe to start a head-to-head streak war."
            />
          ) : (
            active.map((b) => (
              <TribeBattleCard key={b.id} battle={b} myTribeId={id!} isOwner={isOwner} />
            ))
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-3">
          {pending.length === 0 ? (
            <EmptyStateUI
              icon={Clock}
              title="No pending challenges"
              description="Incoming and outgoing challenge invites will land here."
            />
          ) : (
            pending.map((b) => (
              <TribeBattleCard
                key={b.id}
                battle={b}
                myTribeId={id!}
                isOwner={isOwner}
                onAccept={() => respond(b.id, true)}
                onDecline={() => respond(b.id, false)}
                responding={respondingId === b.id}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {history.length === 0 ? (
            <EmptyStateUI
              icon={History}
              title="No past battles"
              description="Completed and forfeited battles will be archived here."
            />
          ) : (
            history.map((b) => (
              <TribeBattleCard key={b.id} battle={b} myTribeId={id!} isOwner={isOwner} />
            ))
          )}
        </TabsContent>
      </Tabs>

      <TribeChallengeModal
        open={challengeOpen}
        onOpenChange={setChallengeOpen}
        challengerTribeId={id!}
        onCreated={load}
      />
    </div>
  );
};

export default TribeBattles;
