import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import StatusAvatar from "@/components/StatusAvatar";
import ApexBadge from "@/components/ApexBadge";
import StatusNameplate from "@/components/StatusNameplate";
import ImageLightbox from "@/components/ImageLightbox";
import { getTierConfig, getTierUsernameClass } from "@/lib/status-tiers";
import { Crown, Flame, Zap, Trophy, ChevronLeft, ExternalLink, Lock, Heart, MessageCircle, Award, Play, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxPost, setLightboxPost] = useState<any>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      if (!username) return null;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, status_tier, level, xp, streak, longest_streak, is_elite, is_apex_subscriber, legend_pinned")
        .ilike("username", username)
        .maybeSingle();
      return data;
    },
    enabled: !!username,
  });

  const { data: championHistory } = useQuery({
    queryKey: ["public-champion-history", profile?.user_id],
    enabled: !!profile?.user_id,
    queryFn: async () => {
      const { count } = await supabase
        .from("leaderboard_champions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile!.user_id);
      return { wins: count || 0 };
    },
  });

  const { data: badges } = useQuery({
    queryKey: ["public-badges", profile?.user_id],
    enabled: !!profile?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("badge_id, earned_at, badges(name, icon, rarity)")
        .eq("user_id", profile!.user_id)
        .order("earned_at", { ascending: false })
        .limit(8);
      return data || [];
    },
  });

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
      document.title = `@${profile.username} · ${tier.label} · The W Tracker`;
      const desc = document.querySelector('meta[name="description"]');
      const text = `${tier.emoji} ${tier.label} · Level ${profile.level} · ${profile.streak}d streak · ${profile.xp.toLocaleString()} XP`;
      if (desc) desc.setAttribute('content', text);
      else {
        const m = document.createElement('meta');
        m.name = 'description';
        m.content = text;
        document.head.appendChild(m);
      }
    }
    return () => { document.title = "The W Tracker"; };
  }, [profile]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center">
        <Lock size={32} className="text-muted-foreground/40 mb-3" />
        <h1 className="font-display text-xl font-black mb-2">User not found</h1>
        <p className="text-sm text-muted-foreground mb-6">@{username} doesn't exist on The W Tracker</p>
        <Button variant="coal" onClick={() => navigate("/")}>Open The W Tracker</Button>
      </div>
    );
  }

  const tier = getTierConfig(profile.status_tier || 'recruit');
  const isApexSubscriber = Boolean((profile as any).is_apex_subscriber);
  const isLegendPinned = Boolean((profile as any).legend_pinned);

  return (
    <div className="min-h-[100dvh] relative pb-10">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
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
              { label: "XP", value: profile.xp >= 1000 ? `${(profile.xp / 1000).toFixed(1)}k` : profile.xp.toString(), color: "text-gold" },
              { label: "Streak", value: `${profile.streak}d`, color: "text-[hsl(18_95%_58%)]" },
              { label: "Level", value: profile.level.toString(), color: "text-foreground" },
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
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-1">
                  {s.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Username + display name + tier */}
        <div className="mb-3">
          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className={cn(
              "font-display text-xl leading-tight font-black tracking-tight",
              getTierUsernameClass(profile.status_tier || 'recruit'),
            )}
          >
            @{profile.username}
          </motion.h1>
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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[9px] font-black uppercase tracking-[0.18em] bg-gradient-to-r from-gold via-[hsl(42_90%_70%)] to-gold text-[hsl(260_18%_4%)] border border-gold">
              <Crown size={9} strokeWidth={3} />
              Day-One
            </span>
          )}
          {profile.status_tier === 'apex' ? (
            <ApexBadge isFounding={isApexSubscriber} size="sm" />
          ) : profile.status_tier === 'legend' ? (
            <ApexBadge tier="legend" size="sm" />
          ) : profile.is_elite ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gold/45 bg-gold/5">
              <Crown size={10} className="text-gold" />
              <span className="text-[10px] font-black text-gold tracking-wider uppercase">Elite</span>
            </span>
          ) : null}
          {championHistory && championHistory.wins > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gold/45 bg-gold/5">
              <Trophy size={10} className="text-gold" />
              <span className="text-[10px] font-black text-gold tracking-wider uppercase">
                Champion{championHistory.wins > 1 ? ` ×${championHistory.wins}` : ''}
              </span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-card">
            <Trophy size={10} className="text-muted-foreground" />
            <span className="text-[10px] font-black text-muted-foreground tracking-wider uppercase">
              Best {profile.longest_streak}d
            </span>
          </span>
        </motion.div>

        {/* CTA — moved up so it's visible above the fold */}
        <Link to="/landing" className="block mb-5">
          <Button variant="coal" size="default" className="w-full">
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
                <span className="text-[10px] font-black tracking-[0.22em] uppercase text-foreground">
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
                      if (isVideo) return;
                      setLightboxUrl(src);
                      setLightboxPost(p);
                    }}
                    className="group relative aspect-square overflow-hidden bg-secondary"
                  >
                    {isVideo ? (
                      <>
                        <video
                          src={src}
                          muted
                          playsInline
                          preload="metadata"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <span className="absolute top-1.5 right-1.5">
                          <Play size={14} className="text-foreground drop-shadow-lg" fill="currentColor" />
                        </span>
                      </>
                    ) : (
                      <img
                        src={src}
                        alt={`@${profile.username} post`}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
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
                <span className="text-[10px] font-black tracking-[0.22em] uppercase text-foreground">
                  Posts
                </span>
              </div>
            </div>
            <div className="py-16 flex flex-col items-center text-center px-6">
              <div className="h-14 w-14 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-3">
                <Camera size={22} className="text-muted-foreground/60" />
              </div>
              <p className="text-sm font-bold text-foreground">No posts yet</p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-[220px]">
                When @{profile.username} drops proof on the Elite Feed, it'll show here.
              </p>
            </div>
          </div>
        )}

        {/* Badges — moved below the feed */}
        {badges && badges.length > 0 && (
          <div className="px-0 mb-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">
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
                  <span className="text-[8px] font-bold mt-0.5 line-clamp-1 px-1 text-center text-muted-foreground">
                    {b.badges?.name}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-center text-muted-foreground/60 font-semibold mt-3 tracking-wider">
          DISCIPLINE IS THE NEW FLEX
        </p>
      </div>

      <ImageLightbox
        open={!!lightboxUrl}
        imageUrl={lightboxUrl}
        username={profile.username}
        avatarUrl={profile.avatar_url}
        tier={(profile.status_tier || "recruit") as any}
        level={profile.level}
        streak={profile.streak}
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
