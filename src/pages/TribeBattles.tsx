import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Plus, Swords } from "lucide-react";
import { toast } from "sonner";
import TribeBattleCard, { type TribeBattle } from "@/components/TribeBattleCard";
import TribeChallengeModal from "@/components/TribeChallengeModal";
import { fetchTribeCollectiveStreaks } from "@/lib/tribe-streak";

const TribeBattles = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [tribe, setTribe] = useState<{ id: string; name: string; owner_id: string } | null>(null);
  const [battles, setBattles] = useState<TribeBattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "pending" | "history">("active");
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const isOwner = !!profile?.user_id && tribe?.owner_id === profile.user_id;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    // Auto-resolve any expired battles first (best-effort)
    try {
      await supabase.rpc("auto_resolve_expired_tribe_battles" as any);
    } catch {
      // ignore — best-effort auto-resolve
    }

    const [tRes, bRes] = await Promise.all([
      supabase.from("tribes" as any).select("id, name, owner_id").eq("id", id).maybeSingle(),
      supabase
        .from("tribe_battles" as any)
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
    if (tribeIds.length > 0) {
      const [{ data: tribesData }, streaksMap] = await Promise.all([
        supabase
          .from("tribes" as any)
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
    }

    setBattles(rawBattles);
    setLoading(false);
  }, [id]);

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
      toast.error(error.message);
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
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-gold" />
      </div>
    );
  }

  if (!tribe) {
    return <div className="text-center py-12 text-sm text-muted-foreground">Tribe not found.</div>;
  }

  return (
    <div className="min-h-full pb-8 px-4 pt-4 safe-top">
      <button
        onClick={() => navigate(`/tribes/${id}`)}
        className="flex items-center gap-1 text-xs text-muted-foreground mb-4"
      >
        <ArrowLeft size={14} /> {tribe.name}
      </button>

      {/* Hero */}
      <div className="rounded-2xl border border-[hsl(18_95%_58%)]/40 bg-gradient-to-br from-[hsl(18_95%_58%)]/[0.10] via-card/70 to-gold/[0.06] p-4 mb-4 shadow-[0_0_22px_hsl(18_95%_58%/0.15)]">
        <div className="flex items-center gap-2 mb-1">
          <Swords size={18} className="text-[hsl(18_95%_58%)]" />
          <p className="text-[10px] uppercase tracking-widest font-black bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold bg-clip-text text-transparent">
            Tribe Battles
          </p>
        </div>
        <h1 className="font-display font-black text-xl truncate">{tribe.name}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Pit your tribe against another. Combined member XP wins. Winning tribe earns +50 XP each.
        </p>

        {isOwner && (
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">Active {active.length > 0 && `(${active.length})`}</TabsTrigger>
          <TabsTrigger value="pending">Pending {pending.length > 0 && `(${pending.length})`}</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3">
          {active.length === 0 ? (
            <EmptyState text="No live battles. Challenge another tribe to start one." />
          ) : (
            active.map((b) => (
              <TribeBattleCard key={b.id} battle={b} myTribeId={id!} isOwner={isOwner} />
            ))
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-3">
          {pending.length === 0 ? (
            <EmptyState text="No pending challenges." />
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
            <EmptyState text="No past battles yet." />
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

const EmptyState = ({ text }: { text: string }) => (
  <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
    {text}
  </div>
);

export default TribeBattles;
