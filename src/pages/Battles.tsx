
import { useState, useRef, useEffect } from "react";
import { Swords, Trophy, Zap, UserPlus, Clock, CheckCircle, XCircle, Flame, Crown, Lock, Camera, Snowflake, Dumbbell, Brain, Droplets, Image, Vote, MoreHorizontal, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MyTribeBattles from "@/components/MyTribeBattles";

const BATTLE_TYPES = [
  { id: "xp", label: "Total XP", emoji: "⚡", icon: Zap, description: "Most XP earned wins", color: "text-gold" },
  { id: "cold_shower", label: "Cold Showers", emoji: "🧊", icon: Snowflake, description: "Most cold showers taken", color: "text-blue-400" },
  { id: "workout", label: "Workouts", emoji: "💪", icon: Dumbbell, description: "Most workouts completed", color: "text-[hsl(var(--streak-orange))]" },
  { id: "meditation", label: "Meditation", emoji: "🧘", icon: Brain, description: "Most meditation sessions", color: "text-purple-400" },
  { id: "hydration", label: "Hydration", emoji: "💧", icon: Droplets, description: "Most liters of water", color: "text-cyan-400" },
  { id: "streak", label: "Streak", emoji: "🔥", icon: Flame, description: "Longest streak during battle", color: "text-[hsl(var(--streak-orange))]" },
] as const;

const Battles = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [opponentUsername, setOpponentUsername] = useState("");
  const [duration, setDuration] = useState(7);
  const [battleType, setBattleType] = useState("xp");
  const [creating, setCreating] = useState(false);
  const [uploadingProof, setUploadingProof] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeProofBattleId, setActiveProofBattleId] = useState<string | null>(null);

  // Check if current user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ["user-role-admin-battles", profile?.user_id],
    queryFn: async () => {
      if (!profile) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.user_id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!profile,
  });

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

  const participantIds = battles
    ? [...new Set(battles.flatMap((b: any) => [b.challenger_id, b.opponent_id]))]
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
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  const pendingBattles = battles?.filter((b: any) => b.status === "pending" && b.opponent_id === profile?.user_id) || [];
  const activeBattles = battles?.filter((b: any) => b.status === "active") || [];
  const myPending = battles?.filter((b: any) => b.status === "pending" && b.challenger_id === profile?.user_id) || [];
  const myVotingBattles = battles?.filter((b: any) => b.status === "voting") || [];
  const completedBattles = battles?.filter((b: any) => b.status === "completed") || [];

  // Fetch all community voting battles (including ones user is NOT part of)
  const { data: communityVotingBattles } = useQuery({
    queryKey: ["community-voting-battles", profile?.user_id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("battles")
        .select("*")
        .eq("status", "voting")
        .neq("challenger_id", profile.user_id)
        .neq("opponent_id", profile.user_id)
        .order("ended_at", { ascending: false })
        .limit(20);
      if (!data || data.length === 0) return [];
      // Fetch profiles for participants
      const ids = [...new Set(data.flatMap((b) => [b.challenger_id, b.opponent_id]))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", ids);
      const profMap = Object.fromEntries((profs || []).map((p) => [p.user_id, p]));
      return data.map((b) => ({ ...b, challengerProfile: profMap[b.challenger_id], opponentProfile: profMap[b.opponent_id] }));
    },
    enabled: !!profile,
  });

  // Fetch user's existing votes
  const { data: myVotes } = useQuery({
    queryKey: ["my-battle-votes", profile?.user_id],
    queryFn: async () => {
      if (!profile) return {};
      const { data } = await supabase
        .from("battle_votes")
        .select("battle_id, voted_for")
        .eq("voter_id", profile.user_id);
      const map: Record<string, string> = {};
      data?.forEach((v: any) => { map[v.battle_id] = v.voted_for; });
      return map;
    },
    enabled: !!profile,
  });

  // Fetch vote counts for voting battles
  const votingBattleIds = [
    ...(myVotingBattles?.map((b: any) => b.id) || []),
    ...(communityVotingBattles?.map((b: any) => b.id) || []),
  ];
  const { data: voteCounts } = useQuery({
    queryKey: ["vote-counts", votingBattleIds.join(",")],
    queryFn: async () => {
      if (!votingBattleIds.length) return {};
      const { data } = await supabase
        .from("battle_votes")
        .select("battle_id, voted_for")
        .in("battle_id", votingBattleIds);
      const counts: Record<string, Record<string, number>> = {};
      data?.forEach((v: any) => {
        if (!counts[v.battle_id]) counts[v.battle_id] = {};
        counts[v.battle_id][v.voted_for] = (counts[v.battle_id][v.voted_for] || 0) + 1;
      });
      return counts;
    },
    enabled: votingBattleIds.length > 0,
  });

  // Realtime: refresh battles, scores and votes immediately
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel("battles-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battles" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["battles"] });
          queryClient.invalidateQueries({ queryKey: ["battle-participants"] });
          queryClient.invalidateQueries({ queryKey: ["community-voting-battles"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["battle-participants"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battle_votes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["vote-counts"] });
          queryClient.invalidateQueries({ queryKey: ["my-battle-votes"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, queryClient]);


  // Admin: cancel/delete battle
  const adminCancelBattle = async (battleId: string) => {
    try {
      await supabase.from("battles").update({ status: "completed", ended_at: new Date().toISOString(), winner_id: null }).eq("id", battleId);
      toast.success("Battle cancelled by admin");
      queryClient.invalidateQueries({ queryKey: ["battles"] });
    } catch {
      toast.error("Failed to cancel battle");
    }
  };

  const adminDeleteBattle = async (battleId: string) => {
    try {
      await supabase.from("battles").delete().eq("id", battleId);
      toast.success("Battle deleted by admin");
      queryClient.invalidateQueries({ queryKey: ["battles"] });
    } catch {
      toast.error("Failed to delete battle");
    }
  };

  const handleVote = async (battleId: string, votedFor: string) => {
    if (!profile) return;
    try {
      await supabase.from("battle_votes").insert({
        battle_id: battleId,
        voter_id: profile.user_id,
        voted_for: votedFor,
      });
      toast.success("Vote cast! 🗳️");
      queryClient.invalidateQueries({ queryKey: ["my-battle-votes"] });
      queryClient.invalidateQueries({ queryKey: ["vote-counts"] });
    } catch {
      toast.error("Failed to vote");
    }
  };

  const handleCreate = async () => {
    if (!profile || !opponentUsername.trim()) return;
    setCreating(true);
    try {
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
        battle_type: battleType,
      });
      if (error) throw error;

      const typeLabel = BATTLE_TYPES.find(t => t.id === battleType)?.label || battleType;
      toast.success("Battle challenge sent!", { description: `${typeLabel} battle vs @${opponent.username}` });
      setShowCreate(false);
      setOpponentUsername("");
      setBattleType("xp");
      queryClient.invalidateQueries({ queryKey: ["battles"] });
    } catch (err) {
      console.error(err);
      toast.error("Failed to create battle");
    }
    setCreating(false);
  };

  const handleRespond = async (battleId: string, accept: boolean) => {
    try {
      const { error } = await supabase.rpc("respond_to_battle", {
        battle_id: battleId,
        accept,
      });
      if (error) throw error;
      toast.success(accept ? "Battle accepted! ⚔️" : "Battle declined");
      queryClient.invalidateQueries({ queryKey: ["battles"] });
    } catch (err) {
      console.error(err);
      toast.error("Failed to respond to battle");
    }
  };

  const handleProofUpload = async (battleId: string, file: File) => {
    if (!profile) return;

    // Validate the photo was taken just now (within last 5 minutes)
    const fileAge = Date.now() - file.lastModified;
    const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
    if (fileAge > MAX_AGE_MS) {
      toast.error("Please take a fresh photo right now. Gallery photos are not allowed.");
      return;
    }

    setUploadingProof(battleId);
    try {
      const ext = file.name.split(".").pop();
      const path = `${profile.user_id}/battle-${battleId}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("proof-photos").upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("proof-photos").getPublicUrl(path);

      const { error: rpcErr } = await supabase.rpc("submit_battle_proof", {
        battle_id: battleId,
        proof_url: urlData.publicUrl,
      });
      if (rpcErr) throw rpcErr;

      toast.success("Proof uploaded! 📸");
      queryClient.invalidateQueries({ queryKey: ["battles"] });
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload proof");
    }
    setUploadingProof(null);
    setActiveProofBattleId(null);
  };

  const getOpponent = (battle: any) => {
    const oppId = battle.challenger_id === profile?.user_id ? battle.opponent_id : battle.challenger_id;
    return participants?.[oppId] || { username: "...", xp: 0, streak: 0 };
  };

  const getBattleTypeInfo = (typeId: string) => BATTLE_TYPES.find(t => t.id === typeId) || BATTLE_TYPES[0];

  const getMyProof = (battle: any) => {
    if (!profile) return null;
    return battle.challenger_id === profile.user_id ? battle.challenger_proof_url : battle.opponent_proof_url;
  };

  const getOppProof = (battle: any) => {
    if (!profile) return null;
    return battle.challenger_id === profile.user_id ? battle.opponent_proof_url : battle.challenger_proof_url;
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen pb-4 px-4 pt-6 safe-top">
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && activeProofBattleId) {
            handleProofUpload(activeProofBattleId, file);
          }
          e.target.value = "";
        }}
      />

      <div className="animate-reveal mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Battles</h1>
        <p className="text-sm text-muted-foreground mt-1">Challenge others. Prove your discipline.</p>
      </div>

      {/* Create Battle CTA */}
      {!showCreate ? (
        <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-gold/20 bg-card p-6 text-center mb-6 card-depth-lg">
          <div className="h-16 w-16 rounded-full gradient-gold flex items-center justify-center glow-gold mx-auto mb-4">
            <Swords size={30} className="text-primary-foreground" />
          </div>
          <h2 className="font-display font-bold text-lg mb-1">1v1 Discipline Battle</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Challenge anyone to XP, cold showers, workouts & more.
          </p>
          <Button variant="ember" size="lg" className="w-full max-w-xs" onClick={() => setShowCreate(true)}>
            <Swords size={18} />
            Create Battle
          </Button>
        </div>
      ) : (
        <div className="animate-reveal rounded-xl border border-gold/30 bg-card p-5 mb-6">
          <h3 className="font-display font-bold text-sm mb-4">Challenge an opponent</h3>

          <div className="space-y-4">
            {/* Opponent */}
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Opponent Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input
                  value={opponentUsername}
                  onChange={(e) => setOpponentUsername(e.target.value)}
                  placeholder="username"
                  className="pl-7 bg-secondary border-border"
                />
              </div>
            </div>

            {/* Battle Type */}
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-2 block">Battle Type</label>
              <div className="grid grid-cols-3 gap-2">
                {BATTLE_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setBattleType(type.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-bold transition-all active:scale-95 border",
                        battleType === type.id
                          ? "bg-gold/10 border-gold/30 text-gold shadow-[0_0_12px_hsl(var(--gold)/0.15)]"
                          : "bg-secondary border-border text-muted-foreground hover:bg-secondary/80"
                      )}
                    >
                      <Icon size={18} className={battleType === type.id ? type.color : ""} />
                      <span className="leading-tight text-center">{type.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                {getBattleTypeInfo(battleType).description}
              </p>
            </div>

            {/* Duration */}
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-2 block">Duration</label>
              <div className="flex gap-2">
                {[3, 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 border",
                      duration === d
                        ? "bg-gold/15 text-gold border-gold/30"
                        : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
                    )}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="ember" className="flex-1" onClick={handleCreate} disabled={creating || !opponentUsername.trim()}>
                <Swords size={16} />
                {creating ? "Sending..." : "Send Challenge"}
              </Button>
              <Button variant="secondary" onClick={() => { setShowCreate(false); setBattleType("xp"); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Tribe Battles overview */}
      <div className="animate-reveal animate-reveal-delay-1 mb-6">
        <MyTribeBattles />
      </div>

      {/* Incoming Challenges */}
      {pendingBattles.length > 0 && (
        <div className="animate-reveal animate-reveal-delay-1 mb-6">
          <h2 className="font-display font-bold text-sm mb-3 tracking-tight flex items-center gap-2">
            <UserPlus size={14} className="text-gold" />
            Incoming Challenges
          </h2>
          <div className="space-y-2">
            {pendingBattles.map((battle: any) => {
              const opp = getOpponent(battle);
              const typeInfo = getBattleTypeInfo(battle.battle_type);
              return (
                <div key={battle.id} className="rounded-xl border border-gold/20 bg-card p-4 card-depth">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full gradient-gold flex items-center justify-center text-sm font-black text-primary-foreground">
                      {opp.username?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">@{opp.username}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>{typeInfo.emoji}</span>
                        {battle.duration_days}d {typeInfo.label} battle
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{opp.xp.toLocaleString()} XP</p>
                      <p className="text-xs text-[hsl(var(--streak-orange))]">{opp.streak}d streak</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ember" size="sm" className="flex-1" onClick={() => handleRespond(battle.id, true)}>
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
          <div className="space-y-3">
            {activeBattles.map((battle: any) => {
              const opp = getOpponent(battle);
              const typeInfo = getBattleTypeInfo(battle.battle_type);
              const TypeIcon = typeInfo.icon;
              const isXpBattle = battle.battle_type === "xp";
              const challengerScore = isXpBattle
                ? Math.max(0, (participants?.[battle.challenger_id]?.xp ?? 0) - (battle.challenger_start_xp ?? 0))
                : battle.challenger_score;
              const opponentScore = isXpBattle
                ? Math.max(0, (participants?.[battle.opponent_id]?.xp ?? 0) - (battle.opponent_start_xp ?? 0))
                : battle.opponent_score;
              const myScore = battle.challenger_id === profile.user_id ? challengerScore : opponentScore;
              const oppScore = battle.challenger_id === profile.user_id ? opponentScore : challengerScore;
              const amWinning = myScore >= oppScore;
              const startDate = battle.started_at ? new Date(battle.started_at) : new Date();
              const endDate = new Date(startDate.getTime() + battle.duration_days * 24 * 60 * 60 * 1000);
              const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
              const myProof = getMyProof(battle);
              const oppProof = getOppProof(battle);

              return (
                <div key={battle.id} className="rounded-xl border border-gold/20 bg-card overflow-hidden card-depth-lg">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 pb-2">
                    <div className="flex items-center gap-2">
                      <TypeIcon size={14} className={typeInfo.color} />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "hsl(var(--gold))" }}>
                        {typeInfo.emoji} {typeInfo.label} Battle
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--streak-orange))]/10 border border-[hsl(var(--streak-orange))]/20">
                        <Clock size={10} className="text-[hsl(var(--streak-orange))]" />
                        <span className="text-[10px] font-bold text-[hsl(var(--streak-orange))]">{daysLeft}d left</span>
                      </div>
                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground/60 hover:text-muted-foreground">
                              <MoreHorizontal size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[160px]">
                            <DropdownMenuItem onClick={() => adminCancelBattle(battle.id)} className="text-[hsl(var(--streak-orange))]">
                              <ShieldCheck size={14} className="mr-2" />
                              Cancel battle
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => adminDeleteBattle(battle.id)} className="text-destructive focus:text-destructive">
                              <Trash2 size={14} className="mr-2" />
                              Delete battle
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  {/* VS Display */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 text-center">
                      <div className="h-12 w-12 rounded-full gradient-gold flex items-center justify-center text-lg font-black text-primary-foreground mx-auto mb-1">
                        {profile.username?.charAt(0)?.toUpperCase()}
                      </div>
                      <p className="text-xs font-bold truncate text-gold">@{profile.username} <span className="text-[10px] text-gold/70 font-medium">(you)</span></p>
                      <p className={cn("text-lg font-black font-display tabular-nums", amWinning ? "text-gold" : "text-muted-foreground")}>
                        {myScore}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{typeInfo.label}</p>
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
                        {oppScore}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{typeInfo.label}</p>
                    </div>
                  </div>

                  <div className={cn(
                    "text-center text-xs font-bold py-1.5 mx-4",
                    "rounded-lg",
                    amWinning ? "bg-gold/10 text-gold" : "bg-destructive/10 text-destructive"
                  )}>
                    {amWinning ? "You're winning 🔥" : "You're behind — grind harder"}
                  </div>

                  {/* Proof Section — REQUIRED */}
                  <div className="p-4 pt-3 border-t border-border mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                      <Camera size={10} /> Proof Photos <span className="text-destructive ml-1">(required)</span>
                    </p>

                    {!myProof && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 mb-3 flex items-center gap-2">
                        <Camera size={14} className="text-destructive shrink-0" />
                        <p className="text-[11px] text-destructive font-semibold">
                          Upload your proof to validate this battle. No proof = automatic forfeit.
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {/* My proof */}
                      <div className="flex-1">
                        {myProof ? (
                          <div className="relative rounded-lg overflow-hidden aspect-square bg-secondary">
                            <img src={myProof} alt="My proof" className="w-full h-full object-cover" />
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 py-1 text-center">
                              <span className="text-[9px] font-bold text-white">You ✅</span>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setActiveProofBattleId(battle.id);
                              fileInputRef.current?.click();
                            }}
                            disabled={uploadingProof === battle.id}
                            className="w-full aspect-square rounded-lg border-2 border-dashed border-destructive/40 bg-destructive/5 flex flex-col items-center justify-center gap-1 transition-all hover:bg-destructive/10 active:scale-95 animate-pulse"
                          >
                            {uploadingProof === battle.id ? (
                              <span className="text-[10px] text-muted-foreground animate-pulse">Uploading...</span>
                            ) : (
                              <>
                                <Camera size={20} className="text-destructive" />
                                <span className="text-[9px] font-bold text-destructive">UPLOAD NOW</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Opponent proof */}
                      <div className="flex-1">
                        {oppProof ? (
                          <div className="relative rounded-lg overflow-hidden aspect-square bg-secondary">
                            <img src={oppProof} alt="Opponent proof" className="w-full h-full object-cover" />
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 py-1 text-center">
                              <span className="text-[9px] font-bold text-white">@{opp.username} ✅</span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full aspect-square rounded-lg border border-border bg-secondary/50 flex flex-col items-center justify-center gap-1">
                            <Image size={16} className="text-muted-foreground/40" />
                            <span className="text-[9px] text-muted-foreground">No proof yet</span>
                          </div>
                        )}
                      </div>
                    </div>
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
            {myPending.map((battle: any) => {
              const opp = getOpponent(battle);
              const typeInfo = getBattleTypeInfo(battle.battle_type);
              return (
                <div key={battle.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-sm font-black text-muted-foreground">
                    {opp.username?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">@{opp.username}</p>
                    <p className="text-xs text-muted-foreground">{typeInfo.emoji} {battle.duration_days}d {typeInfo.label}</p>
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

      {/* Community Voting — Tied Battles */}
      {(communityVotingBattles && communityVotingBattles.length > 0) && (
        <div className="animate-reveal animate-reveal-delay-2 mb-6">
          <h2 className="font-display font-bold text-sm mb-3 tracking-tight flex items-center gap-2">
            <Vote size={14} className="text-purple-400" />
            Community Vote — Tied Battles
          </h2>
          <p className="text-[10px] text-muted-foreground mb-3">These battles ended in a tie. Cast your vote to decide the winner!</p>
          <div className="space-y-3">
            {communityVotingBattles.map((battle: any) => {
              const typeInfo = getBattleTypeInfo(battle.battle_type);
              const myVote = myVotes?.[battle.id];
              const counts = voteCounts?.[battle.id] || {};
              const challengerVotes = counts[battle.challenger_id] || 0;
              const opponentVotes = counts[battle.opponent_id] || 0;
              const totalVotes = challengerVotes + opponentVotes;

              return (
                <div key={battle.id} className="rounded-xl border border-purple-500/20 bg-card overflow-hidden card-depth">
                  <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                      {typeInfo.emoji} {typeInfo.label} Battle — TIE
                    </span>
                    <span className="text-[10px] text-muted-foreground">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Proof photos side by side */}
                  <div className="flex gap-2 px-4 py-3">
                    <div className="flex-1 text-center">
                      <div className="relative rounded-lg overflow-hidden aspect-square bg-secondary mb-2">
                        {battle.challenger_proof_url ? (
                          <img src={battle.challenger_proof_url} alt="Challenger proof" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                            <Image size={24} />
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-bold truncate mb-1">@{battle.challengerProfile?.username || "?"}</p>
                      <button
                        onClick={() => handleVote(battle.id, battle.challenger_id)}
                        disabled={!!myVote}
                        className={cn(
                          "w-full py-2 rounded-lg text-xs font-bold transition-all active:scale-95 border",
                          myVote === battle.challenger_id
                            ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                            : myVote
                              ? "bg-secondary/50 border-border text-muted-foreground cursor-not-allowed"
                              : "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
                        )}
                      >
                        {myVote === battle.challenger_id ? `Voted ✓ (${challengerVotes})` : myVote ? `${challengerVotes}` : `Vote (${challengerVotes})`}
                      </button>
                    </div>

                    <div className="flex flex-col items-center justify-center px-1">
                      <span className="text-lg font-black text-muted-foreground/30">VS</span>
                    </div>

                    <div className="flex-1 text-center">
                      <div className="relative rounded-lg overflow-hidden aspect-square bg-secondary mb-2">
                        {battle.opponent_proof_url ? (
                          <img src={battle.opponent_proof_url} alt="Opponent proof" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                            <Image size={24} />
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-bold truncate mb-1">@{battle.opponentProfile?.username || "?"}</p>
                      <button
                        onClick={() => handleVote(battle.id, battle.opponent_id)}
                        disabled={!!myVote}
                        className={cn(
                          "w-full py-2 rounded-lg text-xs font-bold transition-all active:scale-95 border",
                          myVote === battle.opponent_id
                            ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                            : myVote
                              ? "bg-secondary/50 border-border text-muted-foreground cursor-not-allowed"
                              : "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
                        )}
                      >
                        {myVote === battle.opponent_id ? `Voted ✓ (${opponentVotes})` : myVote ? `${opponentVotes}` : `Vote (${opponentVotes})`}
                      </button>
                    </div>
                  </div>

                  {/* Vote bar */}
                  {totalVotes > 0 && (
                    <div className="px-4 pb-3">
                      <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
                        <div
                          className="h-full bg-purple-500 transition-all duration-500"
                          style={{ width: `${(challengerVotes / totalVotes) * 100}%` }}
                        />
                        <div
                          className="h-full bg-gold transition-all duration-500"
                          style={{ width: `${(opponentVotes / totalVotes) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
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
            {completedBattles.map((battle: any) => {
              const opp = getOpponent(battle);
              const won = battle.winner_id === profile.user_id;
              const typeInfo = getBattleTypeInfo(battle.battle_type);
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
                    <p className="text-xs text-muted-foreground">{typeInfo.emoji} {battle.duration_days}d {typeInfo.label}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "text-sm font-bold font-display",
                      won ? "text-gold" : "text-destructive"
                    )}>
                      {won ? "Victory 🏆" : "Defeat"}
                    </div>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded-lg hover:bg-secondary transition-colors text-muted-foreground/40 hover:text-muted-foreground">
                            <MoreHorizontal size={14} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => adminDeleteBattle(battle.id)} className="text-destructive focus:text-destructive">
                            <Trash2 size={14} className="mr-2" />
                            Delete battle
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
