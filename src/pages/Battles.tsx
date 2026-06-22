
import { useState, useRef, useEffect, useMemo } from "react";
import { Swords, Trophy, Zap, UserPlus, Clock, CheckCircle, XCircle, Flame, Crown, Lock, Camera, Snowflake, Dumbbell, Brain, Droplets, Image, Vote, MoreHorizontal, ShieldCheck, Trash2 } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { downscaleImage } from "@/lib/downscale-image";
import { uniqueChannelName } from "@/lib/realtime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import FriendPickerSheet from "@/components/social/FriendPickerSheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MyTribeBattles from "@/components/MyTribeBattles";
import MoreSection from "@/components/ui/more-section";
import BattleIncomingCard from "@/components/battles/BattleIncomingCard";
import BattleActiveCard from "@/components/battles/BattleActiveCard";
import BattlePendingCard from "@/components/battles/BattlePendingCard";
import BattleVoteCard from "@/components/battles/BattleVoteCard";
import BattleHistoryCard from "@/components/battles/BattleHistoryCard";

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
  const [opponent, setOpponent] = useState<{ user_id: string; username: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [duration, setDuration] = useState(7);
  const [battleType, setBattleType] = useState("xp");
  const [creating, setCreating] = useState(false);
  const [uploadingProof, setUploadingProof] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeProofBattleId, setActiveProofBattleId] = useState<string | null>(null);

  // Check if current user is admin (shared cache across the app)
  const isAdmin = useIsAdmin(profile?.user_id);

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

  // Memoized so a new array reference from `battles` doesn't retrigger the
  // participants query when the IDs themselves haven't changed.
  const participantIds = useMemo(
    () => battles
      ? [...new Set(battles.flatMap((b: any) => [b.challenger_id, b.opponent_id]))]
      : [],
    [battles],
  );

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
    refetchInterval: 15000,
    staleTime: 10_000,
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
      .channel(uniqueChannelName("battles-realtime"))
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
    if (!profile || !opponent) return;
    setCreating(true);
    try {
      const { error } = await (supabase.rpc as any)("create_battle", {
        p_opponent: opponent.user_id,
        p_battle_type: battleType,
        p_duration_days: duration,
      });
      if (error) throw error;

      const typeLabel = BATTLE_TYPES.find(t => t.id === battleType)?.label || battleType;
      toast.success("Battle challenge sent!", { description: `${typeLabel} battle vs @${opponent.username}` });
      setShowCreate(false);
      setOpponent(null);
      setBattleType("xp");
      queryClient.invalidateQueries({ queryKey: ["battles"] });
    } catch (err: any) {
      const key = err?.message?.match(/not_friends|self_battle|battle_exists|unauthorized/)?.[0];
      const msg = ({
        not_friends: "You can only battle friends. Add them first.",
        self_battle: "Can't challenge yourself!",
        battle_exists: "You already have a battle going with them.",
        unauthorized: "Please sign in.",
      } as Record<string, string>)[key] ?? "Failed to create battle";
      toast.error(msg);
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
      const upload = await downscaleImage(file, { maxDim: 1280, quality: 0.8 });
      const ext = upload.name.split(".").pop();
      const path = `${profile.user_id}/battle-${battleId}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("proof-photos").upload(path, upload, { contentType: upload.type });
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
    <div className="min-h-screen pb-4 px-4 pt-6">
      
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
        <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-gold/20 p-6 text-center mb-6 glass-3d depth-realistic">
          <div className="h-16 w-16 rounded-full gradient-gold flex items-center justify-center glow-gold mx-auto mb-4">
            <Swords size={30} className="text-primary-foreground" />
          </div>
          <h2 className="font-display font-bold text-lg mb-1">1v1 Discipline Battle</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Challenge a friend to XP, cold showers, workouts & more.
          </p>
          <Button variant="ember" size="lg" className="w-full max-w-xs" onClick={() => setShowCreate(true)}>
            <Swords size={18} />
            Create Battle
          </Button>
        </div>
      ) : (
        <div className="animate-reveal rounded-xl border border-gold/30 p-5 mb-6 glass-3d depth-realistic">
          <h3 className="font-display font-bold text-sm mb-4">Challenge a friend</h3>

          <div className="space-y-4">
            {/* Opponent — picked from friends */}
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Opponent</label>
              {opponent ? (
                <button
                  onClick={() => setPickerOpen(true)}
                  className="w-full flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 p-2.5 text-left active:scale-[0.99] transition-transform"
                >
                  <div className="h-9 w-9 rounded-full gradient-gold flex items-center justify-center text-sm font-black text-primary-foreground shrink-0">
                    {opponent.username?.charAt(0)?.toUpperCase()}
                  </div>
                  <span className="flex-1 min-w-0 font-bold text-sm truncate">@{opponent.username}</span>
                  <span className="text-[11px] font-bold text-gold shrink-0">Change</span>
                </button>
              ) : (
                <button
                  onClick={() => setPickerOpen(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-gold/40 bg-card/40 py-3 text-[13px] font-bold text-gold active:scale-[0.99] transition-transform"
                >
                  <UserPlus size={15} /> Choose a friend
                </button>
              )}
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
              <Button variant="ember" className="flex-1" onClick={handleCreate} disabled={creating || !opponent}>
                <Swords size={16} />
                {creating ? "Sending..." : "Send Challenge"}
              </Button>
              <Button variant="secondary" onClick={() => { setShowCreate(false); setBattleType("xp"); setOpponent(null); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Tribe battles are a different scope — tucked into "More" so the page
          stays focused on the user's own challenges. */}
      <MoreSection label="Tribe battles" className="mb-4">
        <MyTribeBattles />
      </MoreSection>

      {/* Incoming Challenges */}
      {pendingBattles.length > 0 && (
        <div className="animate-reveal animate-reveal-delay-1 mb-6">
          <h2 className="font-display font-bold text-sm mb-3 tracking-tight flex items-center gap-2">
            <UserPlus size={14} className="text-gold" />
            Incoming Challenges
          </h2>
          <div className="space-y-2">
            {pendingBattles.map((battle: any) => (
              <BattleIncomingCard
                key={battle.id}
                battle={battle}
                opp={getOpponent(battle)}
                typeInfo={getBattleTypeInfo(battle.battle_type)}
                onRespond={handleRespond}
              />
            ))}
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
              return (
                <BattleActiveCard
                  key={battle.id}
                  battle={battle}
                  opp={opp}
                  typeInfo={typeInfo}
                  profileUsername={profile.username}
                  myScore={myScore}
                  oppScore={oppScore}
                  amWinning={amWinning}
                  daysLeft={daysLeft}
                  myProof={getMyProof(battle)}
                  oppProof={getOppProof(battle)}
                  isAdmin={!!isAdmin}
                  isUploading={uploadingProof === battle.id}
                  onRequestUpload={(id) => { setActiveProofBattleId(id); fileInputRef.current?.click(); }}
                  onAdminCancel={adminCancelBattle}
                  onAdminDelete={adminDeleteBattle}
                />
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
            {myPending.map((battle: any) => (
              <BattlePendingCard
                key={battle.id}
                battle={battle}
                opponentName={getOpponent(battle).username}
                typeInfo={getBattleTypeInfo(battle.battle_type)}
              />
            ))}
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
            {communityVotingBattles.map((battle: any) => (
              <BattleVoteCard
                key={battle.id}
                battle={battle}
                typeInfo={getBattleTypeInfo(battle.battle_type)}
                myVote={myVotes?.[battle.id]}
                counts={voteCounts?.[battle.id] || {}}
                onVote={handleVote}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Battles */}
      {completedBattles.length > 0 && (
        <div className="animate-reveal animate-reveal-delay-3">
          <h2 className="font-display font-bold text-sm mb-3 tracking-tight">Battle History</h2>
          <div className="space-y-2">
            {completedBattles.map((battle: any) => (
              <BattleHistoryCard
                key={battle.id}
                battle={battle}
                opponentName={getOpponent(battle).username}
                typeInfo={getBattleTypeInfo(battle.battle_type)}
                currentUserId={profile.user_id}
                isAdmin={!!isAdmin}
                onAdminDelete={adminDeleteBattle}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!battles || battles.length === 0) && !showCreate && (
        <div className="animate-reveal animate-reveal-delay-2">
          <EmptyState
            icon={Swords}
            title="No battles yet"
            description="Challenge a friend — winner takes the score, loser owes a workout."
          />
        </div>
      )}

      <FriendPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Choose your opponent"
        subtitle="Battle one of your friends."
        onPick={(f) => { setOpponent({ user_id: f.user_id, username: f.username }); setPickerOpen(false); }}
      />
    </div>
  );
};

export default Battles;
