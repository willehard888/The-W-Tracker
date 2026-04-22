
import { Flame, Zap, Award, Shield, Share2, Crown, LogOut, Users, Image, GitCompare, Camera, MessageSquare, Heart, Trophy, CreditCard, Medal, Moon, Trash2 } from "lucide-react";
import { isNativePlatform } from "@/lib/platform";
import StatCard from "@/components/StatCard";
import StreakDisplay from "@/components/StreakDisplay";
import BadgeVault from "@/components/BadgeVault";
import BadgeShowcase from "@/components/BadgeShowcase";
import StatusBadge from "@/components/StatusBadge";
import RankPressureCard from "@/components/RankPressureCard";
import { Button } from "@/components/ui/button";
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
import { getTierConfig } from "@/lib/status-tiers";
import RoadToElite from "@/components/RoadToElite";
import TierLadder from "@/components/TierLadder";
import LiveRivals from "@/components/LiveRivals";
import ApexBadge from "@/components/ApexBadge";
import { format } from "date-fns";

const Profile = () => {
  const { profile, signOut, isElite, isApexSubscriber } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewBadge, setPreviewBadge] = useState<any>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const syncedBadgesForUserRef = useRef<string | null>(null);
  const [shareModal, setShareModal] = useState<{ open: boolean; variant: "stats" | "streak" | "badge"; badgeData?: any }>({
    open: false,
    variant: "stats",
  });

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
    queryFn: async () => {
      const { data } = await supabase.from("badges").select("*").order("rarity");
      return data || [];
    },
  });

  const { data: earnedBadgeIds } = useQuery({
    queryKey: ["earned-badges", profile?.user_id],
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
    queryFn: () => getBadgeProgress(profile!.user_id),
    enabled: !!profile,
  });

  const { data: rankData } = useQuery({
    queryKey: ["my-rank-profile", profile?.user_id],
    queryFn: async () => {
      if (!profile) return null;
      const [{ count: ahead }, { count: total }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).gt("rank_score" as any, (profile as any).rank_score || 0),
        supabase.from("profiles").select("*", { count: "exact", head: true }).gt("xp", 0),
      ]);
      const rank = (ahead ?? 0) + 1;
      const totalUsers = total ?? 1;
      const percentile = Math.max(1, Math.round(((totalUsers - rank) / totalUsers) * 100));
      return { rank, totalUsers, percentile };
    },
    enabled: !!profile,
  });

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

  return (
    <div className="min-h-screen pb-4 px-4 pt-6 safe-top">
      <BadgeUnlockModal badge={previewBadge} onClose={() => setPreviewBadge(null)} />
      <StoryShareModal
        open={shareModal.open}
        onClose={() => setShareModal({ ...shareModal, open: false })}
        variant={shareModal.variant}
        badgeData={shareModal.badgeData}
      />

      

      {/* Profile Header — cinematic hero card */}
      <div className="animate-reveal relative mb-6 overflow-hidden rounded-3xl border border-gold/25 bg-[radial-gradient(120%_90%_at_50%_-10%,hsl(42_70%_18%/0.55),hsl(255_14%_6%)_60%)] p-6 pt-10 pb-7">
        {/* Top vignette glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[160%] h-64 blur-3xl opacity-70"
          style={{
            background:
              "radial-gradient(ellipse at center, hsl(42 78% 54% / 0.35), transparent 70%)",
          }}
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
              <span className="founding-premium-shimmer relative inline-flex items-center gap-1.5 px-3 py-[5px] rounded-sm text-[10px] font-black uppercase tracking-[0.22em] border border-gold/80 shadow-[0_2px_12px_hsl(var(--gold)/0.5)]">
                <Crown size={11} strokeWidth={3} className="relative z-20 text-[hsl(260_18%_4%)]" />
                <span className="relative z-20 text-[hsl(260_18%_4%)] drop-shadow-[0_1px_0_hsl(var(--gold-light)/0.6)]">
                  Premium · Day-One
                </span>
              </span>
            </div>
          )}

          {/* Username — bold, light weight pop */}
          <h1 className="font-display text-[34px] leading-none font-black tracking-tight text-foreground/95">
            @{profile.username}
          </h1>

          {/* Status pills — Elite · Apex/Founder · Level · Season Champion */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {isElite && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gold/45 bg-gold/5">
                <Crown size={12} className="text-gold" />
                <span className="text-[11px] font-black text-gold tracking-wider uppercase">Elite</span>
              </span>
            )}
            {profile.status_tier === 'apex' && (
              <ApexBadge isFounding={isApexSubscriber} size="md" />
            )}
            {profile.status_tier === 'legend' && (
              <ApexBadge tier="legend" size="md" />
            )}
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
              {profile.xp.toLocaleString().replace(/,/g, " ")}
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
                onBadgeClick={(b) => setPreviewBadge(b)}
              />
            </div>
          )}
        </div>

        {/* Bottom accent line */}
        <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      </div>

      {/* Rank Position */}
      {rankData && (
        <div className="animate-reveal animate-reveal-delay-1 mb-3">
          <RankPressureCard
            tier={tier}
            rank={rankData.rank}
            totalUsers={rankData.totalUsers}
            percentile={rankData.percentile}
            rankScore={(profile as any).rank_score}
          />
        </div>
      )}

      {/* Road to Elite — earned status progress (hidden once earned) */}
      <div className="mb-3 animate-reveal animate-reveal-delay-1">
        <RoadToElite />
      </div>

      {/* Live Rivals — who's ahead, who's behind */}
      <div className="mb-3 animate-reveal animate-reveal-delay-1">
        <LiveRivals userId={profile.user_id} myScore={Number((profile as any).rank_score) || 0} />
      </div>

      {/* Membership status (subscriber line — earned-tier crown lives in hero) */}
      {isElite && (
        <div className="mb-3 animate-reveal animate-reveal-delay-1 rounded-xl border border-border/60 bg-card/40 p-3 flex items-center gap-3">
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

      {/* Weekly Sleep Stats — prominent (moved under Position) */}
      {weeklySleep && (
        <div className="mb-3 animate-reveal animate-reveal-delay-1">
          <div className={cn(
            "rounded-2xl border-2 p-5 shadow-lg",
            weeklySleep.multiplier >= 1 ? "border-emerald-500/50 bg-emerald-500/10 shadow-emerald-500/20" :
            weeklySleep.multiplier >= 0.85 ? "border-yellow-500/50 bg-yellow-500/10 shadow-yellow-500/20" :
            "border-red-500/50 bg-red-500/10 shadow-red-500/20"
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
            {weeklySleep.multiplier < 1 && (
              <p className="text-xs text-muted-foreground mt-2">
                {weeklySleep.isChronicOversleep
                  ? `Chronic oversleep — ${weeklySleep.oversleepCount} nights of 10h+ this week. Aim for 7.5–9h.`
                  : weeklySleep.avg < 7.5
                  ? "Sleep 7.5–9 hours to earn full XP"
                  : "Occasional long sleep is fine — keep most nights at 7.5–9h"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Season Champion — moved under Position */}
      {championHistory && championHistory.wins > 0 && (
        <div className="mb-6 animate-reveal animate-reveal-delay-1">
          <div className="rounded-2xl border-2 border-gold/50 bg-gold/10 p-5 glow-gold shadow-lg shadow-gold/20">
            <div className="flex items-center gap-2 mb-4">
              <Medal size={24} className="text-gold drop-shadow-[0_0_8px_hsl(42_78%_54%/0.6)]" />
              <h2 className="font-display font-black text-xl tracking-tight">Season Champion</h2>
              <span className="ml-auto text-gold font-display font-black text-2xl">{championHistory.wins}x</span>
            </div>
            <div className="space-y-2">
              {championHistory.seasons.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-base">
                  <span className="text-muted-foreground font-medium">{s.name}</span>
                  <span className="font-display font-bold tabular-nums text-foreground">{s.points.toLocaleString()} XP</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mb-3 animate-reveal animate-reveal-delay-1">
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
      <div className="flex gap-2 mb-3 animate-reveal animate-reveal-delay-1">
        <Button variant="gold-outline" size="sm" className="flex-1" onClick={() => navigate("/referrals")}>
          <Users size={14} />
          Invite Friends
        </Button>
        <Button variant="gold-outline" size="sm" className="flex-1" onClick={() => navigate("/badges/compare")}>
          <GitCompare size={14} />
          Compare Badges
        </Button>
      </div>
      {isElite && (
        <div className="flex gap-2 mb-3 animate-reveal animate-reveal-delay-1">
          <Button
            variant="gold-outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              if (isNativePlatform()) {
                // iOS: open App Store subscription management
                window.open("https://apps.apple.com/account/subscriptions", "_blank");
              } else {
                // Web: open Stripe customer portal
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
      <div className="flex gap-2 mb-6 animate-reveal animate-reveal-delay-1">
        <Button variant="secondary" size="sm" className="flex-1" onClick={signOut}>
          <LogOut size={14} />
          Sign Out
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <Trash2 size={14} />
              Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes your account and profile. If you have an active subscription, cancel it first from subscription management so billing stops correctly.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Account</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
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
                }}
                disabled={deletingAccount}
              >
                {deletingAccount ? "Deleting..." : "Delete Permanently"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-3 mb-6 animate-reveal animate-reveal-delay-2">
        <StatCard icon={Award} label="Battles Won" value={battleStats?.won || 0} variant="rose" />
        <StatCard icon={Trophy} label="Kudos Received" value={kudosReceived || 0} variant="gold" />
      </div>

      {/* Tier Ladder — full progression map */}
      <div className="mb-6 animate-reveal animate-reveal-delay-3">
        <TierLadder currentTier={profile.status_tier || "recruit"} />
      </div>

      <div className="animate-reveal animate-reveal-delay-3">
        <BadgeVault
          allBadges={allBadges || []}
          earnedBadgeIds={earnedBadgeIds || []}
          progress={badgeProgress}
          featuredBadgeId={profile.featured_badge_id}
          onBadgeClick={(b) => setPreviewBadge(b)}
          onSetFeatured={handleSetFeatured}
        />
      </div>

      {/* User Posts */}
      {userPosts && userPosts.length > 0 && (
        <div className="mt-6 animate-reveal animate-reveal-delay-4">
          <h2 className="font-display font-bold text-base mb-3 tracking-tight">Posts ({userPosts.length})</h2>
          <div className="space-y-3">
            {userPosts.map((post) => (
              <div key={post.id} className="rounded-xl border border-border bg-card p-4">
                {post.content && <p className="text-base mb-2">{post.content}</p>}
                {post.image_url && (
                  <img src={post.image_url} alt="Post" className="w-full rounded-lg object-cover max-h-48 mb-2" />
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

      {/* Membership CTA — for non-members only */}
      {!profile.is_elite && (
        <div className="mt-8 rounded-xl border border-gold/20 bg-card p-5 text-center animate-reveal animate-reveal-delay-4">
          <h3 className="font-display font-bold text-base mb-1">Join the App</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Membership unlocks every feature. Elite status is earned, not bought.
          </p>
          <Button variant="gold" size="lg" className="w-full" onClick={() => navigate("/paywall")}>
            Become a Member — €4.99/mo
          </Button>
        </div>
      )}
    </div>
  );
};

export default Profile;
