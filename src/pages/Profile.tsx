
import { Flame, Zap, Award, Shield, Share2, Crown, LogOut, Users, Image, GitCompare, Camera, MessageSquare, Heart, Trophy, CreditCard, Medal, Moon, Trash2, MoreVertical, Settings as SettingsIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { isNativePlatform } from "@/lib/platform";
import StatCard from "@/components/StatCard";
import StreakDisplay from "@/components/StreakDisplay";
import BadgeVault from "@/components/BadgeVault";
import BadgeShowcase from "@/components/BadgeShowcase";
import StatusBadge from "@/components/StatusBadge";
import RankPressureCard from "@/components/RankPressureCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BadgeUnlockModal from "@/components/BadgeUnlockModal";
import StoryShareModal from "@/components/StoryShareModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, subDays } from "date-fns";
import { getBadgeProgress, checkAndAwardBadges } from "@/lib/badge-awards";
import { getTierConfig, getTierUsernameClass } from "@/lib/status-tiers";
import RoadToElite from "@/components/RoadToElite";
import TierLadder from "@/components/TierLadder";
import YourBlueprintCard from "@/components/coach/YourBlueprintCard";
import CoachLine from "@/components/coach/CoachLine";
import { useCoachObservation } from "@/hooks/use-coach-observation";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import StatusNameplate from "@/components/StatusNameplate";
import LiveRivals from "@/components/LiveRivals";
import ApexBadge from "@/components/ApexBadge";
import { useMyRank } from "@/hooks/use-my-rank";
import { format } from "date-fns";
// Pull-to-refresh removed temporarily — touch handlers on the page wrapper
// were intercepting inner taps (e.g., logout button, share, badges). Will
// re-add once the touch-area is properly isolated.

const Profile = () => {
  const { profile, signOut, isElite, isApexSubscriber } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewBadge, setPreviewBadge] = useState<any>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // Type-to-confirm guard: the final delete button stays disabled until the
  // user types their exact username. A single accidental tap can no longer
  // wipe an account — this is what let a test account get destroyed before.
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Real account-deletion action — gated behind the AlertDialog flow so
  // a single accidental tap can never wipe the user's data.
  const performAccountDeletion = async () => {
    setDeleteDialogOpen(false);
    setDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      await signOut();
      toast.success("Account deleted");
      navigate("/landing", { replace: true });
    } catch {
      toast.error("Could not delete account");
    } finally {
      setDeletingAccount(false);
    }
  };
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const syncedBadgesForUserRef = useRef<string | null>(null);
  const [shareModal, setShareModal] = useState<{ open: boolean; variant: "stats" | "streak" | "badge"; badgeData?: any }>({
    open: false,
    variant: "stats",
  });
  // Tabbed Profile (B2 polish pass): three sections — Stats (default, the
  // "is my work paying off?" view), Badges (the trophy case), Settings
  // (sign-out + delete + subscription management). The hero card above
  // stays always visible because it's the identity.
  const [profileTab, setProfileTab] = useState<"stats" | "badges" | "settings">("stats");
  // Always-visible "..." menu — user feedback: logout buttons "disappeared"
  // because they're inside the Settings tab. This menu makes them reachable
  // in one tap from any tab.
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${profile.user_id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("proof-photos").upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("proof-photos").getPublicUrl(path);
      await supabase.rpc("update_own_profile", { new_avatar_url: urlData.publicUrl });
      toast.success("Profile photo updated! 📸");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload photo");
    }
    setUploadingAvatar(false);
    e.target.value = "";
  };

  const { data: allBadges } = useQuery({
    queryKey: ["all-badges"],
    staleTime: 60 * 60_000,  // badge catalog is essentially static
    gcTime:    4  * 60 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("badges").select("*").order("rarity");
      return data || [];
    },
  });

  const { data: earnedBadgeIds } = useQuery({
    queryKey: ["earned-badges", profile?.user_id],
    staleTime: 10 * 60_000,  // changes after check-in; 10 min is safe
    gcTime:    30 * 60_000,
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", profile.user_id);
      return data?.map((b) => b.badge_id) || [];
    },
    enabled: !!profile,
  });

  const { data: battleStats } = useQuery({
    queryKey: ["battle-stats", profile?.user_id],
    staleTime: 10 * 60_000,
    gcTime:    30 * 60_000,
    queryFn: async () => {
      if (!profile) return { won: 0 };
      const { count } = await supabase
        .from("battles")
        .select("*", { count: "exact", head: true })
        .eq("winner_id", profile.user_id);
      return { won: count || 0 };
    },
    enabled: !!profile,
  });

  const { data: userPosts } = useQuery({
    queryKey: ["user-posts", profile?.user_id],
    staleTime: 2 * 60_000,   // posts can change when user creates one
    gcTime:    10 * 60_000,
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("feed_posts")
        .select("*")
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: kudosReceived } = useQuery({
    queryKey: ["kudos-received", profile?.user_id],
    staleTime: 5 * 60_000,
    gcTime:    20 * 60_000,
    queryFn: async () => {
      if (!profile) return 0;
      const { count } = await supabase
        .from("kudos")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", profile.user_id);
      return count || 0;
    },
    enabled: !!profile,
  });

  const { data: weeklySleep } = useQuery({
    queryKey: ["weekly-sleep", profile?.user_id],
    staleTime: 10 * 60_000,  // sleep data changes only at daily check-in
    gcTime:    30 * 60_000,
    queryFn: async () => {
      if (!profile) return null;
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data } = await supabase
        .from("daily_checkins")
        .select("sleep_hours")
        .eq("user_id", profile.user_id)
        .gte("checked_in_at", sevenDaysAgo);
      if (!data || data.length === 0) return null;
      const hours = data.map((d) => Number(d.sleep_hours));
      const avg = hours.reduce((s, h) => s + h, 0) / hours.length;
      const oversleepCount = hours.filter((h) => h >= 10).length;
      const isChronicOversleep = oversleepCount >= 3;

      // Match per-checkin tiers using weekly avg
      let multiplier: number;
      if (avg >= 7.5 && avg <= 9) multiplier = 1.0;
      else if (avg >= 10) multiplier = isChronicOversleep ? 0.6 : 0.95;
      else if (avg >= 7) multiplier = 0.85; // 7–7.4h avg = sub-optimal
      else if (avg >= 6) multiplier = 0.7;
      else if (avg >= 5) multiplier = 0.55;
      else multiplier = 0.4;

      return { avg: Math.round(avg * 10) / 10, days: data.length, multiplier, isChronicOversleep, oversleepCount };
    },
    enabled: !!profile,
  });

  const { data: lastCheckin } = useQuery({
    queryKey: ["last-checkin-profile", profile?.user_id],
    staleTime: 5 * 60_000,
    gcTime:    30 * 60_000,
    queryFn: async () => {
      if (!profile) return null;
      const { data } = await supabase
        .from("daily_checkins")
        .select("checked_in_at")
        .eq("user_id", profile.user_id)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!profile,
  });

  const { data: championHistory } = useQuery({
    queryKey: ["champion-history", profile?.user_id],
    staleTime: 30 * 60_000,  // champion history is very stable
    gcTime:    60 * 60_000,
    queryFn: async () => {
      if (!profile) return { wins: 0, seasons: [] };
      const db = supabase as any;
      const [{ data: champions }, { data: seasons }] = await Promise.all([
        db
          .from("leaderboard_champions")
          .select("season_id, season_points, created_at")
          .eq("user_id", profile.user_id)
          .order("created_at", { ascending: false }),
        db.from("leaderboard_seasons").select("id, name"),
      ]);
      const seasonNames = new Map<string, string>((seasons || []).map((s: any) => [s.id, s.name]));
      return {
        wins: (champions || []).length,
        seasons: (champions || []).map((c: any) => ({
          name: seasonNames.get(c.season_id) || "Season",
          points: c.season_points,
        })),
      };
    },
    enabled: !!profile,
  });

  const { data: badgeProgress } = useQuery({
    queryKey: ["badge-progress", profile?.user_id],
    staleTime: 10 * 60_000,
    gcTime:    30 * 60_000,
    queryFn: () => getBadgeProgress(profile!.user_id),
    enabled: !!profile,
  });

  const { data: rankData } = useMyRank(profile?.user_id);

  useEffect(() => {
    if (!profile?.user_id) return;
    if (syncedBadgesForUserRef.current === profile.user_id) return;

    syncedBadgesForUserRef.current = profile.user_id;
    let cancelled = false;

    (async () => {
      try {
        await checkAndAwardBadges(profile.user_id);
        if (cancelled) return;

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["earned-badges", profile.user_id] }),
          queryClient.invalidateQueries({ queryKey: ["badge-progress", profile.user_id] }),
        ]);
      } catch (error) {
        console.error("Badge sync failed", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.user_id, queryClient]);

  const earnedBadges = (allBadges || []).filter((b) => earnedBadgeIds?.includes(b.id));

  const featuredBadge = useMemo(() => {
    if (!profile?.featured_badge_id || !allBadges) return null;
    return allBadges.find((b) => b.id === profile.featured_badge_id) || null;
  }, [profile?.featured_badge_id, allBadges]);

  const handleSetFeatured = async (badgeId: string) => {
    if (!profile) return;
    const newId = profile.featured_badge_id === badgeId ? null : badgeId;
    if (newId) {
      await supabase.rpc("update_own_profile", { new_featured_badge_id: newId });
    } else {
      await supabase.rpc("update_own_profile", { clear_featured_badge: true });
    }
    toast.success(newId ? "Title badge set! 🏅" : "Title badge removed");
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  if (!profile) return null;

  const tier = profile.status_tier || 'recruit';
  const tierConfig = getTierConfig(tier);
  const isLegendTier = tier === 'legend';
  const isApexTier = tier === 'apex';
  const isHighTier = tier === 'high_performer';

  // Hero card gradient — themed by tier so the whole card screams status
  const heroBgClass = isLegendTier
    ? "border-[hsl(280_70%_60%)]/35 bg-[radial-gradient(120%_90%_at_50%_-10%,hsl(280_60%_18%/0.7),hsl(255_14%_6%)_55%,hsl(350_50%_12%/0.5)_100%)]"
    : isApexTier
    ? "border-[hsl(18_95%_58%)]/35 bg-[radial-gradient(120%_90%_at_50%_-10%,hsl(18_75%_18%/0.65),hsl(255_14%_6%)_60%)]"
    : tier === 'elite'
    ? "border-gold/25 bg-[radial-gradient(120%_90%_at_50%_-10%,hsl(42_70%_18%/0.55),hsl(255_14%_6%)_60%)]"
    : isHighTier
    ? "border-[hsl(var(--purple))]/30 bg-[radial-gradient(120%_90%_at_50%_-10%,hsl(270_50%_18%/0.55),hsl(255_14%_6%)_60%)]"
    : "border-border/40 bg-[radial-gradient(120%_90%_at_50%_-10%,hsl(255_14%_11%),hsl(255_14%_5%)_60%)]";

  const heroTopGlowStyle = isLegendTier
    ? "radial-gradient(ellipse at center, hsl(280 70% 60% / 0.4), transparent 70%)"
    : isApexTier
    ? "radial-gradient(ellipse at center, hsl(18 95% 58% / 0.4), transparent 70%)"
    : isHighTier
    ? "radial-gradient(ellipse at center, hsl(var(--purple) / 0.35), transparent 70%)"
    : "radial-gradient(ellipse at center, hsl(42 78% 54% / 0.35), transparent 70%)";

  return (
    <div className="min-h-screen pb-4 px-4 pt-6">
      {/* Always-visible quick menu — Sign Out + Delete Account are also in
          the Settings tab, but users frequently miss them. This kebab menu
          surfaces them in one tap from any tab. */}
      <div className="relative flex justify-end mb-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Account menu"
          onClick={() => setQuickMenuOpen((v) => !v)}
        >
          <MoreVertical size={18} />
        </Button>
        {quickMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setQuickMenuOpen(false)}
              aria-hidden
            />
            <div className="absolute right-0 top-10 z-40 w-52 rounded-2xl border border-border/60 bg-card shadow-[0_18px_56px_-12px_hsl(var(--background)/0.8)] overflow-hidden">
              <button
                type="button"
                onClick={() => { setQuickMenuOpen(false); setProfileTab("settings"); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-card/60 active:bg-card/40 transition"
              >
                <SettingsIcon size={14} className="text-gold" />
                <span>Open Settings</span>
              </button>
              <button
                type="button"
                onClick={() => { setQuickMenuOpen(false); signOut(); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-card/60 active:bg-card/40 transition border-t border-border/40"
              >
                <LogOut size={14} className="text-gold" />
                <span>Sign Out</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuickMenuOpen(false);
                  // Defer to next tick so the menu closes cleanly before
                  // the destructive dialog opens — feels less abrupt.
                  setTimeout(() => setDeleteDialogOpen(true), 80);
                }}
                disabled={deletingAccount}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10 active:bg-destructive/20 transition border-t border-border/40 disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>{deletingAccount ? "Deleting…" : "Delete Account"}</span>
              </button>
            </div>
          </>
        )}
      </div>

      <BadgeUnlockModal badge={previewBadge} onClose={() => setPreviewBadge(null)} />
      <StoryShareModal
        open={shareModal.open}
        onClose={() => setShareModal({ ...shareModal, open: false })}
        variant={shareModal.variant}
        badgeData={shareModal.badgeData}
      />

      

      {/* Profile Header — cinematic hero card, themed by tier */}
      <div className={cn(
        "animate-reveal relative mb-6 overflow-hidden rounded-3xl border p-6 pt-10 pb-7",
        heroBgClass,
      )}>
        {/* Top vignette glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[160%] h-64 blur-3xl opacity-70"
          style={{ background: heroTopGlowStyle }}
        />
        {/* Top accent line */}
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />

        <div className="relative flex flex-col items-center text-center">
          {/* Avatar — large, gold ring, soft glow, camera/crown badge */}
          <div className="relative mb-5">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <div className="absolute inset-0 -m-3 rounded-full bg-gold/35 blur-2xl" aria-hidden />
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                decoding="async"
                className="relative h-32 w-32 rounded-full object-cover ring-2 ring-gold ring-offset-4 ring-offset-background"
              />
            ) : (
              <div className="relative h-32 w-32 rounded-full gradient-gold flex items-center justify-center text-5xl font-black font-display text-primary-foreground ring-2 ring-gold ring-offset-4 ring-offset-background">
                {profile.username?.charAt(0)?.toUpperCase()}
              </div>
            )}
            {isElite ? (
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 h-10 w-10 rounded-full bg-background border border-gold/40 flex items-center justify-center transition-all hover:bg-gold/10 active:scale-95 shadow-lg shadow-gold/20"
              >
                {uploadingAvatar ? (
                  <span className="text-[10px] text-gold animate-pulse">...</span>
                ) : (
                  <Camera size={16} className="text-gold" />
                )}
              </button>
            ) : (
              <div className="absolute -bottom-1 -right-1 h-10 w-10 rounded-full bg-background border border-gold/40 flex items-center justify-center shadow-lg shadow-gold/20">
                <Crown size={18} className="text-gold" />
              </div>
            )}
          </div>

          {/* PREMIUM ribbon — only for Founding Apex subscribers */}
          {isApexSubscriber && (
            <div className="mt-4 mb-1 flex justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-sm text-[10px] font-black uppercase tracking-[0.22em] bg-gradient-to-r from-gold via-[hsl(42_90%_70%)] to-gold text-[hsl(260_18%_4%)] border border-gold shadow-[0_0_14px_hsl(var(--gold)/0.55)]">
                <Crown size={11} strokeWidth={3} />
                Premium · Day-One
              </span>
            </div>
          )}

          {/* Username — colored by status tier */}
          <h1 className={cn(
            "font-display text-[34px] leading-none font-black tracking-tight",
            getTierUsernameClass(profile.status_tier || 'recruit'),
          )}>
            @{profile.username}
          </h1>

          {/* MASSIVE status nameplate — the loudest element on the page */}
          <div className="mt-5 w-full">
            <StatusNameplate
              tier={tier}
              rank={rankData?.rank ?? undefined}
              totalUsers={rankData?.totalUsers}
              percentile={rankData?.percentile}
              ranked={rankData?.hasRank ?? false}
              size="lg"
            />
          </div>

          {/* Status pills — Apex/Legend supersede Elite (no duplicate badges) */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {profile.status_tier === 'apex' ? (
              <ApexBadge isFounding={isApexSubscriber} size="md" />
            ) : profile.status_tier === 'legend' ? (
              <ApexBadge tier="legend" size="md" />
            ) : isElite ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gold/45 bg-gold/5">
                <Crown size={12} className="text-gold" />
                <span className="text-[11px] font-black text-gold tracking-wider uppercase">Elite</span>
              </span>
            ) : null}
            <span className="inline-flex items-center px-3 py-1.5 rounded-full">
              <span className="text-[11px] font-black tracking-wider text-muted-foreground/80 uppercase">
                Level {profile.level}
              </span>
            </span>
            {championHistory && championHistory.wins > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gold/45 bg-gold/5">
                <Trophy size={12} className="text-gold" />
                <span className="text-[11px] font-black text-gold tracking-wider uppercase">Season Champion</span>
              </span>
            )}
          </div>

          {/* Hero XP — massive */}
          <div className="mt-6 flex flex-col items-center">
            <p className="font-display font-black text-[64px] leading-none text-gold drop-shadow-[0_0_24px_hsl(42_78%_54%/0.55)] tabular-nums">
              {(profile.xp ?? 0).toLocaleString().replace(/,/g, " ")}
            </p>
            <p className="text-[10px] font-black tracking-[0.32em] text-gold/70 mt-2">TOTAL XP</p>
          </div>

          {/* Tier message — italic, subtle */}
          <p className="text-sm text-muted-foreground/70 font-medium italic mt-5 max-w-[280px]">
            {tierConfig.message}
          </p>

          {/* Featured badge title (kept, subtle, only if set) */}
          {featuredBadge && (
            <span className="mt-4 flex items-center gap-1.5 bg-gold/10 px-2.5 py-1 rounded-full border border-gold/30">
              <span className="text-sm">{featuredBadge.icon}</span>
              <span className="font-bold text-gold text-[10px] tracking-wider uppercase">{featuredBadge.name}</span>
            </span>
          )}

          {/* Badge row — circular icons, like the reference */}
          {earnedBadges && earnedBadges.length > 0 && (
            <div className="mt-7 w-full">
              <BadgeShowcase
                badges={earnedBadges}
                totalEarned={earnedBadges.length}
                onBadgeClick={(b) => setPreviewBadge(b)}
              />
            </div>
          )}
        </div>

        {/* Bottom accent line */}
        <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      </div>

      <Tabs value={profileTab} onValueChange={(v) => setProfileTab(v as typeof profileTab)} className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-auto p-1 mb-4">
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="badges">Badges</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ─────────────────────── STATS TAB ─────────────────────── */}
        <TabsContent value="stats" className="space-y-3 mt-0">

      {/* Rank Position */}
      {rankData && (
        <div className="animate-reveal animate-reveal-delay-1">
          <RankPressureCard
            tier={tier}
            rank={rankData.rank}
            totalUsers={rankData.totalUsers}
            percentile={rankData.percentile}
            hasRank={rankData.hasRank}
            rankScore={(profile as any).rank_score}
          />
        </div>
      )}

      {/* Live Rivals — who's ahead, who's behind */}
      <div className="animate-reveal animate-reveal-delay-1">
        <LiveRivals userId={profile.user_id} myScore={Number((profile as any).rank_score) || 0} />
      </div>

      {/* Stats — battles + kudos */}
      <div className="flex flex-col gap-3 animate-reveal animate-reveal-delay-2">
        <StatCard icon={Award} label="Battles Won" value={battleStats?.won || 0} variant="rose" />
        <StatCard icon={Trophy} label="Kudos Received" value={kudosReceived || 0} variant="gold" />
      </div>

      {/* Your Blueprint — Coach's read of who you are. Renders null when
          the user hasn't completed AthleteProfileOnboarding yet. */}
      <div className="animate-reveal animate-reveal-delay-2">
        <ErrorBoundary fallback={<></>}>
          <YourBlueprintCard />
        </ErrorBoundary>
      </div>

      {/* Coach voice: one-line read of the week through Coach's eyes. */}
      <div className="animate-reveal animate-reveal-delay-2">
        <ErrorBoundary fallback={<></>}>
          <ProfileCoachLine />
        </ErrorBoundary>
      </div>

      {/* Tier Ladder — full progression map */}
      <div className="animate-reveal animate-reveal-delay-3">
        <TierLadder currentTier={profile.status_tier || "recruit"} isApexSubscriber={isApexSubscriber} />
      </div>

      {/* Road to Elite — earned-status progress (moved here from Settings) */}
      <div className="animate-reveal animate-reveal-delay-3">
        <RoadToElite />
      </div>

      {/* Weekly Sleep — recovery context / XP multiplier (moved here from Settings) */}
      {weeklySleep && (
        <div className="animate-reveal animate-reveal-delay-3">
          <div className={cn(
            "rounded-2xl border-2 p-5 glass-3d depth-realistic",
            weeklySleep.multiplier >= 1 ? "border-emerald-500/50 shadow-emerald-500/20" :
            weeklySleep.multiplier >= 0.85 ? "border-yellow-500/50 shadow-yellow-500/20" :
            "border-red-500/50 shadow-red-500/20"
          )}>
            <div className="flex items-center gap-2 mb-3">
              <Moon size={22} className={cn(
                weeklySleep.multiplier >= 1 ? "text-emerald-400" :
                weeklySleep.multiplier >= 0.85 ? "text-yellow-400" : "text-red-400"
              )} />
              <h2 className="font-display font-black text-lg tracking-tight">Weekly Sleep</h2>
              <span className="ml-auto text-base font-bold tabular-nums">
                {weeklySleep.avg}h avg ({weeklySleep.days} days)
              </span>
            </div>
            <div className="flex items-center justify-between text-base">
              <span className="text-muted-foreground font-semibold">XP Multiplier</span>
              <span className={cn(
                "font-display font-black text-2xl",
                weeklySleep.multiplier >= 1 ? "text-emerald-400" :
                weeklySleep.multiplier >= 0.85 ? "text-yellow-400" : "text-red-400"
              )}>
                {weeklySleep.multiplier >= 1 ? "100% ✓" : `${Math.round(weeklySleep.multiplier * 100)}% ⚠️`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* User Posts */}
      {userPosts && userPosts.length > 0 && (
        <div className="animate-reveal animate-reveal-delay-4">
          <h2 className="font-display font-bold text-base mb-3 tracking-tight">Posts ({userPosts.length})</h2>
          <div className="space-y-3">
            {userPosts.map((post) => (
              <div key={post.id} className="rounded-xl border border-border bg-card p-4">
                {post.content && <p className="text-base mb-2">{post.content}</p>}
                {post.image_url && (
                  <img loading="lazy" decoding="async" src={post.image_url} alt="Post" className="w-full rounded-lg object-cover max-h-48 mb-2" />
                )}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Heart size={10} /> {post.likes_count}</span>
                  <span className="flex items-center gap-1"><Trophy size={10} className="text-gold" /> {post.kudos_count}</span>
                  <span className="flex items-center gap-1"><MessageSquare size={10} /> {post.comments_count}</span>
                  <span className="ml-auto">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

        </TabsContent>

        {/* ─────────────────────── BADGES TAB ─────────────────────── */}
        <TabsContent value="badges" className="space-y-3 mt-0">
          <div className="animate-reveal animate-reveal-delay-1">
            <BadgeVault
              allBadges={allBadges || []}
              earnedBadgeIds={earnedBadgeIds || []}
              progress={badgeProgress}
              featuredBadgeId={profile.featured_badge_id}
              onBadgeClick={(b) => setPreviewBadge(b)}
              onSetFeatured={handleSetFeatured}
            />
          </div>
        </TabsContent>

        {/* ─────────────────────── SETTINGS TAB ─────────────────────── */}
        <TabsContent value="settings" className="space-y-3 mt-0">

          {/* Membership status (subscriber line — earned-tier crown lives in hero) */}
          {isElite && (
            <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-border/60 bg-card/40 p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <CreditCard size={14} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold tracking-wider uppercase text-emerald-400/90">
                  Membership active
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Member since {profile.created_at ? format(new Date(profile.created_at), "MMM yyyy") : "—"}
                </p>
              </div>
            </div>
          )}

          {/* Season Champion — past wins */}
          {championHistory && championHistory.wins > 0 && (
            <div className="animate-reveal animate-reveal-delay-1">
              <div className="rounded-2xl border-2 border-gold/50 p-5 glow-gold glass-3d depth-realistic shadow-gold/20">
                <div className="flex items-center gap-2 mb-4">
                  <Medal size={24} className="text-gold drop-shadow-[0_0_8px_hsl(42_78%_54%/0.6)]" />
                  <h2 className="font-display font-black text-xl tracking-tight">Season Champion</h2>
                  <span className="ml-auto text-gold font-display font-black text-2xl">{championHistory.wins}x</span>
                </div>
                <div className="space-y-2">
                  {championHistory.seasons.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-base">
                      <span className="text-muted-foreground font-medium">{s.name}</span>
                      <span className="font-display font-bold tabular-nums text-foreground">{(s.points ?? 0).toLocaleString()} XP</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Share + Invite + Compare buttons */}
          <div className="flex gap-2 animate-reveal animate-reveal-delay-1">
            <Button
              variant="gold-outline"
              size="sm"
              className="flex-1"
              onClick={() => setShareModal({ open: true, variant: "stats" })}
            >
              <Image size={14} />
              Share Stats
            </Button>
            <Button
              variant="gold-outline"
              size="sm"
              className="flex-1"
              onClick={() => setShareModal({ open: true, variant: "streak" })}
            >
              <Flame size={14} />
              Share Streak
            </Button>
          </div>
          <div className="flex gap-2 animate-reveal animate-reveal-delay-1">
            <Button variant="gold-outline" size="sm" className="flex-1" onClick={() => navigate("/referrals")}>
              <Users size={14} />
              Invite Friends
            </Button>
            <Button variant="gold-outline" size="sm" className="flex-1" onClick={() => navigate("/badges/compare")}>
              <GitCompare size={14} />
              Compare Badges
            </Button>
          </div>

          {/* Manage Subscription (Elite only) */}
          {isElite && (
            <div className="flex gap-2 animate-reveal animate-reveal-delay-1">
              <Button
                variant="gold-outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (isNativePlatform()) {
                    window.open("https://apps.apple.com/account/subscriptions", "_blank");
                  } else {
                    supabase.functions.invoke("customer-portal").then(({ data, error }) => {
                      if (data?.url) window.open(data.url, "_blank");
                      else toast.error("Could not open subscription management");
                    });
                  }
                }}
              >
                <CreditCard size={14} />
                Manage Subscription
              </Button>
            </div>
          )}

          {/* Account actions */}
          <div className="flex gap-2 pt-2 animate-reveal animate-reveal-delay-1">
            <Button variant="secondary" size="sm" className="flex-1" onClick={signOut}>
              <LogOut size={14} />
              Sign Out
            </Button>
            {/* Both delete entry points (this Settings button + the kebab
                menu item) converge on the single hardened, type-to-confirm
                dialog below. No direct one-tap delete path exists anymore. */}
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => { setDeleteConfirmText(""); setDeleteDialogOpen(true); }}
            >
              <Trash2 size={14} />
              Delete Account
            </Button>

            {/* Controlled delete-confirm — triggered by the kebab menu's
                "Delete Account" item. The Settings-tab button uses the
                uncontrolled AlertDialog above. Both routes converge on
                performAccountDeletion(). */}
            <AlertDialog
              open={deleteDialogOpen}
              onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteConfirmText(""); }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes your account, profile, posts,
                    check-ins, and habit data. If you have an active
                    subscription, cancel it first from subscription management
                    so billing stops correctly.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 py-1">
                  <p className="text-xs text-muted-foreground">
                    Type your username{" "}
                    <span className="font-bold text-foreground">{profile?.username}</span>{" "}
                    to confirm.
                  </p>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={profile?.username ?? "username"}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Account</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={performAccountDeletion}
                    disabled={
                      deletingAccount ||
                      !profile?.username ||
                      deleteConfirmText.trim() !== profile.username
                    }
                  >
                    {deletingAccount ? "Deleting..." : "Delete Permanently"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

        </TabsContent>
      </Tabs>
    </div>
  );
};

/** Scoped Coach line on Profile — null when hook is loading or empty. */
const ProfileCoachLine = () => {
  const { text, isLoading } = useCoachObservation({ context: "profile" });
  if (isLoading || !text) return null;
  return <CoachLine text={text} />;
};

export default Profile;
