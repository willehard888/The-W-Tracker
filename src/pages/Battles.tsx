import { useState } from "react";
import { Swords, Trophy, Zap, ChevronRight, UserPlus, Clock, CheckCircle, XCircle, Flame, Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Battles = () => {
  const { profile } = useAuth();
  const { isElite } = useRevenueCat();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [opponentUsername, setOpponentUsername] = useState("");
  const [duration, setDuration] = useState(7);
  const [creating, setCreating] = useState(false);

  // Fetch all battles for this user
  const { data: battles, isLoading } = useQuery({
    queryKey: ["battles", profile?.user_id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("battles")
        .select("*")
        .or(`challenger_id.eq.${profile.user_id},opponent_id.eq.${profile.user_id}`)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile,
  });

  // Fetch profiles for all battle participants
  const participantIds = battles
    ? [...new Set(battles.flatMap((b) => [b.challenger_id, b.opponent_id]))]
    : [];

  const { data: participants } = useQuery({
    queryKey: ["battle-participants", participantIds.join(",")],
    queryFn: async () => {
      if (!participantIds.length) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, xp, streak")
        .in("user_id", participantIds);
      const map: Record<string, { username: string; xp: number; streak: number }> = {};
      data?.forEach((p) => { map[p.user_id] = p; });
      return map;
    },
    enabled: participantIds.length > 0,
  });

  const pendingBattles = battles?.filter((b) => b.status === "pending" && b.opponent_id === profile?.user_id) || [];
  const activeBattles = battles?.filter((b) => b.status === "active") || [];
  const myPending = battles?.filter((b) => b.status === "pending" && b.challenger_id === profile?.user_id) || [];
  const completedBattles = battles?.filter((b) => b.status === "completed") || [];

  const handleCreate = async () => {
    if (!profile || !opponentUsername.trim()) return;
    setCreating(true);

    try {
      // Find opponent
      const { data: opponent, error: findErr } = await supabase
        .from("profiles")
        .select("user_id, username")
        .eq("username", opponentUsername.trim().toLowerCase())
        .single();

      if (findErr || !opponent) {
        toast.error("User not found", { description: "Check the username and try again." });
        setCreating(false);
        return;
      }

      if (opponent.user_id === profile.user_id) {
        toast.error("Can't challenge yourself!");
        setCreating(false);
        return;
      }

      const { error } = await supabase.from("battles").insert({
        challenger_id: profile.user_id,
        opponent_id: opponent.user_id,
        duration_days: duration,
        battle_type: "xp",
      });

      if (error) throw error;

      toast.success("Battle challenge sent!", { description: `@${opponent.username} has been challenged.` });
      setShowCreate(false);
      setOpponentUsername("");
      queryClient.invalidateQueries({ queryKey: ["battles"] });
    } catch (err) {
      console.error(err);
      toast.error("Failed to create battle");
    }
    setCreating(false);
  };

  const handleRespond = async (battleId: string, accept: boolean) => {
    try {
      if (accept) {
        await supabase
          .from("battles")
          .update({ status: "active", started_at: new Date().toISOString() })
          .eq("id", battleId);
        toast.success("Battle accepted! ⚔️");
      } else {
        await supabase
          .from("battles")
          .update({ status: "declined" })
          .eq("id", battleId);
        toast("Battle declined");
      }
      queryClient.invalidateQueries({ queryKey: ["battles"] });
    } catch (err) {
      console.error(err);
    }
  };

  const getOpponent = (battle: any) => {
    const oppId = battle.challenger_id === profile?.user_id ? battle.opponent_id : battle.challenger_id;
    return participants?.[oppId] || { username: "...", xp: 0, streak: 0 };
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <div className="animate-reveal mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Battles</h1>
        <p className="text-xs text-muted-foreground mt-1">Challenge others. Prove your discipline.</p>
      </div>

      {/* Create Battle CTA */}
      {!showCreate ? (
        <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-gold/20 bg-card p-6 text-center mb-6">
          <div className="h-16 w-16 rounded-full gradient-gold flex items-center justify-center glow-gold mx-auto mb-4">
            <Swords size={30} className="text-primary-foreground" />
          </div>
          <h2 className="font-display font-bold text-lg mb-1">1v1 Discipline Battle</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Challenge anyone. Most XP earned during the battle wins.
          </p>
          <Button variant="gold" size="lg" className="w-full max-w-xs" onClick={() => setShowCreate(true)}>
            <Swords size={18} />
            Create Battle
          </Button>
        </div>
      ) : (
        <div className="animate-reveal rounded-xl border border-gold/30 bg-card p-5 mb-6">
          <h3 className="font-display font-bold text-sm mb-4">Challenge an opponent</h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Opponent Username</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                  <Input
                    value={opponentUsername}
                    onChange={(e) => setOpponentUsername(e.target.value)}
                    placeholder="username"
                    className="pl-7 bg-secondary border-border"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-medium mb-2 block">Duration</label>
              <div className="flex gap-2">
                {[3, 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-bold transition-all active:scale-95",
                      duration === d
                        ? "bg-gold/15 text-gold border border-gold/30"
                        : "bg-secondary text-muted-foreground border border-border hover:bg-secondary/80"
                    )}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="gold" className="flex-1" onClick={handleCreate} disabled={creating || !opponentUsername.trim()}>
                <Swords size={16} />
                {creating ? "Sending..." : "Send Challenge"}
              </Button>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Challenges */}
      {pendingBattles.length > 0 && (
        <div className="animate-reveal animate-reveal-delay-1 mb-6">
          <h2 className="font-display font-bold text-sm mb-3 tracking-tight flex items-center gap-2">
            <UserPlus size={14} className="text-gold" />
            Incoming Challenges
          </h2>
          <div className="space-y-2">
            {pendingBattles.map((battle) => {
              const opp = getOpponent(battle);
              return (
                <div key={battle.id} className="rounded-xl border border-gold/20 bg-card p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full gradient-gold flex items-center justify-center text-sm font-black text-primary-foreground">
                      {opp.username?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">@{opp.username}</p>
                      <p className="text-xs text-muted-foreground">{battle.duration_days}-day {battle.battle_type} battle</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{opp.xp.toLocaleString()} XP</p>
                      <p className="text-xs text-[hsl(var(--streak-orange))]">{opp.streak}d streak</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="gold" size="sm" className="flex-1" onClick={() => handleRespond(battle.id, true)}>
                      <CheckCircle size={14} /> Accept
                    </Button>
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => handleRespond(battle.id, false)}>
                      <XCircle size={14} /> Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Battles */}
      {activeBattles.length > 0 && (
        <div className="animate-reveal animate-reveal-delay-2 mb-6">
          <h2 className="font-display font-bold text-sm mb-3 tracking-tight flex items-center gap-2">
            <Flame size={14} className="text-[hsl(var(--streak-orange))]" />
            Active Battles
          </h2>
          <div className="space-y-2">
            {activeBattles.map((battle) => {
              const opp = getOpponent(battle);
              const myXp = profile.xp;
              const oppXp = opp.xp;
              const amWinning = myXp >= oppXp;
              const startDate = battle.started_at ? new Date(battle.started_at) : new Date();
              const endDate = new Date(startDate.getTime() + battle.duration_days * 24 * 60 * 60 * 1000);
              const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

              return (
                <div key={battle.id} className="rounded-xl border border-gold/20 bg-card p-4 badge-glow-common">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Swords size={14} className="text-gold" />
                      <span className="text-xs font-bold text-gold uppercase tracking-wider">Live Battle</span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--streak-orange))]/10 border border-[hsl(var(--streak-orange))]/20">
                      <Clock size={10} className="text-[hsl(var(--streak-orange))]" />
                      <span className="text-[10px] font-bold text-[hsl(var(--streak-orange))]">{daysLeft}d left</span>
                    </div>
                  </div>

                  {/* VS Display */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-center">
                      <div className="h-12 w-12 rounded-full gradient-gold flex items-center justify-center text-lg font-black text-primary-foreground mx-auto mb-1">
                        {profile.username?.charAt(0)?.toUpperCase()}
                      </div>
                      <p className="text-xs font-bold truncate">@{profile.username}</p>
                      <p className={cn("text-lg font-black font-display tabular-nums", amWinning ? "text-gold" : "text-muted-foreground")}>
                        {myXp.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">XP</p>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xl font-black text-muted-foreground/40">VS</span>
                    </div>

                    <div className="flex-1 text-center">
                      <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-lg font-black text-muted-foreground mx-auto mb-1">
                        {opp.username?.charAt(0)?.toUpperCase()}
                      </div>
                      <p className="text-xs font-bold truncate">@{opp.username}</p>
                      <p className={cn("text-lg font-black font-display tabular-nums", !amWinning ? "text-gold" : "text-muted-foreground")}>
                        {oppXp.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">XP</p>
                    </div>
                  </div>

                  <div className={cn(
                    "mt-3 text-center text-xs font-bold py-1.5 rounded-lg",
                    amWinning ? "bg-gold/10 text-gold" : "bg-destructive/10 text-destructive"
                  )}>
                    {amWinning ? "You're winning 🔥" : "You're behind — grind harder"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending (sent by me) */}
      {myPending.length > 0 && (
        <div className="animate-reveal animate-reveal-delay-2 mb-6">
          <h2 className="font-display font-bold text-sm mb-3 tracking-tight flex items-center gap-2">
            <Clock size={14} className="text-muted-foreground" />
            Awaiting Response
          </h2>
          <div className="space-y-2">
            {myPending.map((battle) => {
              const opp = getOpponent(battle);
              return (
                <div key={battle.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-sm font-black text-muted-foreground">
                    {opp.username?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">@{opp.username}</p>
                    <p className="text-xs text-muted-foreground">{battle.duration_days}-day challenge</p>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1 rounded-full bg-secondary">
                    Pending
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Battles */}
      {completedBattles.length > 0 && (
        <div className="animate-reveal animate-reveal-delay-3">
          <h2 className="font-display font-bold text-sm mb-3 tracking-tight">Battle History</h2>
          <div className="space-y-2">
            {completedBattles.map((battle) => {
              const opp = getOpponent(battle);
              const won = battle.winner_id === profile.user_id;
              return (
                <div key={battle.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                  <div className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center",
                    won ? "bg-gold/15 text-gold" : "bg-destructive/15 text-destructive"
                  )}>
                    {won ? <Trophy size={18} /> : <Swords size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">vs @{opp.username}</p>
                    <p className="text-xs text-muted-foreground">{battle.duration_days}-day battle</p>
                  </div>
                  <div className={cn(
                    "text-sm font-bold font-display",
                    won ? "text-gold" : "text-destructive"
                  )}>
                    {won ? "Victory 🏆" : "Defeat"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!battles || battles.length === 0) && !showCreate && (
        <div className="animate-reveal animate-reveal-delay-2 rounded-xl border border-border bg-card p-8 text-center">
          <Swords size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No battles yet. Challenge someone above!</p>
        </div>
      )}
    </div>
  );
};

export default Battles;
