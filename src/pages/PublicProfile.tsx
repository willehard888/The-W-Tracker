import { fmtInt } from "@/lib/format";
import { useParams, useNavigate, Link } from "react-router-dom";
import { backOr } from "@/lib/nav";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import StatusAvatar from "@/components/StatusAvatar";
import ApexBadge from "@/components/ApexBadge";
import StatusNameplate from "@/components/StatusNameplate";
import StreakFlameInline from "@/components/StreakFlameInline";
import ImageLightbox from "@/components/ImageLightbox";
import PageBar from "@/components/ui/page-bar";
import { SubPageSkeleton } from "@/components/skeletons/PageSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import EmptyState from "@/components/ui/empty-state";
import GridMedia from "@/components/feed/GridMedia";
import { Button } from "@/components/ui/button";
import { getTierConfig, formatTier, type StatusTier } from "@/lib/status-tiers";
import { Crown, Trophy, ExternalLink, Lock, Heart, MessageCircle, Camera } from "lucide-react";
import { useEffect, useState } from "react";

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

interface MediaPost {
  id: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  likes_count: number | null;
  comments_count: number | null;
  kudos_count: number | null;
}

/** One inline number + label of the standing line. */
const Standing = ({ value, label, gold }: { value: string; label: string; gold?: boolean }) => (
  <span className="inline-flex items-baseline gap-1">
    <span className={`font-display font-black text-[17px] tabular-nums leading-none${gold ? " text-gold glow-gold-text" : ""}`}>{value}</span>
    <span className="text-[11px] text-muted-foreground">{label}</span>
  </span>
);

/**
 * /u/:username — the only screen a non-user ever sees. Thesis: the athlete,
 * proven. The beat names the rung and the best streak, the nameplate is the
 * hero, the numbers are one standing line, the proof grid and badges go
 * quiet, and the one ember door leads into the app.
 */
