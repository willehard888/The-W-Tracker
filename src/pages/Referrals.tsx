import { useState } from "react";
import { Copy, Check, Gift, Users, Share2, Trophy, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Referrals = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data: referrals } = useQuery({
    queryKey: ["referrals", profile?.user_id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", profile.user_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile,
  });

  if (!profile) return null;

  const referralLink = `${window.location.origin}/auth?ref=${profile.referral_code || profile.username}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join The W Tracker",
          text: `Join The W Tracker and level up your discipline. Use my referral link to get started!`,
          url: referralLink,
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const referralCount = profile.referral_count || 0;

  const rewards = [
    { count: 1, reward: "+100 Bonus XP", unlocked: referralCount >= 1 },
    { count: 3, reward: "Exclusive Badge 🏅", unlocked: referralCount >= 3 },
    { count: 5, reward: "1 Week Elite Free", unlocked: referralCount >= 5 },
    { count: 10, reward: "Lifetime Founder Badge ⭐", unlocked: referralCount >= 10 },
  ];

  return (
    <div className="min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6 animate-reveal">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors active:scale-95">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Invite Friends</h1>
          <p className="text-xs text-muted-foreground">Share the movement. Earn rewards.</p>
        </div>
      </div>

      {/* Share Card */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-gold/20 bg-card p-6 text-center mb-6">
        <div className="h-16 w-16 rounded-full gradient-gold flex items-center justify-center glow-gold mx-auto mb-4">
          <Gift size={28} className="text-primary-foreground" />
        </div>
        <h2 className="font-display font-bold text-lg mb-1">Spread the Discipline</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Invite friends and earn XP, badges, and Elite access when they join.
        </p>

        {/* Referral Link */}
        <div className="flex items-center gap-2 bg-secondary rounded-lg p-3 mb-4">
          <p className="flex-1 text-xs text-muted-foreground truncate text-left font-mono">
            {referralLink}
          </p>
          <button
            onClick={handleCopy}
            className="shrink-0 p-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors active:scale-95"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        <div className="flex gap-2">
          <Button variant="gold" size="lg" className="flex-1" onClick={handleNativeShare}>
            <Share2 size={16} />
            Share Link
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="animate-reveal animate-reveal-delay-2 flex gap-3 mb-6">
        <div className="flex-1 rounded-xl border border-border bg-card p-4 text-center">
          <Users size={20} className="text-gold mx-auto mb-1" />
          <p className="text-2xl font-black font-display text-gold">{referralCount}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Friends Invited</p>
        </div>
        <div className="flex-1 rounded-xl border border-border bg-card p-4 text-center">
          <Trophy size={20} className="text-gold mx-auto mb-1" />
          <p className="text-2xl font-black font-display text-gold">{rewards.filter((r) => r.unlocked).length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Rewards Earned</p>
        </div>
      </div>

      {/* Rewards Tiers */}
      <div className="animate-reveal animate-reveal-delay-3">
        <h2 className="font-display font-bold text-sm mb-3 tracking-tight">Referral Rewards</h2>
        <div className="space-y-2">
          {rewards.map((r) => (
            <div
              key={r.count}
              className={`flex items-center gap-3 rounded-xl border p-4 transition-all ${
                r.unlocked
                  ? "border-gold/30 bg-gold/[0.04]"
                  : "border-border bg-card opacity-60"
              }`}
            >
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-black ${
                r.unlocked ? "gradient-gold text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}>
                {r.count}
              </div>
              <div className="flex-1">
                <p className={`font-semibold text-sm ${r.unlocked ? "text-gold" : ""}`}>
                  Invite {r.count} friend{r.count > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground">{r.reward}</p>
              </div>
              {r.unlocked && <Check size={18} className="text-gold" />}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Referrals */}
      {referrals && referrals.length > 0 && (
        <div className="mt-6 animate-reveal animate-reveal-delay-4">
          <h2 className="font-display font-bold text-sm mb-3 tracking-tight">Recent Invites</h2>
          <div className="space-y-2">
            {referrals.map((ref: any) => (
              <div key={ref.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="h-8 w-8 rounded-full bg-gold/10 flex items-center justify-center">
                  <Users size={14} className="text-gold" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    {new Date(ref.created_at).toLocaleDateString()}
                  </p>
                </div>
                {ref.rewarded && <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">Rewarded</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Referrals;
