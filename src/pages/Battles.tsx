import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { Swords } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import PageBar from "@/components/ui/page-bar";
import { DoorRow } from "@/components/coach/rows";
import { Block } from "@/components/skeletons/PageSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { downscaleImage } from "@/lib/downscale-image";
import { uniqueChannelName } from "@/lib/realtime";
import { backOr } from "@/lib/nav";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import FriendPickerSheet from "@/components/social/FriendPickerSheet";
import MyTribeBattles from "@/components/MyTribeBattles";
import BattleChallengeModal, { BATTLE_TYPES } from "@/components/battles/BattleChallengeModal";
import BattleIncomingCard from "@/components/battles/BattleIncomingCard";
import BattleActiveCard, { BattleActiveRow } from "@/components/battles/BattleActiveCard";
import BattlePendingCard from "@/components/battles/BattlePendingCard";
import BattleVoteCard from "@/components/battles/BattleVoteCard";
import BattleHistoryCard from "@/components/battles/BattleHistoryCard";
import { daysLeft, daysLeftLine } from "@/components/battles/battle-time";

/** A quiet zone of the ledger: an 11 px label over hairline rows. */
const Ledger = ({ label, children }: { label: string; children: ReactNode }) => (
  <section className="mt-6">
    <h3 className="text-[11px] font-bold text-muted-foreground">{label}</h3>
    <div className="mt-1 divide-y divide-border/35">{children}</div>
  </section>
);

