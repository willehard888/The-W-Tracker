
import { Flame, Award, LogOut, Users, Image, GitCompare, MessageSquare, Heart, Trophy, CreditCard, Trash2, MoreVertical, Settings as SettingsIcon, BarChart3, CalendarCheck, Gauge, ChevronRight, Brain, UserRound, FileText, Ban, Bell } from "lucide-react";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsList";
import { isNativePlatform } from "@/lib/platform";
import WeeklySleepCard from "@/components/profile/WeeklySleepCard";
import ProgressionSummaryCard from "@/components/profile/ProgressionSummaryCard";
import RecoveryCard from "@/components/profile/RecoveryCard";
import JourneyCard from "@/components/profile/JourneyCard";
import ProfileHero from "@/components/profile/ProfileHero";
import AppImage from "@/components/ui/app-image";
import { downscaleImage } from "@/lib/downscale-image";
import { withNetworkRetry, isTransientNetworkError } from "@/lib/retry";
import { hapticSelection } from "@/lib/haptics";
import BadgeVault from "@/components/BadgeVault";
import RankPressureCard from "@/components/RankPressureCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BadgeUnlockModal from "@/components/BadgeUnlockModal";
import StoryShareModal from "@/components/StoryShareModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, subDays, format } from "date-fns";
import { getBadgeProgress, checkAndAwardBadges } from "@/lib/badge-awards";
import { getTierConfig } from "@/lib/status-tiers";
import RoadToElite from "@/components/RoadToElite";
import HealthKitConnectCard from "@/components/health/HealthKitConnectCard";
import TierLadder from "@/components/TierLadder";
import YourBlueprintCard from "@/components/coach/YourBlueprintCard";
import CoachLine from "@/components/coach/CoachLine";
import { useCoachObservation } from "@/hooks/use-coach-observation";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useModeration } from "@/hooks/use-moderation";
import { useWhealthSnapshots } from "@/hooks/use-whealth-snapshots";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LiveRivals from "@/components/LiveRivals";
import { useMyRank } from "@/hooks/use-my-rank";
import { SEGMENT_TRACK, SEGMENT_ACTIVE, SEGMENT_IDLE } from "@/components/ui/segment";
// Pull-to-refresh removed temporarily — touch handlers on the page wrapper
// were intercepting inner taps (e.g., logout button, share, badges). Will
// re-add once the touch-area is properly isolated.