const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [lightboxPost, setLightboxPost] = useState<MediaPost | null>(null);

  // One SECURITY DEFINER RPC serves the whole public identity — profiles
  // SELECT is authenticated-only (anti-scraping, 20260414092928), so a plain
  // table read here returned nothing for logged-out share-link visitors and
  // the page claimed the user didn't exist.
  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      if (!username) return null;
      const { data, error } = await supabase.rpc("get_public_profile", { p_username: username });
      if (error) throw error;
      return (data ?? null) as unknown as PublicProfileBundle | null;
    },
    enabled: !!username,
  });

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
      return (data || []) as MediaPost[];
    },
  });

  // SEO
  useEffect(() => {
    if (profile) {
      const tier = getTierConfig(profile.status_tier || 'recruit');
      document.title = `@${profile.username} · ${tier.label} · Whealth Factory`;
      const desc = document.querySelector('meta[name="description"]');
      const text = `${tier.emoji} ${tier.label} · Level ${profile.level ?? 1} · ${profile.streak ?? 0}d streak · ${fmtInt(profile.xp ?? 0)} XP`;
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

  if (isLoading) return <SubPageSkeleton />;

  if (isError || !profile) {
    return (
      <div className="min-h-full">
        <PageBar title={`@${username}`} onBack={() => backOr(navigate, "/")} />
        <div className="px-4 pt-6">
          {isError ? (
            <ErrorState title="Couldn't load this profile" onRetry={refetch} />
          ) : (
            <EmptyState
              icon={Lock}
              title="User not found"
              description={`@${username} doesn't exist on Whealth Factory`}
              action={
                <Button variant="ember" size="sm" className="min-h-11" onClick={() => navigate("/")}>
                  Open Whealth Factory
                </Button>
              }
            />
          )}
        </div>
      </div>
    );
  }

  const tierKey = profile.status_tier || 'recruit';
  const tier = getTierConfig(tierKey);
  const isApexSubscriber = Boolean(profile.is_apex_subscriber);
  const best = profile.longest_streak ?? 0;
  const streak = profile.streak ?? 0;
  const lightboxUrl = lightboxPost ? (lightboxPost.image_url || lightboxPost.video_url) : null;

  return (
    <div className="min-h-full">
      <PageBar title={`@${profile.username}`} onBack={() => backOr(navigate, "/")} />

      <div className="px-4 pt-3 pb-6">
        {/* ── OPENING BEAT — the rung and the proof, stated once ── */}
        <div className="home-rise mb-5">
          <h2 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">
            {best > 0 ? `${formatTier(tierKey, profile.tier_division)}. ${best}-day best.` : `${tier.label}. Day one.`}
          </h2>
          {profile.display_name && <p className="text-[13px] text-muted-foreground mt-1">{profile.display_name}</p>}
        </div>

        {/* ── HERO — the athlete and the tier they hold ── */}
        <div className="home-rise home-rise-1 flex flex-col items-center text-center">
          <StatusAvatar src={profile.avatar_url} name={profile.username} tier={tierKey} size="xl" />
          <div className="mt-4 w-full">
            <StatusNameplate tier={tierKey} size="md" />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {isApexSubscriber && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-gold/40 bg-gold/10 text-[10px] font-bold text-gold">
                <Crown size={11} aria-hidden /> Day-One
              </span>
            )}
            {tierKey === 'apex' ? (
              <ApexBadge isFounding={isApexSubscriber} size="sm" />
            ) : tierKey === 'legend' ? (
              <ApexBadge tier="legend" size="sm" />
            ) : null}
            {profile.champion_wins > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-card text-[10px] font-bold text-muted-foreground">
                <Trophy size={11} aria-hidden /> {profile.champion_wins > 1 ? `${profile.champion_wins}× ` : ""}Season Champion
              </span>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground/80 italic mt-3 max-w-[280px] leading-snug">{tier.message}</p>
        </div>

        {/* ── STANDING — the numbers as one line, XP the felt one ── */}
        <div className="home-rise home-rise-2 surface-card surface-card-quiet mt-5 flex items-baseline gap-x-4 gap-y-0.5 flex-wrap px-4 py-3">
          <Standing value={fmtInt(profile.xp ?? 0)} label="XP" gold />
          <span className="inline-flex items-baseline gap-1">
            <StreakFlameInline
              streak={streak}
              suffix="d"
              still
              countClassName="font-display font-black text-[17px] tabular-nums leading-none text-foreground"
            />
            <span className="text-[11px] text-muted-foreground">streak</span>
          </span>
          <Standing value={fmtInt(profile.level ?? 1)} label="level" />
        </div>

        {/* ── THE DOOR — the one ember on the screen ── */}
        <div className="home-rise home-rise-3 mt-4">
          <Button asChild variant="ember" className="w-full">
            <Link to="/landing">
              <ExternalLink size={14} aria-hidden />
              Track your status
            </Link>
          </Button>
        </div>

        {/* ── PROOF — the media grid, edge to edge ── */}
        {mediaPosts && (
          <div className="home-rise home-rise-4 mt-7">
            <p className="text-[11px] font-bold text-muted-foreground mb-2">
              Posts{mediaPosts.length > 0 ? ` · ${mediaPosts.length}` : ""}
            </p>
            {mediaPosts.length > 0 ? (
              <div className="-mx-4 grid grid-cols-3 gap-[2px]">
                {mediaPosts.map((p) => {
                  const isVideo = !!p.video_url;
                  const src = (p.image_url || p.video_url)!;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setLightboxPost(p)}
                      className="group relative aspect-square overflow-hidden bg-secondary"
                    >
                      <GridMedia src={src} isVideo={isVideo} alt={`@${profile.username} post`} />
                      {/* Hover overlay with metrics — desktop nicety */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                        <span className="flex items-center gap-1 text-[12px] font-black text-foreground">
                          <Heart size={12} fill="currentColor" aria-hidden />
                          {p.likes_count ?? 0}
                        </span>
                        <span className="flex items-center gap-1 text-[12px] font-black text-foreground">
                          <MessageCircle size={12} fill="currentColor" aria-hidden />
                          {p.comments_count ?? 0}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Camera}
                title="No posts yet"
                description={`When @${profile.username} drops proof on the Elite Feed, it'll show here.`}
              />
            )}
          </div>
        )}

        {/* ── BADGES — a quiet grid ── */}
        {badges.length > 0 && (
          <div className="home-rise home-rise-5 mt-7">
            <p className="text-[11px] font-bold text-muted-foreground mb-2">Badges · {badges.length}</p>
            <div className="grid grid-cols-4 gap-2">
              {badges.map((b) => (
                <div key={b.badge_id} className="aspect-square rounded-xl border border-border/50 bg-card/40 flex flex-col items-center justify-center">
                  <span className="text-2xl" aria-hidden>{b.badges?.icon}</span>
                  <span className="text-[10px] font-bold mt-0.5 line-clamp-1 px-1 text-center text-muted-foreground">
                    {b.badges?.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="eyebrow text-center mt-8">Discipline is the new flex</p>
      </div>

      <ImageLightbox
        open={!!lightboxUrl}
        imageUrl={lightboxUrl}
        isVideo={!!lightboxPost?.video_url}
        username={profile.username}
        avatarUrl={profile.avatar_url}
        tier={tierKey as StatusTier}
        level={profile.level ?? undefined}
        streak={profile.streak ?? undefined}
        likes={lightboxPost?.likes_count ?? undefined}
        comments={lightboxPost?.comments_count ?? undefined}
        kudos={lightboxPost?.kudos_count ?? undefined}
        caption={lightboxPost?.content ?? undefined}
        onClose={() => setLightboxPost(null)}
      />
    </div>
  );
};

export default PublicProfile;