/** The screen's silhouette while battles resolve: the beat, the hero, three rows. */
const BattlesSkeleton = () => (
  <div className="animate-fade-in">
    <Block height={30} className="w-4/5 !rounded-lg" />
    <Block height={236} delay={60} className="mt-5 !rounded-2xl" />
    {[0, 1, 2].map((i) => <Block key={i} height={52} delay={120 + i * 40} className="mt-3" />)}
  </div>
);

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
  // Guards Accept/Decline against double-taps — the second RPC would hit an
  // already-responded battle and flash a spurious error toast.
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeProofBattleId, setActiveProofBattleId] = useState<string | null>(null);

  // Check if current user is admin (shared cache across the app)
  const isAdmin = useIsAdmin(profile?.user_id);

  const { data: battles, isLoading, isError, refetch } = useQuery({
    queryKey: ["battles", profile?.user_id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("battles")
        .select("*")
        .or(`challenger_id.eq.${profile.user_id},opponent_id.eq.${profile.user_id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
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

  // Realtime: refresh battles, scores and votes immediately.
  // NOTE: no unfiltered `profiles` subscription — it delivered EVERY profile
  // update in the product to every client on this page (the nightly tier
  // recompute writes all N rows → N invalidations in a burst). Participant
  // stats stay fresh via the query's own refetchInterval.
  // Dep is the stable user id: `profile` gets a new object identity on every
  // realtime profile update, which tore down and re-subscribed this channel.
  const battlesRtUid = profile?.user_id;
  useEffect(() => {
    if (!battlesRtUid) return;
    const channel = supabase
      .channel(uniqueChannelName("battles-realtime"))
      .on(
        "postgres_changes",
        // No `filter:` — the user sits in either challenger_id or opponent_id
        // (realtime takes one column), and the community list needs battles
        // the user is not part of at all.
        { event: "*", schema: "public", table: "battles" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["battles"] });
          queryClient.invalidateQueries({ queryKey: ["battle-participants"] });
          queryClient.invalidateQueries({ queryKey: ["community-voting-battles"] });
        }
      )
      .on(
        "postgres_changes",
        // No `filter:` — vote counts need every vote on a visible battle, not only mine.
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
  }, [battlesRtUid, queryClient]);


  // Admin: cancel/delete battle. supabase-js returns { error } — it does NOT
  // throw — so these must check the error field or an RLS-denied write shows
  // a false success toast.
  const adminCancelBattle = async (battleId: string) => {
    const { error } = await supabase.from("battles").update({ status: "completed", ended_at: new Date().toISOString(), winner_id: null }).eq("id", battleId);
    if (error) {
      toast.error("Failed to cancel battle");
      return;
    }
    toast.success("Battle cancelled by admin");
    queryClient.invalidateQueries({ queryKey: ["battles"] });
  };

  const adminDeleteBattle = async (battleId: string) => {
    const { error } = await supabase.from("battles").delete().eq("id", battleId);
    if (error) {
      toast.error("Failed to delete battle");
      return;
    }
    toast.success("Battle deleted by admin");
    queryClient.invalidateQueries({ queryKey: ["battles"] });
  };

  const handleVote = async (battleId: string, votedFor: string) => {
    if (!profile) return;
    const { error } = await supabase.from("battle_votes").insert({
      battle_id: battleId,
      voter_id: profile.user_id,
      voted_for: votedFor,
    });
    if (error) {
      // 23505 = already voted (unique constraint); RLS blocks self-votes.
      toast.error(error.code === "23505" ? "You already voted in this battle" : "Failed to vote");
      return;
    }
    toast.success("Vote cast.");
    queryClient.invalidateQueries({ queryKey: ["my-battle-votes"] });
    queryClient.invalidateQueries({ queryKey: ["vote-counts"] });
  };

  const handleCreate = async () => {
    if (!profile || !opponent) return;
    setCreating(true);
    try {
      const { error } = await supabase.rpc("create_battle", {
        p_opponent: opponent.user_id,
        p_battle_type: battleType,
        p_duration_days: duration,
      });
      if (error) throw error;

      const typeLabel = BATTLE_TYPES.find(t => t.id === battleType)?.label || battleType;
      toast.success("Challenge sent.", { description: `${typeLabel} battle vs @${opponent.username}` });
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
    if (respondingId) return;
    setRespondingId(battleId);
    try {
      const { error } = await supabase.rpc("respond_to_battle", {
        battle_id: battleId,
        accept,
      });
      if (error) throw error;
      toast.success(accept ? "Battle on." : "Battle declined");
      queryClient.invalidateQueries({ queryKey: ["battles"] });
    } catch (err) {
      console.error(err);
      toast.error("Failed to respond to battle");
    } finally {
      setRespondingId(null);
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
      const upload = await downscaleImage(file, { maxDim: 2048, quality: 0.9 });
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

      toast.success("Proof is in.");
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
    // "Loading…" beats a literal "vs ..." card while participants resolve.
    return participants?.[oppId] || { username: "Loading…", xp: 0, streak: 0 };
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

  // XP battles score live off the participants' current XP minus the start
  // snapshot; every other type carries its score on the battle row.
  const scoresOf = (battle: any) => {
    const isXp = battle.battle_type === "xp";
    const challenger = isXp
      ? Math.max(0, (participants?.[battle.challenger_id]?.xp ?? 0) - (battle.challenger_start_xp ?? 0))
      : battle.challenger_score;
    const opponent = isXp
      ? Math.max(0, (participants?.[battle.opponent_id]?.xp ?? 0) - (battle.opponent_start_xp ?? 0))
      : battle.opponent_score;
    const mine = battle.challenger_id === profile?.user_id;
    return { myScore: mine ? challenger : opponent, oppScore: mine ? opponent : challenger };
  };

  // The hero is the live battle ending soonest; the rest are rows.
  const liveSorted = [...activeBattles].sort(
    (a: any, b: any) => daysLeft(a.started_at, a.duration_days) - daysLeft(b.started_at, b.duration_days),
  );
  const hero = liveSorted[0];
  const otherLive = liveSorted.slice(1);
  const communityVotes = communityVotingBattles ?? [];
  const ledgerCount = otherLive.length + myPending.length + myVotingBattles.length + communityVotes.length + completedBattles.length;

  if (!profile) return null;

  // Participants resolve a beat after battles; the line must never read "@Loading…".
  const nameOf = (battle: any) => (participants ? `@${getOpponent(battle).username}` : null);
  const beat = hero
    ? daysLeftLine(daysLeft(hero.started_at, hero.duration_days), nameOf(hero) ?? "your opponent")
    : pendingBattles.length === 1
      ? `${nameOf(pendingBattles[0]) ?? "Someone"} is coming for you.`
      : pendingBattles.length > 1
        ? `${pendingBattles.length} challengers want an answer.`
        : myVotingBattles.length > 0
          ? "Tied. The community decides."
          : myPending.length > 0
            ? "Your challenge is out."
            : "Nobody's coming for you yet.";

  return (
    <div className="min-h-full">
      <PageBar title="Battles" onBack={() => backOr(navigate, "/leaderboard")} />

      <div className="px-4 pt-4 pb-6">
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

        {isLoading ? (
          <BattlesSkeleton />
        ) : isError && !battles ? (
          <ErrorState title="Couldn't load your battles" onRetry={refetch} />
        ) : (
          <>
            {/* Opening beat — who's coming for you, stated once. */}
            <h2 className="home-rise font-display font-black text-[27px] leading-[1.04] tracking-tight">{beat}</h2>

            {/* The hero — the one live battle that matters most. */}
            {hero && (() => {
              const { myScore, oppScore } = scoresOf(hero);
              return (
                <div className="home-rise home-rise-1 mt-5">
                  <BattleActiveCard
                    battle={hero}
                    opp={getOpponent(hero)}
                    typeInfo={getBattleTypeInfo(hero.battle_type)}
                    profileUsername={profile.username}
                    myScore={myScore}
                    oppScore={oppScore}
                    amWinning={myScore >= oppScore}
                    daysLeft={daysLeft(hero.started_at, hero.duration_days)}
                    myProof={getMyProof(hero)}
                    oppProof={getOppProof(hero)}
                    isAdmin={!!isAdmin}
                    isUploading={uploadingProof === hero.id}
                    onRequestUpload={(id) => { setActiveProofBattleId(id); fileInputRef.current?.click(); }}
                    onAdminCancel={adminCancelBattle}
                    onAdminDelete={adminDeleteBattle}
                  />
                </div>
              );
            })()}

            {/* Incoming — needs an answer, so it sits above the door. */}
            {pendingBattles.length > 0 && (
              <section className="home-rise home-rise-2 mt-6">
                <h3 className="text-[11px] font-bold text-[hsl(var(--ember))]">Incoming</h3>
                <div className="mt-1 -mx-3 divide-y divide-border/35">
                  {pendingBattles.map((battle: any) => (
                    <BattleIncomingCard
                      key={battle.id}
                      battle={battle}
                      opp={getOpponent(battle)}
                      typeInfo={getBattleTypeInfo(battle.battle_type)}
                      onRespond={handleRespond}
                      responding={respondingId === battle.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* The door — one flow: pick a friend, then the shared challenge sheet. */}
            <div className="home-rise home-rise-3 mt-6 border-y border-border/35">
              <DoorRow
                icon={Swords}
                label="Challenge a friend"
                sub="Pick a discipline. The days decide."
                onClick={() => setPickerOpen(true)}
              />
            </div>

            {ledgerCount > 0 ? (
              <div className="home-rise home-rise-4">
                {otherLive.length > 0 && (
                  <Ledger label="Also live">
                    {otherLive.map((battle: any) => {
                      const { myScore, oppScore } = scoresOf(battle);
                      return (
                        <BattleActiveRow
                          key={battle.id}
                          battle={battle}
                          opp={getOpponent(battle)}
                          typeInfo={getBattleTypeInfo(battle.battle_type)}
                          myScore={myScore}
                          oppScore={oppScore}
                          daysLeft={daysLeft(battle.started_at, battle.duration_days)}
                          myProof={getMyProof(battle)}
                          isUploading={uploadingProof === battle.id}
                          onRequestUpload={(id) => { setActiveProofBattleId(id); fileInputRef.current?.click(); }}
                        />
                      );
                    })}
                  </Ledger>
                )}

                {myPending.length > 0 && (
                  <Ledger label="Sent">
                    {myPending.map((battle: any) => (
                      <BattlePendingCard
                        key={battle.id}
                        battle={battle}
                        opponentName={getOpponent(battle).username}
                        typeInfo={getBattleTypeInfo(battle.battle_type)}
                      />
                    ))}
                  </Ledger>
                )}

                {/* Your own tied battles — the community is deciding. Without
                    this the battle vanished from the page for its participants
                    (not active, not completed, excluded from the community list). */}
                {myVotingBattles.length > 0 && (
                  <Ledger label="Tied">
                    {myVotingBattles.map((battle: any) => {
                      const counts = voteCounts?.[battle.id] || {};
                      const oppId = battle.challenger_id === profile.user_id ? battle.opponent_id : battle.challenger_id;
                      const mine = counts[profile.user_id] ?? 0;
                      const theirs = counts[oppId] ?? 0;
                      return (
                        <div key={battle.id} className="flex items-center gap-3 py-3 min-h-11">
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold leading-tight truncate">@{getOpponent(battle).username}</p>
                            <p className="text-[12px] text-muted-foreground mt-0.5">{getBattleTypeInfo(battle.battle_type).label} · the community is voting</p>
                          </div>
                          <p className="text-[13px] font-black tabular-nums shrink-0">{mine}<span className="text-muted-foreground/60">–</span>{theirs}</p>
                        </div>
                      );
                    })}
                  </Ledger>
                )}

                {communityVotes.length > 0 && (
                  <Ledger label="Decide a tie">
                    {communityVotes.map((battle: any) => (
                      <BattleVoteCard
                        key={battle.id}
                        battle={battle}
                        typeInfo={getBattleTypeInfo(battle.battle_type)}
                        myVote={myVotes?.[battle.id]}
                        counts={voteCounts?.[battle.id] || {}}
                        onVote={handleVote}
                      />
                    ))}
                  </Ledger>
                )}

                {completedBattles.length > 0 && (
                  <Ledger label="Record">
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
                  </Ledger>
                )}
              </div>
            ) : (!battles || battles.length === 0) && (
              <div className="home-rise home-rise-4 mt-6">
                <EmptyState
                  icon={Swords}
                  title="No battles yet"
                  description="Your record starts with the first challenge."
                />
              </div>
            )}

            {/* Tribe wars — the same row grammar, one level down. */}
            <div className="home-rise home-rise-5 mt-8">
              <MyTribeBattles />
            </div>
          </>
        )}

        {showCreate && opponent && (
          <BattleChallengeModal
            username={opponent.username}
            battleType={battleType}
            setBattleType={setBattleType}
            duration={duration}
            setDuration={setDuration}
            creating={creating}
            onClose={() => { setShowCreate(false); setOpponent(null); }}
            onChallenge={handleCreate}
          />
        )}

        <FriendPickerSheet
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title="Choose your opponent"
          subtitle="Battle one of your friends."
          onPick={(f) => { setOpponent({ user_id: f.user_id, username: f.username }); setPickerOpen(false); setShowCreate(true); }}
        />
      </div>
    </div>
  );
};

export default Battles;