const Profile = () => {
  const { profile, signOut, isElite, isApexSubscriber } = useAuth();
  const isAdmin = useIsAdmin(profile?.user_id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const moderation = useModeration();
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
      // An avatar is public content everywhere in the app — gate it through
      // the same moderation the feed/tribe images use.
      const outcome = await moderation.moderateImage({ file, kind: "feed_post" });
      if (outcome.blocked) {
        throw new Error(outcome.friendlyMessage ?? "Image rejected by content policy");
      }
      // Shrink before upload — avatars render ≤128px, no need to store a multi-MB original.
      const optimized = await downscaleImage(file, { maxDim: 512, quality: 0.82, skipUnder: 60_000 });
      const ext = optimized.name.split(".").pop();
      // Avatars live in their own PUBLIC bucket (S7b) — they render on the
      // logged-out /u/ page and OG cards, unlike proofs which are private.
      // INSERT policy requires the first path segment to be the user's id.
      const path = `${profile.user_id}/avatar-${Date.now()}.${ext}`;
      // Retried on transient network drops (WKWebView "Load failed" on flaky
      // cellular) — an image POST is the most drop-prone request in the app.
      await withNetworkRetry(async () => {
        const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, optimized, { contentType: optimized.type, upsert: true });
        if (uploadErr && !`${uploadErr.message}`.includes("already exists")) throw new Error(uploadErr.message);
      });
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      await withNetworkRetry(async () => {
        const { error: rpcErr } = await supabase.rpc("update_own_profile", { new_avatar_url: urlData.publicUrl });
        if (rpcErr) throw new Error(rpcErr.message);
      });
      toast.success("Photo updated");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      console.error(err);
      toast.error(
        isTransientNetworkError(err)
          ? "Connection dropped — check your signal and try again."
          : (err?.message?.includes("policy") || err?.message?.includes("rejected"))
          ? err.message
          : "Failed to upload photo",
      );
    }
    setUploadingAvatar(false);
    e.target.value = "";
  };

  // Share MY profile — the first place in the app that builds the user's own
  // public /u/ link (vercel routes it to the OG shim for crawlers).
  const handleShareProfile = async () => {
    if (!profile?.username) return;
    const url = `https://whealthfactory.com/u/${profile.username}`;
    const text = `@${profile.username} on Whealth Factory — Lv ${profile.level ?? 1} · ${(profile.xp ?? 0).toLocaleString()} XP · ${profile.streak ?? 0}d streak`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `@${profile.username}`, text, url });
        return;
      }
    } catch {
      return; // user dismissed the sheet
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
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

  const { data: userPostsData } = useQuery({
    queryKey: ["user-posts", profile?.user_id],
    staleTime: 2 * 60_000,   // posts can change when user creates one
    gcTime:    10 * 60_000,
    queryFn: async () => {
      if (!profile) return { posts: [], total: 0 };
      // count: "exact" so the header shows the REAL total — the list itself
      // stays capped at 20 (a prolific user used to see "Posts (20)" forever).
      const { data, count } = await supabase
        .from("feed_posts")
        .select("*", { count: "exact" })
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(20);
      return { posts: data || [], total: count ?? (data?.length || 0) };
    },
    enabled: !!profile,
  });
  const userPosts = userPostsData?.posts;
  const userPostsTotal = userPostsData?.total ?? 0;

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

  // Lifetime check-in count — the "days you showed up" number.
  const { data: checkinTotal } = useQuery({
    queryKey: ["checkin-total", profile?.user_id],
    staleTime: 10 * 60_000,
    gcTime:    30 * 60_000,
    queryFn: async () => {
      if (!profile) return 0;
      const { count } = await supabase
        .from("daily_checkins")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.user_id);
      return count || 0;
    },
    enabled: !!profile,
  });

  // Whealth Index from the nightly snapshot (cheap single query — NOT the
  // 11-query live hook). Latest score + a small trend line.
  const { data: whealthSnapshots } = useWhealthSnapshots(14);

  const { data: championHistory } = useQuery({
    queryKey: ["champion-history", profile?.user_id],
    staleTime: 30 * 60_000,  // champion history is very stable
    gcTime:    60 * 60_000,
    queryFn: async () => {
      if (!profile) return { wins: 0, seasons: [] };
      const [{ data: champions }, { data: seasons }] = await Promise.all([
        supabase
          .from("leaderboard_champions")
          .select("season_id, season_points, created_at")
          .eq("user_id", profile.user_id)
          .order("created_at", { ascending: false }),
        supabase.from("leaderboard_seasons").select("id, name"),
      ]);
      const seasonNames = new Map<string, string>((seasons || []).map((s) => [s.id, s.name]));
      return {
        wins: (champions || []).length,
        seasons: (champions || []).map((c) => ({
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

  // HealthKit "Verified Performer" status — unfakeable discipline, shown as a
  // badge on the hero. Same RPC the connect card + leaderboard use.
  const { data: verifiedStats } = useQuery({
    queryKey: ["profile-verified-stats", profile?.user_id],
    enabled: !!profile?.user_id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("user_verified_performer_stats", { _user_id: profile!.user_id });
      return data as { is_verified_performer?: boolean } | null;
    },
  });

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
    toast.success(newId ? "Title badge set" : "Title badge removed");
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  if (!profile) return null;

  const tier = profile.status_tier || 'recruit';
  const tierConfig = getTierConfig(tier);
  // Hero gradient now comes from the shared getTierHeroSurface ladder
  // (inside ProfileHero) — one tier ladder for every profile hero.

  return (
    <div className="min-h-full pb-4 px-4 pt-6">
      {/* Always-visible quick menu — Sign Out + Delete Account are also in
          the Settings tab, but users frequently miss them. This kebab menu
          surfaces them in one tap from any tab. */}
      <div className="relative flex justify-end mb-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-11 w-11"
          aria-label="Account menu"
          onClick={() => setQuickMenuOpen((v) => !v)}
        >
          <MoreVertical aria-hidden size={18} />
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
                onClick={() => { hapticSelection(); setQuickMenuOpen(false); setProfileTab("settings"); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-secondary/60 active:bg-secondary/40 active:scale-[0.98] transition"
              >
                <SettingsIcon aria-hidden size={14} className="text-gold" />
                <span>Open Settings</span>
              </button>
              <button
                type="button"
                onClick={() => { hapticSelection(); setQuickMenuOpen(false); signOut(); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-secondary/60 active:bg-secondary/40 active:scale-[0.98] transition border-t border-border/40"
              >
                <LogOut aria-hidden size={14} className="text-gold" />
                <span>Sign Out</span>
              </button>
              {/* Delete Account lives ONLY in Settings behind the
                  type-to-confirm dialog — no quick path to a destructive
                  action from a kebab menu. */}
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
      <ProfileHero
        profile={profile}
        isApexSubscriber={isApexSubscriber}
        uploadingAvatar={uploadingAvatar}
        avatarInputRef={avatarInputRef}
        onAvatarUpload={handleAvatarUpload}
        tier={tier}
        rankData={rankData}
        championHistory={championHistory}
        tierMessage={tierConfig.message}
        featuredBadge={featuredBadge}
        earnedBadges={earnedBadges}
        onPreviewBadge={setPreviewBadge}
        verified={!!verifiedStats?.is_verified_performer}
        onShare={handleShareProfile}
      />

      {/* Tabs — the app-wide segmented control language */}
      <div className={cn(SEGMENT_TRACK, "mb-4")}>
        {(["stats", "badges", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { void hapticSelection(); setProfileTab(t); }}
            className={cn(
              "flex-1 text-xs font-black py-2 rounded-lg uppercase tracking-wider transition-all",
              profileTab === t ? SEGMENT_ACTIVE : SEGMENT_IDLE,
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ─────────────────────── STATS TAB ─────────────────────── */}
      {profileTab === "stats" && (
      <div className="space-y-3">

      {/* Hard numbers first — the lifetime scoreboard. Gated on the queries
          so the tiles never flash plausible-looking zeros while loading. */}
      {(checkinTotal === undefined || battleStats === undefined || kudosReceived === undefined) ? (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton-block h-[62px] rounded-2xl" />)}
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-2 animate-reveal animate-reveal-delay-1">
        {[
          { icon: CalendarCheck, label: "Check-ins", value: checkinTotal ?? 0, accent: "text-gold" },
          { icon: Flame, label: "Best streak", value: `${profile.longest_streak ?? 0}d`, accent: "text-[hsl(var(--ember))]" },
          { icon: Award, label: "Battles won", value: battleStats?.won || 0, accent: "text-[hsl(var(--rose))]" },
          { icon: Trophy, label: "Kudos received", value: kudosReceived || 0, accent: "text-gold" },
        ].map((s) => (
          <div key={s.label} className="surface-card p-3.5 flex items-center gap-3">
            <s.icon aria-hidden size={16} className={cn("shrink-0", s.accent)} />
            <div className="min-w-0">
              <p className="font-display font-black text-lg leading-none tabular-nums">{s.value}</p>
              <p className="eyebrow mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Whealth Index — the headline metric, from the nightly snapshot */}
      {whealthSnapshots && whealthSnapshots.length > 0 && (() => {
        const latest = whealthSnapshots[0];
        const series = [...whealthSnapshots].reverse();
        const points = series
          .map((s, i) => `${(i / Math.max(1, series.length - 1)) * 100},${34 - (s.overall / 100) * 30}`)
          .join(" ");
        return (
          <button
            type="button"
            onClick={() => navigate("/journey")}
            className="w-full text-left surface-card p-4 flex items-center gap-4 animate-reveal animate-reveal-delay-1 active:scale-[0.99] transition-transform"
          >
            <div className="shrink-0">
              <p className="font-display font-black text-3xl leading-none text-gold tabular-nums">{latest.overall}</p>
              <p className="eyebrow mt-1 inline-flex items-center gap-1"><Gauge aria-hidden size={11} /> Whealth Index</p>
            </div>
            <svg viewBox="0 0 100 36" className="flex-1 h-9" preserveAspectRatio="none" aria-hidden>
              <polyline
                points={points}
                fill="none"
                stroke="hsl(var(--gold))"
                strokeOpacity="0.7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <ChevronRight aria-hidden size={16} className="text-muted-foreground/75 shrink-0" />
          </button>
        );
      })()}

      {/* Rank Position */}
      {rankData && (
        <div className="animate-reveal animate-reveal-delay-1">
          <RankPressureCard
            tier={tier}
            rank={rankData.rank}
            totalUsers={rankData.totalUsers}
            percentile={rankData.percentile}
            hasRank={rankData.hasRank}
            rankScore={profile.rank_score}
          />
        </div>
      )}

      {/* Live Rivals — who's ahead, who's behind */}
      <div className="animate-reveal animate-reveal-delay-1">
        <LiveRivals userId={profile.user_id} myScore={Number(profile.rank_score) || 0} />
      </div>

      {/* Your Journey — the growth mirror: trends + reflection diary */}
      <div className="animate-reveal animate-reveal-delay-2">
        <JourneyCard />
      </div>

      {/* Strength progression — PRs + climbing lifts this week */}
      <div className="animate-reveal animate-reveal-delay-2">
        <ProgressionSummaryCard />
      </div>

      {/* Recovery — last night's sleep + heart rate, causal "why" via coach */}
      <div className="animate-reveal animate-reveal-delay-2">
        <RecoveryCard />
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
        <TierLadder currentTier={profile.status_tier || "recruit"} />
      </div>

      {/* Road to Elite — earned-status progress (moved here from Settings) */}
      <div className="animate-reveal animate-reveal-delay-3">
        <RoadToElite />
      </div>

      {/* Verified Performer — connect HealthKit to earn unfakeable status.
          Self-hides on non-iOS / when probing (component handles it). */}
      <div className="animate-reveal animate-reveal-delay-3">
        <HealthKitConnectCard />
      </div>

      {/* Weekly Sleep — recovery context / XP multiplier (moved here from Settings) */}
      {weeklySleep && (
        <div className="animate-reveal animate-reveal-delay-3">
          <WeeklySleepCard data={weeklySleep} />
        </div>
      )}

      {/* User Posts */}
      {userPosts && userPosts.length > 0 && (
        <div className="animate-reveal animate-reveal-delay-4">
          <h2 className="font-display font-bold text-base mb-3 tracking-tight">Posts ({userPostsTotal})</h2>
          <div className="space-y-3">
            {userPosts.map((post) => (
              <div key={post.id} className="surface-card p-4">
                {post.content && <p className="text-base mb-2">{post.content}</p>}
                {post.image_url && (
                  <AppImage src={post.image_url} width={600} alt={post.content || "Post image"} className="w-full rounded-lg object-cover max-h-48 mb-2" />
                )}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Heart aria-hidden size={12} /> {post.likes_count}</span>
                  <span className="flex items-center gap-1"><Trophy aria-hidden size={12} className="text-gold" /> {post.kudos_count}</span>
                  <span className="flex items-center gap-1"><MessageSquare aria-hidden size={12} /> {post.comments_count}</span>
                  <span className="ml-auto">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      </div>
      )}

      {/* ─────────────────────── BADGES TAB ─────────────────────── */}
      {profileTab === "badges" && (
        <div className="space-y-3">
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
        </div>
      )}

      {/* ─────────────────────── SETTINGS TAB ─────────────────────── */}
      {profileTab === "settings" && (
        <div className="space-y-3">

          {/* Membership status (subscriber line — earned-tier crown lives in hero) */}
          {isElite && (
            <div className="animate-reveal animate-reveal-delay-1 surface-card p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-xp-green/10 border border-xp-green/30 flex items-center justify-center shrink-0">
                <CreditCard aria-hidden size={14} className="text-xp-green" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold tracking-wider uppercase text-xp-green/90">
                  Membership active
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Member since {profile.created_at ? format(new Date(profile.created_at), "MMM yyyy") : "—"}
                </p>
              </div>
            </div>
          )}

          {/* Season Champion lives as a pill in the hero — no duplicate card here. */}

          {/* Grouped nav rows — one visual language (eyebrow + surface-card
              list + chevrons), not a wall of identical gold buttons. */}
          <SettingsGroup title="Account">
            <SettingsRow icon={UserRound} label="Athlete profile" sub="Goals, schedule, injuries — what the coach trains" onClick={() => navigate("/coach/profile")} />
            <SettingsRow icon={Brain} label="Coach memory" sub="What the coach remembers about you" onClick={() => navigate("/coach/memory")} />
            <SettingsRow icon={Bell} label="Notifications" sub="What reaches your lock screen, and when" onClick={() => navigate("/settings/notifications")} />
          </SettingsGroup>

          <SettingsGroup title="Sharing & friends">
            <SettingsRow icon={Users} label="Invite friends" sub="Both get rewarded" badge={Number(profile.referral_count) || undefined} onClick={() => navigate("/referrals")} />
            <SettingsRow icon={Image} label="Share stats" onClick={() => setShareModal({ open: true, variant: "stats" })} />
            <SettingsRow icon={Flame} label="Share streak" onClick={() => setShareModal({ open: true, variant: "streak" })} />
            <SettingsRow icon={GitCompare} label="Compare badges" onClick={() => navigate("/badges/compare")} />
            <SettingsRow icon={Ban} label="Blocked users" onClick={() => navigate("/settings/blocked")} />
          </SettingsGroup>

          {isElite && (
            <SettingsGroup title="Membership">
              <SettingsRow
                icon={CreditCard}
                label="Manage subscription"
                // Subscriptions are App Store-only (the Stripe web path was
                // removed) — one management page on every platform.
                onClick={() => window.open("https://apps.apple.com/account/subscriptions", "_blank")}
              />
            </SettingsGroup>
          )}

          {isAdmin && (
            <SettingsGroup title="Founder">
              <SettingsRow icon={BarChart3} label="Command Center" sub="Growth metrics & waitlist" onClick={() => navigate("/admin/metrics")} />
            </SettingsGroup>
          )}

          <SettingsGroup title="Legal">
            <SettingsRow icon={FileText} label="Privacy policy" onClick={() => navigate("/privacy")} />
            <SettingsRow icon={FileText} label="Terms of use" onClick={() => navigate("/terms")} />
          </SettingsGroup>

          {/* Account actions — destructive looks destructive */}
          <div className="flex gap-2 pt-2 animate-reveal animate-reveal-delay-1">
            <Button variant="secondary" size="sm" className="flex-1" onClick={signOut}>
              <LogOut aria-hidden size={14} />
              Sign Out
            </Button>
            {/* Both delete entry points (this Settings button + the kebab
                menu item) converge on the single hardened, type-to-confirm
                dialog below. No direct one-tap delete path exists anymore. */}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => { setDeleteConfirmText(""); setDeleteDialogOpen(true); }}
            >
              <Trash2 aria-hidden size={14} />
              Delete Account
            </Button>

            {/* Controlled delete-confirm — both entry points (Settings button
                + kebab item) converge here on performAccountDeletion(). */}
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
                    className="[background:hsl(var(--destructive))] text-destructive-foreground [text-shadow:none] before:hidden after:hidden shadow-[var(--shadow-2)] hover:shadow-[var(--shadow-2)] hover:brightness-110"
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

        </div>
      )}
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
