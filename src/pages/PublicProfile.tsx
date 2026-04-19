import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import StatusAvatar from "@/components/StatusAvatar";
import { getTierConfig } from "@/lib/status-tiers";
import { Crown, Flame, Zap, Trophy, ChevronLeft, ExternalLink, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import AmbientParticles from "@/components/AmbientParticles";
import { useEffect } from "react";

const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      if (!username) return null;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, status_tier, level, xp, streak, longest_streak, is_elite")
        .ilike("username", username)
        .maybeSingle();
      return data;
    },
    enabled: !!username,
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
        <Button variant="gold" onClick={() => navigate("/")}>Open The W Tracker</Button>
      </div>
    );
  }

  const tier = getTierConfig(profile.status_tier || 'recruit');
  const isLegend = profile.status_tier === 'legend';
  const isApex = profile.status_tier === 'apex';
  const isElite = profile.status_tier === 'elite';

  const heroBg = isLegend
    ? "linear-gradient(160deg, hsl(280 70% 14% / 0.6), hsl(255 14% 5%), hsl(350 60% 12% / 0.5))"
    : isApex
    ? "linear-gradient(160deg, hsl(18 80% 16% / 0.55), hsl(255 14% 5%))"
    : isElite
    ? "linear-gradient(160deg, hsl(42 60% 14% / 0.55), hsl(255 14% 5%))"
    : "linear-gradient(160deg, hsl(255 14% 9%), hsl(255 14% 5%))";

  return (
    <div className="min-h-[100dvh] relative">
      <AmbientParticles />

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-20 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={14} /> Back
      </button>

      <div className="px-4 pt-12">
        {/* Cinematic hero card — matches /profile */}
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
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />

          <div className="relative flex flex-col items-center text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-gold/70 mb-3">
              The W Tracker
            </p>

            {/* Avatar — large, gold ring with offset */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative mb-5"
            >
              <div className="absolute inset-0 -m-3 rounded-full bg-gold/35 blur-2xl" aria-hidden />
              <div className="relative">
                <StatusAvatar
                  src={profile.avatar_url}
                  name={profile.username}
                  tier={profile.status_tier || 'recruit'}
                  size="xl"
                />
              </div>
            </motion.div>

            {/* Username */}
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="font-display text-[34px] leading-none font-black tracking-tight text-foreground/95"
            >
              @{profile.username}
            </motion.h1>
            {profile.display_name && (
              <p className="text-sm text-muted-foreground mt-1.5">{profile.display_name}</p>
            )}

            {/* Status pills — Elite · Tier · Level */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex flex-wrap items-center justify-center gap-2 mt-4"
            >
              {profile.is_elite && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gold/45 bg-gold/5">
                  <Crown size={12} className="text-gold" />
                  <span className="text-[11px] font-black text-gold tracking-wider uppercase">Elite</span>
                </span>
              )}
              <span className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border",
                tier.borderClass,
                tier.bgClass,
              )}>
                <span className="text-sm leading-none">{tier.emoji}</span>
                <span className={cn("text-[11px] font-black tracking-wider uppercase", tier.textClass)}>
                  {tier.label}
                </span>
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full">
                <span className="text-[11px] font-black tracking-wider text-muted-foreground/80 uppercase">
                  Level {profile.level}
                </span>
              </span>
            </motion.div>

            {/* Hero XP — massive */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 }}
              className="mt-6 flex flex-col items-center"
            >
              <p className="font-display font-black text-[64px] leading-none text-gold drop-shadow-[0_0_24px_hsl(42_78%_54%/0.55)] tabular-nums">
                {profile.xp.toLocaleString().replace(/,/g, " ")}
              </p>
              <p className="text-[10px] font-black tracking-[0.32em] text-gold/70 mt-2">TOTAL XP</p>
            </motion.div>

            {/* Percentile / pressure line */}
            <p className="text-sm text-muted-foreground/70 font-medium italic mt-5 max-w-[280px]">
              {tier.percentile}
            </p>
          </div>

          <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon: Zap, label: "LEVEL", value: profile.level, color: "text-gold" },
            { icon: Flame, label: "STREAK", value: `${profile.streak}d`, color: "text-[hsl(18_95%_58%)]" },
            { icon: Trophy, label: "BEST", value: `${profile.longest_streak}d`, color: "text-gold" },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                className="rounded-xl border border-border bg-card p-3 text-center"
              >
                <Icon size={14} className={cn("mx-auto mb-1", s.color)} />
                <p className={cn("font-display font-black text-xl tabular-nums", s.color)}>
                  {s.value}
                </p>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                  {s.label}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Badges */}
        {badges && badges.length > 0 && (
          <div className="mb-6">
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

        {/* CTA */}
        <Link to="/landing">
          <Button variant="gold" size="lg" className="w-full">
            <ExternalLink size={16} />
            Track your status — start free
          </Button>
        </Link>

        <p className="text-[10px] text-center text-muted-foreground/60 font-semibold mt-3 tracking-wider">
          DISCIPLINE IS THE NEW FLEX
        </p>
      </div>
    </div>
  );
};

export default PublicProfile;
