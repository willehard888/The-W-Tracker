import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { Swords } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import PageBar from "@/components/ui/page-bar";
import { Button } from "@/components/ui/button";
import { Block } from "@/components/skeletons/PageSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { downscaleImage } from "@/lib/downscale-image";
import { uniqueChannelName } from "@/lib/realtime";
import { readLocal, writeLocal } from "@/lib/storage";
import { backOr } from "@/lib/nav";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useBattleScores } from "@/hooks/use-battle-scores";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import FriendPickerSheet from "@/components/social/FriendPickerSheet";
import MyTribeBattles from "@/components/MyTribeBattles";
import BattleChallengeModal from "@/components/battles/BattleChallengeModal";
import { battleTypeInfo } from "@/components/battles/battle-types";
import BattleIncomingCard from "@/components/battles/BattleIncomingCard";
import BattleActiveCard, { BattleActiveRow } from "@/components/battles/BattleActiveCard";
import BattlePendingCard from "@/components/battles/BattlePendingCard";
import BattleHistoryCard from "@/components/battles/BattleHistoryCard";
import { battleDay, battleDayLine } from "@/components/battles/battle-time";
import { hapticImpact } from "@/lib/haptics";

/** A quiet zone of the ledger: an 11 px label over hairline rows. */
const Ledger = ({ label, children }: { label: string; children: ReactNode }) => (
  <section className="mt-6">
    <h3 className="text-label font-bold text-muted-foreground">{label}</h3>
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

const CREATE_ERRORS: Record<string, string> = {
  not_friends: "You can only battle friends. Add them first.",
  self_battle: "Can't challenge yourself!",
  battle_exists: "You already have a battle going with them.",
  unauthorized: "Please sign in.",
  health_sync_required: "Connect Apple Health and sync today to battle on steps, sleep or calories.",
  unknown_type: "That discipline is not available. Pick another.",
  unknown_duration: "Pick 3, 7, 14 or 30 days.",
};

/**
 * The arena: your record, and the one fight that is live. The hero is the
 * live battle (scored on the server from each side's own data); without one,
 * the page opens on a single primary door. Incoming challenges sit above the
 * door because they need an answer; sent ones and the record are hairline
 * rows; tribe wars stay a quiet door at the bottom.
 */
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
    staleTime: 60_000,
  });

  // A declined challenge has nowhere to go server-side — participants hold no
  // UPDATE or DELETE on `battles` — so clearing one is a local act. The ids
  // live under the member's own key, so a second account on the same device
  // never inherits them.
  const dismissKey = profile ? `w_battles_declined_seen_${profile.user_id}` : "";
  const [dismissedDeclined, setDismissedDeclined] = useState<string[]>([]);
  useEffect(() => {
    setDismissedDeclined(dismissKey ? (readLocal(dismissKey) ?? "").split(",").filter(Boolean) : []);
  }, [dismissKey]);
  const dismissDeclined = (battleId: string) => {
    const next = [...dismissedDeclined, battleId];
    setDismissedDeclined(next);
    writeLocal(dismissKey, next.join(","));
  };

  const pendingBattles = battles?.filter((b: any) => b.status === "pending" && b.opponent_id === profile?.user_id) || [];
  const activeBattles = battles?.filter((b: any) => b.status === "active") || [];
  const myPending = battles?.filter((b: any) => b.status === "pending" && b.challenger_id === profile?.user_id) || [];
  // The opponent said no. The row used to vanish from the challenger's screen
  // with the status only ever stored, so the challenge read as lost in transit.
  const declinedBattles = battles?.filter(
    (b: any) => b.status === "declined" && b.challenger_id === profile?.user_id && !dismissedDeclined.includes(b.id),
  ) || [];
  const completedBattles = battles?.filter((b: any) => b.status === "completed") || [];

  // The hero is the live battle with the fewest days left; the rest are rows.
  const liveSorted = [...activeBattles].sort(
    (a: any, b: any) => battleDay(a.start_date, a.end_date).left - battleDay(b.start_date, b.end_date).left,
  );
  const hero = liveSorted[0];
  const otherLive = liveSorted.slice(1);
  // The live scoreboard comes from the server (each side's own rows); one
  // call for the hero, refreshed every minute while the arena is open.
  const { data: heroBoard } = useBattleScores(hero?.id, !!hero);

  // Realtime: refresh battles the moment a challenge, accept or result lands.
  // NOTE: no unfiltered `profiles` subscription — it delivered EVERY profile
  // update in the product to every client on this page. `battles` had the same
  // fault: unfiltered, every battle row anyone wrote woke every client here.
  // A realtime `filter` carries one condition and the member sits in either
  // seat, so the fix is two filtered channels, not none.
  const battlesRtUid = profile?.user_id;
  useEffect(() => {
    if (!battlesRtUid) return;
    const channels = ["challenger_id", "opponent_id"].map((column) =>
      supabase
        .channel(uniqueChannelName("battles-realtime", column))
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "battles", filter: `${column}=eq.${battlesRtUid}` },
          () => {
            queryClient.invalidateQueries({ queryKey: ["battles"] });
            queryClient.invalidateQueries({ queryKey: ["battle-scores"] });
          }
        )
        .subscribe(),
    );

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
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

      toast.success("Challenge sent.", { description: `${battleTypeInfo(battleType).label}, ${duration} days, vs @${opponent.username}.` });
      setShowCreate(false);
      setOpponent(null);
      setBattleType("xp");
      queryClient.invalidateQueries({ queryKey: ["battles"] });
    } catch (err: any) {
      const key = err?.message?.match(/not_friends|self_battle|battle_exists|unauthorized|health_sync_required|unknown_type|unknown_duration/)?.[0];
      toast.error(CREATE_ERRORS[key] ?? "Failed to create battle");
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
        p_tz_offset_minutes: new Date().getTimezoneOffset(),
      });
      if (error) throw error;
      toast.success(accept ? "Battle on. It starts tomorrow." : "Challenge declined.");
      queryClient.invalidateQueries({ queryKey: ["battles"] });
    } catch (err: any) {
      const key = err?.message?.match(/health_sync_required/)?.[0];
      toast.error(key ? CREATE_ERRORS[key] : "Failed to respond to battle");
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
    // Unreachable while `participants` is still resolving — the list holds its
    // skeleton until then (see the render gate), because this placeholder used
    // to reach four cards and the ledger as a literal "@Loading…".
    // The id rides along so a card can open their profile (where Report and
    // Block live) from their proof photo.
    return { ...(participants?.[oppId] || { username: "", xp: 0, streak: 0 }), user_id: oppId as string };
  };

  const getMyProof = (battle: any) => {
    if (!profile) return null;
    return battle.challenger_id === profile.user_id ? battle.challenger_proof_url : battle.opponent_proof_url;
  };

  const getOppProof = (battle: any) => {
    if (!profile) return null;
    return battle.challenger_id === profile.user_id ? battle.opponent_proof_url : battle.challenger_proof_url;
  };

  const ledgerCount = otherLive.length + myPending.length + declinedBattles.length + completedBattles.length;

  if (!profile) return null;

  // Participants resolve a beat after battles; the line must never read "@Loading…".
  const nameOf = (battle: any) => (participants ? `@${getOpponent(battle).username}` : null);
  const heroDay = hero ? battleDay(hero.start_date, hero.end_date) : null;
  const beat = hero && heroDay
    ? battleDayLine(heroDay.day, heroDay.total, nameOf(hero) ?? "your opponent")
    : pendingBattles.length === 1
      ? `${nameOf(pendingBattles[0]) ?? "Someone"} is coming for you.`
      : pendingBattles.length > 1
        ? `${pendingBattles.length} challengers want an answer.`
        : myPending.length > 0
          ? "Your challenge is out."
          : "Nobody's coming for you yet.";

  const openPicker = () => {
    hapticImpact("light");
    setPickerOpen(true);
  };

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

        {isLoading || ((battles?.length ?? 0) > 0 && !participants) ? (
          <BattlesSkeleton />
        ) : isError && !battles ? (
          <ErrorState title="Couldn't load your battles" onRetry={refetch} />
        ) : (
          <>
            {/* Opening beat — who's coming for you, stated once. */}
            <h2 className="home-rise font-display font-black text-beat leading-[1.04] tracking-tight">{beat}</h2>
            {!hero && pendingBattles.length === 0 && (
              <p className="home-rise text-meta text-muted-foreground leading-relaxed mt-2">
                Pick a friend and a discipline. Both sides are scored from their own check-ins or Apple Health, and the winner takes 50 XP.
              </p>
            )}

            {/* The hero — the one live battle that matters most. */}
            {hero && (
              <div className="home-rise home-rise-1 mt-5">
                <BattleActiveCard
                  battle={hero}
                  opp={getOpponent(hero)}
                  typeInfo={battleTypeInfo(hero.battle_type)}
                  profileUsername={profile.username}
                  meId={profile.user_id}
                  board={heroBoard}
                  myProof={getMyProof(hero)}
                  oppProof={getOppProof(hero)}
                  isAdmin={!!isAdmin}
                  isUploading={uploadingProof === hero.id}
                  onRequestUpload={(id) => { setActiveProofBattleId(id); fileInputRef.current?.click(); }}
                  onAdminCancel={adminCancelBattle}
                  onAdminDelete={adminDeleteBattle}
                />
              </div>
            )}

            {/* Incoming — needs an answer, so it sits above the door. */}
            {pendingBattles.length > 0 && (
              <section className="home-rise home-rise-2 mt-6">
                <h3 className="text-label font-bold text-[hsl(var(--ember))]">Incoming</h3>
                <div className="mt-1 -mx-3 divide-y divide-border/35">
                  {pendingBattles.map((battle: any) => (
                    <BattleIncomingCard
                      key={battle.id}
                      battle={battle}
                      opp={getOpponent(battle)}
                      typeInfo={battleTypeInfo(battle.battle_type)}
                      onRespond={handleRespond}
                      responding={respondingId === battle.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* The door — the arena's one primary button. Pick a friend, then the shared challenge sheet. */}
            <div className={hero ? "home-rise home-rise-3 mt-6" : "home-rise home-rise-2 mt-6"}>
              <Button variant="ember" size="lg" className="w-full rounded-2xl min-h-14 text-read" onClick={openPicker}>
                <Swords aria-hidden size={18} />
                Challenge a friend
              </Button>
            </div>

            {ledgerCount > 0 && (
              <div className="home-rise home-rise-4">
                {otherLive.length > 0 && (
                  <Ledger label="Also live">
                    {otherLive.map((battle: any) => (
                      <BattleActiveRow
                        key={battle.id}
                        battle={battle}
                        opp={getOpponent(battle)}
                        typeInfo={battleTypeInfo(battle.battle_type)}
                        meId={profile.user_id}
                      />
                    ))}
                  </Ledger>
                )}

                {myPending.length > 0 && (
                  <Ledger label="Sent">
                    {myPending.map((battle: any) => (
                      <BattlePendingCard
                        key={battle.id}
                        battle={battle}
                        opponentName={getOpponent(battle).username}
                        typeInfo={battleTypeInfo(battle.battle_type)}
                      />
                    ))}
                  </Ledger>
                )}

                {declinedBattles.length > 0 && (
                  <Ledger label="Declined">
                    {declinedBattles.map((battle: any) => (
                      <BattlePendingCard
                        key={battle.id}
                        battle={battle}
                        opponentName={getOpponent(battle).username}
                        typeInfo={battleTypeInfo(battle.battle_type)}
                        onDismiss={dismissDeclined}
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
                        typeInfo={battleTypeInfo(battle.battle_type)}
                        currentUserId={profile.user_id}
                        isAdmin={!!isAdmin}
                        onAdminDelete={adminDeleteBattle}
                      />
                    ))}
                  </Ledger>
                )}
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
