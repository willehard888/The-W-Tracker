import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import StatusAvatar from "@/components/StatusAvatar";
import ApexBadge from "@/components/ApexBadge";
import StatusNameplate from "@/components/StatusNameplate";
import StreakFlameInline from "@/components/StreakFlameInline";
import ImageLightbox from "@/components/ImageLightbox";
import { getTierConfig, getTierUsernameClass, formatTier, type StatusTier } from "@/lib/status-tiers";
import { Crown, Trophy, ChevronLeft, ExternalLink, Lock, Heart, MessageCircle, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import GridMedia from "@/components/feed/GridMedia";

const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxPost, setLightboxPost] = useState<any>(null);

  // One SECURITY DEFINER RPC serves the whole public identity — profiles
  // SELECT is authenticated-only (anti-scraping, 20260414092928), so a plain
  // table read here returned nothing for logged-out share-link visitors and
  // the page claimed the user didn't exist.
  interface PublicProfileBundle {
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    status_tier: string | null;
    tier_division: number | null;
    level: number | null;
    xp: number | null;
    streak: number | null;
    longest_streak: number | null;
    is_elite: boolean | null;
    is_apex_subscriber: boolean | null;
    legend_pinned: boolean | null;
    champion_wins: number;
    badges: { badge_id: string; earned_at: string; badges: { name: string; icon: string; rarity: string } }[];
  }
  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      if (!username) return null;
      const { data } = await supabase.rpc("get_public_profile", {
        p_username: username,
      });
      return (data ?? null) as unknown as PublicProfileBundle | null;
    },
    enabled: !!username,
  });

  const championHistory = profile ? { wins: profile.champion_wins ?? 0 } : undefined;
  const badges = profile?.badges ?? [];

  // Elite Feed posts with media — the loudest social proof on a public profile.
  const { data: mediaPosts } = useQuery({
    queryKey: ["public-media-posts", profile?.user_id],
    enabled: !!profile?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("feed_posts")
        .select("id, content, image_url, video_url, likes_count, comments_count, kudos_count, created_at")
        .eq("user_id", profile!.user_id)
        .or("image_url.not.is.null,video_url.not.is.null")
        .order("created_at", { ascending: false })
        .limit(12);
      return data || [];
    },
  });

  // SEO
  useEffect(() => {
    if (profile) {
      const tier = getTierConfig(profile.status_tier || 'recruit');
      document.title = `@${profile.username} · ${tier.label} · Whealth Factory`;
      const desc = document.querySelector('meta[name="description"]');
      const text = `${tier.emoji} ${tier.label} · Level ${profile.level ?? 1} · ${profile.streak ?? 0}d streak · ${(profile.xp ?? 0).toLocaleString()} XP`;
      if (desc) desc.setAttribute('content', text);
      else {
        const m = document.createElement('meta');
        m.name = 'description';
        m.content = text;
        document.head.appendChild(m);
      }
    }
    return () => { document.title = "Whealth Factory"; };
  }, [profile]);

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-6 text-center">
        <Lock size={32} className="text-muted-foreground/40 mb-3" />
        <h1 className="font-display text-xl font-black mb-2">User not found</h1>
        <p className="text-sm text-muted-foreground mb-6">@{username} doesn't exist on Whealth Factory</p>
        <Button variant="ember" onClick={() => navigate("/")}>Open Whealth Factory</Button>
      </div>
    );
  }

  const tier = getTierConfig(profile.status_tier || 'recruit');
  const isApexSubscriber = Boolean(profile.is_apex_subscriber);

  return (
    <div className="min-h-full relative pb-10">
      {/* Back button */}
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
        className="absolute top-4 left-4 z-20 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={14} /> Back
      </button>

      <div className="px-4 pt-12">
        {/* IG-style compact header: avatar + stats row */}
        <div className="flex items-center gap-5 mb-4">
          {/* Avatar */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative shrink-0"
          >
            <div className="absolute inset-0 -m-2 rounded-full bg-gold/25 blur-xl" aria-hidden />
            <div className="relative">
              <StatusAvatar
                src={profile.avatar_url}
                name={profile.username}
                tier={profile.status_tier || 'recruit'}
                size="lg"
              />
            </div>
          </motion.div>

          {/* Stats row — IG-style: count on top, label below */}
          <div className="flex-1 grid grid-cols-3 gap-1 text-center">
            {[
              { label: "XP", value: (profile.xp ?? 0) >= 1000 ? `${((profile.xp ?? 0) / 1000).toFixed(1)}k` : (profile.xp ?? 0).toString(), color: "text-gold" },
              { label: "Streak", value: `${profile.streak ?? 0}d`, color: "text-[hsl(var(--ember))]" },
              { label: "Level", value: (profile.level ?? 1).toString(), color: "text-foreground" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <p className={cn("font-display font-black text-xl leading-none tabular-nums", s.color)}>
                  {s.value}
                </p>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mt-1">
                  {s.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Username + display name + tier */}
        <div className="mb-3">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="flex items-center justify-center gap-2 flex-wrap"
          >
            <h1
              className={cn(
                "font-display text-xl leading-tight font-black tracking-tight",
                getTierUsernameClass(profile.status_tier || 'recruit'),
              )}
            >
              @{profile.username}
            </h1>
            {(profile.streak ?? 0) > 0 && (
              <StreakFlameInline
                streak={profile.streak ?? 0}
                suffix="d"
                className="align-middle"
                countClassName="font-black text-foreground/90"
              />
            )}
          </motion.div>
          {profile.display_name && (
            <p className="text-sm text-foreground/85 font-semibold mt-0.5">{profile.display_name}</p>
          )}
          <p className="text-[12px] text-muted-foreground/80 italic mt-1.5 leading-snug">
            {tier.message}
          </p>
        </div>

        {/* Status pills row */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="flex flex-wrap items-center gap-1.5 mb-4"
        >
          <StatusNameplate
            tier={profile.status_tier || 'recruit'}
            size="md"
          />
          {isApexSubscriber && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-[0.22em] bg-gradient-to-r from-gold via-[hsl(42_90%_70%)] to-gold text-[hsl(260_18%_4%)] border border-gold">
              <Crown size={11} strokeWidth={3} />
              Day-One
            </span>
          )}
          {profile.status_tier === 'apex' ? (
            <ApexBadge isFounding={isApexSubscriber} size="sm" />
          ) : profile.status_tier === 'legend' ? (
            <ApexBadge tier="legend" size="sm" />
          ) : profile.status_tier === 'elite' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gold/45 bg-gold/5">
              <Crown size={12} className="text-gold" />
              <span className="text-[11px] font-black text-gold tracking-wider uppercase">{formatTier('elite', profile.tier_division ?? 0)}</span>
            </span>
          ) : null}
          {championHistory && championHistory.wins > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gold/45 bg-gold/5">
              <Trophy size={12} className="text-gold" />
              <span className="text-[11px] font-black text-gold tracking-wider uppercase">
                {championHistory.wins > 1 ? `${championHistory.wins}× ` : ""}Season Champion
              </span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-card">
            <Trophy size={12} className="text-muted-foreground" />
            <span className="text-[11px] font-black text-muted-foreground tracking-wider uppercase">
              Best {profile.longest_streak}d
            </span>
          </span>
        </motion.div>

        {/* CTA — moved up so it's visible above the fold */}
        <Link to="/landing" className="block mb-5">
          <Button variant="ember" size="default" className="w-full">
            <ExternalLink size={14} />
            Track your status
          </Button>
        </Link>

        {/* Elite Feed media — IG-style 3-col grid, edge-to-edge */}
        {mediaPosts && mediaPosts.length > 0 && (
          <div className="mb-6 -mx-4">
            {/* Tab bar — IG style */}
            <div className="flex items-center justify-center border-t border-border">
              <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border-t-2 border-foreground -mt-px">
                <Camera size={12} className="text-foreground" />
                <span className="text-[11px] font-black tracking-[0.22em] uppercase text-foreground">
                  Posts · {mediaPosts.length}
                </span>
              </div>
            </div>

            {/* Tight 3-col grid, 2px gutters — pure Instagram */}
            <div className="grid grid-cols-3 gap-[2px]">
              {mediaPosts.map((p: any, i) => {
                const isVideo = !!p.video_url;
                const src = p.image_url || p.video_url;
                return (
                  <motion.button
                    type="button"
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.28 + i * 0.025 }}
                    onClick={() => {
                      setLightboxUrl(src);
                      setLightboxPost(p);
                    }}
                    className="group relative aspect-square overflow-hidden bg-secondary"
                  >
                    <GridMedia src={src} isVideo={isVideo} alt={`@${profile.username} post`} />
                    {/* Hover overlay with metrics — desktop nicety */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                      <span className="flex items-center gap-1 text-[12px] font-black text-foreground">
                        <Heart size={12} fill="currentColor" />
                        {p.likes_count ?? 0}
                      </span>
                      <span className="flex items-center gap-1 text-[12px] font-black text-foreground">
                        <MessageCircle size={12} fill="currentColor" />
                        {p.comments_count ?? 0}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state when no posts */}
        {mediaPosts && mediaPosts.length === 0 && (
          <div className="mb-6 -mx-4">
            <div className="flex items-center justify-center border-t border-border">
              <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border-t-2 border-foreground -mt-px">
                <Camera size={12} className="text-foreground" />
                <span className="text-[11px] font-black tracking-[0.22em] uppercase text-foreground">
                  Posts
                </span>
              </div>
            </div>
            <EmptyState
              icon={Camera}
              title="No posts yet"
              description={`When @${profile.username} drops proof on the Elite Feed, it'll show here.`}
              className="mx-4 my-4"
            />

          </div>
        )}

        {/* Badges — moved below the feed */}
        {badges && badges.length > 0 && (
          <div className="px-0 mb-4">
            <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">
              Recent Badges
            </p>
            <div className="grid grid-cols-4 gap-2">
              {badges.map((b: any, i) => (
                <motion.div
                  key={b.badge_id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.04 }}
                  className={cn(
                    "aspect-square rounded-xl border flex flex-col items-center justify-center",
                    b.badges?.rarity === 'legendary' ? "border-gold/40 bg-gold/5" :
                    b.badges?.rarity === 'epic' ? "border-[hsl(var(--purple))]/30 bg-[hsl(var(--purple))]/5" :
                    "border-border bg-card",
                  )}
                >
                  <span className="text-2xl">{b.badges?.icon}</span>
                  <span className="text-[10px] font-bold mt-0.5 line-clamp-1 px-1 text-center text-muted-foreground">
                    {b.badges?.name}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-center text-muted-foreground/60 font-semibold mt-3 tracking-wider">
          DISCIPLINE IS THE NEW FLEX
        </p>
      </div>

      <ImageLightbox
        open={!!lightboxUrl}
        imageUrl={lightboxUrl}
        isVideo={!!lightboxPost?.video_url}
        username={profile.username}
        avatarUrl={profile.avatar_url}
        tier={(profile.status_tier || "recruit") as StatusTier}
        level={profile.level ?? undefined}
        streak={profile.streak ?? undefined}
        likes={lightboxPost?.likes_count}
        comments={lightboxPost?.comments_count}
        kudos={lightboxPost?.kudos_count}
        caption={lightboxPost?.content}
        onClose={() => {
          setLightboxUrl(null);
          setLightboxPost(null);
        }}
      />
    </div>
  );
};

export default PublicProfile;
