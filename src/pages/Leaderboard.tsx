import { Trophy, Lock, Crown, TrendingUp } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Leaderboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: leaders } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, xp, level, streak, user_id, avatar_url")
        .order("xp", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Get total user count for real percentile
  const { data: totalCount } = useQuery({
    queryKey: ["total-users"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      return count || 1;
    },
  });

  // Count how many users have more XP than me for real rank
  const { data: myRealRank } = useQuery({
    queryKey: ["my-rank", profile?.user_id],
    queryFn: async () => {
      if (!profile) return null;
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gt("xp", profile.xp);
      return (count ?? 0) + 1;
    },
    enabled: !!profile,
  });

  const totalUsers = totalCount || 1;
  const rank = myRealRank || null;
  const percentile = rank ? Math.max(1, Math.round(((totalUsers - rank) / totalUsers) * 100)) : 0;

  const isElite = profile?.is_elite;

  const rankColors: Record<number, string> = {
    0: "text-gold glow-gold-text",
    1: "text-foreground/70",
    2: "text-amber-700",
  };

  if (!isElite) {
    return (
      <div className="min-h-screen pb-24 px-4 pt-6 flex flex-col items-center justify-center text-center safe-top">
        <div className="animate-reveal">
          <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Lock size={32} className="text-gold" />
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight mb-2">Elite Only</h1>
          <p className="text-base text-muted-foreground mb-6 max-w-[280px]">
            The global leaderboard is exclusive to Elite members. Upgrade to see where you rank.
          </p>
          <Button variant="gold" size="lg" onClick={() => navigate("/paywall")}>
            <Crown size={16} />
            Unlock Elite — 9,99€/kk
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 safe-top">
      <div className="animate-reveal mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Top performers. Real discipline.</p>
      </div>

      {/* Your Position */}
      {profile && (
        <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-gold/30 bg-gold/5 p-4 mb-4 glow-gold-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15 text-gold font-display font-bold">
                #{rank || "?"}
              </div>
              <div>
                <p className="font-semibold text-base">Your Position</p>
                <p className="text-sm text-muted-foreground">You're ahead of <span className="text-gold font-semibold">{percentile}%</span> of users</p>
              </div>
            </div>
            <TrendingUp size={20} className="text-gold" />
          </div>
        </div>
      )}

      {/* Top 3 */}
      <div className="space-y-2 animate-reveal animate-reveal-delay-2">
        {leaders?.slice(0, 3).map((user, i) => (
          <div
            key={user.user_id}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4",
              i === 0 ? "border-gold/30 bg-card glow-gold-sm" : "border-border bg-card",
              user.user_id === profile?.user_id && "ring-1 ring-gold/40 bg-gold/5"
            )}
          >
            <div className={cn("font-display font-black text-xl w-8 text-center tabular-nums", rankColors[i] || "text-muted-foreground")}>
              {i === 0 ? <Crown size={22} className="text-gold mx-auto" /> : i + 1}
            </div>
            <Avatar className="h-9 w-9 shrink-0">
              {user.avatar_url ? <AvatarImage src={user.avatar_url} alt={user.username} /> : null}
              <AvatarFallback className={cn("text-xs font-bold", i === 0 ? "bg-gold/20 text-gold" : "bg-secondary")}>{user.username?.charAt(0)?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <button onClick={() => navigate(`/user/${user.user_id}`)} className={cn("text-base font-semibold truncate hover:underline text-left", user.user_id === profile?.user_id && "text-gold")}>
                @{user.username} {user.user_id === profile?.user_id && <span className="text-[10px] text-gold/70 font-medium">(you)</span>}
              </button>
              <p className="text-sm text-muted-foreground">Level {user.level} • {user.streak}d streak</p>
            </div>
            <div className="text-right">
              <p className={cn("font-display font-bold text-sm tabular-nums", i === 0 && "text-gold")}>{user.xp.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">XP</p>
            </div>
          </div>
        ))}
      </div>

      {/* Full list */}
      <div className="mt-4 animate-reveal animate-reveal-delay-3">
        <div className="space-y-2">
          {leaders?.slice(3).map((user, i) => (
            <div key={user.user_id} className={cn("flex items-center gap-3 rounded-xl border p-4", user.user_id === profile?.user_id ? "border-gold/30 bg-gold/5 ring-1 ring-gold/40" : "border-border bg-card")}>
              <div className="font-display font-black text-xl w-8 text-center text-muted-foreground tabular-nums">{i + 4}</div>
              <Avatar className="h-8 w-8 shrink-0">
                {user.avatar_url ? <AvatarImage src={user.avatar_url} alt={user.username} /> : null}
                <AvatarFallback className="text-xs font-bold bg-secondary">{user.username?.charAt(0)?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <button onClick={() => navigate(`/user/${user.user_id}`)} className={cn("text-sm font-semibold hover:underline text-left", user.user_id === profile?.user_id && "text-gold")}>
                  @{user.username} {user.user_id === profile?.user_id && <span className="text-[10px] text-gold/70 font-medium">(you)</span>}
                </button>
                <p className="text-xs text-muted-foreground">Level {user.level}</p>
              </div>
              <p className="font-display font-bold text-sm tabular-nums">{user.xp.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
